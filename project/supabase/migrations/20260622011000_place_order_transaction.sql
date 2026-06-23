-- PostgreSQL function to wrap checkout operations into a single transaction
CREATE OR REPLACE FUNCTION place_order(
  p_order_number text,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_shipping_amount numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_billing_address jsonb,
  p_shipping_address jsonb,
  p_payment_method text,
  p_payment_status text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_sku text;
  v_current_stock integer;
  v_loyalty_points integer;
BEGIN
  -- Resolve the authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Insert order into public.orders
  INSERT INTO public.orders (
    user_id,
    order_number,
    status,
    subtotal,
    tax_amount,
    shipping_amount,
    discount_amount,
    total,
    billing_address,
    shipping_address,
    payment_method,
    payment_status
  ) VALUES (
    v_user_id,
    p_order_number,
    'pending',
    p_subtotal,
    p_tax_amount,
    p_shipping_amount,
    p_discount_amount,
    p_total,
    p_billing_address,
    p_shipping_address,
    p_payment_method,
    p_payment_status
  ) RETURNING id INTO v_order_id;

  -- 2. Process items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    -- Lock variant row and check stock (combines decrement_variant_stock logic)
    SELECT inventory_quantity, sku INTO v_current_stock, v_sku
    FROM public.product_variants
    WHERE id = v_variant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_variant_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for item (SKU: %). Available: %, Requested: %', v_sku, v_current_stock, v_quantity;
    END IF;

    -- Decrement stock
    UPDATE public.product_variants
    SET 
      inventory_quantity = inventory_quantity - v_quantity,
      is_in_stock = (inventory_quantity - v_quantity) > 0,
      updated_at = now()
    WHERE id = v_variant_id;

    -- Insert order item
    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      quantity,
      unit_price,
      total_price,
      product_name,
      product_image,
      size,
      color
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_variant_id,
      v_quantity,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric,
      v_item->>'product_name',
      v_item->>'product_image',
      v_item->>'size',
      v_item->>'color'
    );
  END LOOP;

  -- 3. Calculate and allocate loyalty points
  v_loyalty_points := floor(p_total / 100);
  IF v_loyalty_points > 0 THEN
    PERFORM public.add_loyalty_points(
      v_user_id,
      v_loyalty_points,
      'earned',
      'Order #' || p_order_number,
      v_order_id
    );
  END IF;

  RETURN v_order_id;
END;
$$;
