-- 1. Alter check constraint on orders table status column to include PENDING_PAYMENT, PAID, and FAILED_ABANDONED
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'PENDING_PAYMENT', 'PAID', 'FAILED_ABANDONED'));

-- 2. Recreate place_order function to handle header-based idempotency keys and PENDING_PAYMENT status
CREATE OR REPLACE FUNCTION public.place_order(
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
  p_items jsonb,
  p_redeemed_points integer DEFAULT 0,
  p_coupon_code text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_sku text;
  v_product_id uuid;
  v_current_stock integer;
  v_loyalty_points integer;
  v_current_balance integer;
  
  -- Recalculation variables
  v_db_unit_price numeric;
  v_item_total_price numeric;
  v_recalculated_subtotal numeric := 0;
  v_recalculated_tax numeric := 0;
  v_recalculated_shipping numeric := 0;
  
  -- Coupon validation
  v_coupon_id uuid;
  v_coupon_type text;
  v_coupon_value numeric;
  v_coupon_min_amount numeric;
  v_coupon_max_discount numeric;
  v_coupon_usage_limit integer;
  v_coupon_used_count integer;
  v_coupon_discount numeric := 0;
  
  v_points_discount numeric := 0;
  v_calculated_discount numeric := 0;
  v_recalculated_total numeric := 0;
BEGIN
  -- Resolve user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Extract idempotency key from request headers if not provided as argument
  IF p_idempotency_key IS NULL THEN
    BEGIN
      p_idempotency_key := (current_setting('request.headers', true)::json)->>'idempotency-key';
    EXCEPTION WHEN OTHERS THEN
      p_idempotency_key := NULL;
    END;
    IF p_idempotency_key IS NULL THEN
      BEGIN
        p_idempotency_key := (current_setting('request.headers', true)::json)->>'x-idempotency-key';
      EXCEPTION WHEN OTHERS THEN
        p_idempotency_key := NULL;
      END;
    END IF;
  END IF;

  -- Check for existing order with this idempotency key to prevent double submits
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order_id
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing_order_id;
    END IF;
  END IF;

  -- 2. Apply strict row-level lock (FOR UPDATE) on user profile early.
  SELECT loyalty_points INTO v_current_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- Resolve tenant
  v_tenant_id := public.get_current_tenant_id();

  -- 3. Validate loyalty points if redemption is requested
  IF p_redeemed_points > 0 THEN
    IF v_current_balance < p_redeemed_points THEN
      RAISE EXCEPTION 'Insufficient loyalty points balance. Available: %, Requested: %', v_current_balance, p_redeemed_points;
    END IF;
  END IF;

  -- 4. Recalculate subtotal and validate/lock stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT pv.inventory_quantity, pv.sku, COALESCE(p.sale_price, p.base_price) 
    INTO v_current_stock, v_sku, v_db_unit_price
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.id = v_variant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_variant_id;
    END IF;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for item (SKU: %). Available: %, Requested: %', v_sku, v_current_stock, v_quantity;
    END IF;

    v_recalculated_subtotal := v_recalculated_subtotal + (v_db_unit_price * v_quantity);
  END LOOP;

  -- 5. Calculate tax and shipping
  v_recalculated_tax := round(v_recalculated_subtotal * 0.18, 2);
  v_recalculated_shipping := CASE WHEN v_recalculated_subtotal >= 999 THEN 0 ELSE 99 END;

  -- 6. Calculate discount and lock/validate coupon usage limit
  IF p_coupon_code IS NOT NULL THEN
    SELECT id, type, value, min_order_amount, max_discount_amount, usage_limit, used_count 
    INTO v_coupon_id, v_coupon_type, v_coupon_value, v_coupon_min_amount, v_coupon_max_discount, v_coupon_usage_limit, v_coupon_used_count
    FROM public.coupons
    WHERE code = UPPER(TRIM(p_coupon_code)) AND is_active = true AND now() BETWEEN valid_from AND valid_until;

    IF FOUND THEN
      -- Validate usage limit
      IF v_coupon_usage_limit IS NOT NULL AND v_coupon_used_count >= v_coupon_usage_limit THEN
        RAISE EXCEPTION 'Coupon usage limit has been reached';
      END IF;

      IF v_recalculated_subtotal >= v_coupon_min_amount THEN
        IF v_coupon_type = 'percentage' THEN
          v_coupon_discount := v_recalculated_subtotal * (v_coupon_value / 100.0);
          IF v_coupon_max_discount IS NOT NULL THEN
            v_coupon_discount := least(v_coupon_discount, v_coupon_max_discount);
          END IF;
        ELSIF v_coupon_type = 'fixed' THEN
          v_coupon_discount := least(v_coupon_value, v_recalculated_subtotal);
        END IF;
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid or expired coupon code';
    END IF;
  END IF;
  
  v_points_discount := p_redeemed_points * 0.1;
  v_calculated_discount := round(v_coupon_discount + v_points_discount, 2);

  v_recalculated_total := greatest(0, v_recalculated_subtotal + v_recalculated_tax + v_recalculated_shipping - v_calculated_discount);

  -- Validate price integrity
  IF abs(p_subtotal - v_recalculated_subtotal) > 0.05 THEN
    RAISE EXCEPTION 'Subtotal mismatch detected. Client: %, Server: %', p_subtotal, v_recalculated_subtotal;
  END IF;

  IF abs(p_tax_amount - v_recalculated_tax) > 0.05 THEN
    RAISE EXCEPTION 'Tax mismatch detected. Client: %, Server: %', p_tax_amount, v_recalculated_tax;
  END IF;

  IF abs(p_shipping_amount - v_recalculated_shipping) > 0.05 THEN
    RAISE EXCEPTION 'Shipping mismatch detected. Client: %, Server: %', p_shipping_amount, v_recalculated_shipping;
  END IF;

  IF abs(p_discount_amount - v_calculated_discount) > 0.05 THEN
    RAISE EXCEPTION 'Discount mismatch detected. Client: %, Server: %', p_discount_amount, v_calculated_discount;
  END IF;

  IF abs(p_total - v_recalculated_total) > 0.05 THEN
    RAISE EXCEPTION 'Total mismatch detected. Client: %, Server: %', p_total, v_recalculated_total;
  END IF;

  -- 7. Insert order into public.orders (Online payment starts as PENDING_PAYMENT, COD starts as pending)
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
    payment_status,
    tenant_id,
    idempotency_key
  ) VALUES (
    v_user_id,
    p_order_number,
    CASE WHEN p_payment_method = 'cod' THEN 'pending' ELSE 'PENDING_PAYMENT' END,
    v_recalculated_subtotal,
    v_recalculated_tax,
    v_recalculated_shipping,
    v_calculated_discount,
    v_recalculated_total,
    p_billing_address,
    p_shipping_address,
    p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'pending' ELSE 'pending' END,
    v_tenant_id,
    p_idempotency_key
  ) RETURNING id INTO v_order_id;

  -- 8. Process items and insert order_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    SELECT pv.inventory_quantity, pv.sku, pv.product_id, COALESCE(p.sale_price, p.base_price)
    INTO v_current_stock, v_sku, v_product_id, v_db_unit_price
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.id = v_variant_id;

    -- Decrement stock
    UPDATE public.product_variants
    SET 
      inventory_quantity = inventory_quantity - v_quantity,
      is_in_stock = (inventory_quantity - v_quantity) > 0,
      updated_at = now()
    WHERE id = v_variant_id;

    v_item_total_price := round(v_db_unit_price * v_quantity, 2);

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
      color,
      tenant_id
    ) VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_quantity,
      v_db_unit_price,
      v_item_total_price,
      v_item->>'product_name',
      v_item->>'product_image',
      v_item->>'size',
      v_item->>'color',
      v_tenant_id
    );
  END LOOP;

  -- 9. Perform loyalty points redemption
  IF p_redeemed_points > 0 THEN
    PERFORM public.add_loyalty_points(
      v_user_id,
      p_redeemed_points,
      'redeemed',
      'Redeemed on Order #' || p_order_number,
      v_order_id
    );
  END IF;

  -- 10. Allocate loyalty points earned based on recalculated subtotal
  v_loyalty_points := round(v_recalculated_subtotal);
  IF v_loyalty_points > 0 THEN
    PERFORM public.add_loyalty_points(
      v_user_id,
      v_loyalty_points,
      'earned',
      'Order #' || p_order_number,
      v_order_id
    );
  END IF;

  -- 11. Increment coupon usage count atomically if a coupon was used
  IF v_coupon_id IS NOT NULL THEN
    UPDATE public.coupons 
    SET used_count = used_count + 1 
    WHERE id = v_coupon_id AND (usage_limit IS NULL OR used_count < usage_limit);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coupon usage limit reached concurrently. Transaction rolled back.';
    END IF;
  END IF;

  -- 12. Clear user cart items atomically for the current tenant only
  DELETE FROM public.cart_items
  WHERE cart_id IN (
    SELECT id FROM public.carts WHERE user_id = v_user_id AND tenant_id = v_tenant_id
  );

  RETURN v_order_id;
END;
$$;

-- 3. Create function to clean up abandoned PENDING_PAYMENT orders
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_item record;
  v_points_to_refund integer;
  v_points_to_reverse integer;
  v_current_balance integer;
BEGIN
  -- For each order stuck in PENDING_PAYMENT for longer than 30 minutes
  FOR v_order IN 
    SELECT id, order_number, user_id
    FROM public.orders 
    WHERE status = 'PENDING_PAYMENT' 
      AND created_at < now() - INTERVAL '30 minutes'
    FOR UPDATE
  LOOP
    -- A. Release inventory back to catalog
    FOR v_item IN 
      SELECT variant_id, quantity 
      FROM public.order_items 
      WHERE order_id = v_order.id
    LOOP
      UPDATE public.product_variants
      SET 
        inventory_quantity = inventory_quantity + v_item.quantity,
        is_in_stock = true,
        updated_at = now()
      WHERE id = v_item.variant_id;
    END LOOP;

    -- B. Refund redeemed loyalty points
    SELECT COALESCE(SUM(points), 0) INTO v_points_to_refund
    FROM public.loyalty_transactions
    WHERE order_id = v_order.id AND type = 'redeemed';

    IF v_points_to_refund > 0 THEN
      PERFORM public.add_loyalty_points(
        v_order.user_id,
        v_points_to_refund,
        'earned',
        'Refunded points from abandoned Order #' || v_order.order_number,
        v_order.id
      );
    END IF;

    -- C. Reverse earned loyalty points
    SELECT COALESCE(SUM(points), 0) INTO v_points_to_reverse
    FROM public.loyalty_transactions
    WHERE order_id = v_order.id AND type = 'earned';

    IF v_points_to_reverse > 0 THEN
      SELECT loyalty_points INTO v_current_balance
      FROM public.profiles
      WHERE id = v_order.user_id;

      IF v_current_balance IS NULL THEN
        v_current_balance := 0;
      END IF;

      IF v_points_to_reverse > v_current_balance THEN
        v_points_to_reverse := v_current_balance;
      END IF;

      IF v_points_to_reverse > 0 THEN
        PERFORM public.add_loyalty_points(
          v_order.user_id,
          v_points_to_reverse,
          'expired',
          'Reversed points from abandoned Order #' || v_order.order_number,
          v_order.id
        );
      END IF;
    END IF;

    -- D. Update order status to FAILED_ABANDONED and payment_status to failed
    UPDATE public.orders
    SET 
      status = 'FAILED_ABANDONED',
      payment_status = 'failed',
      updated_at = now()
    WHERE id = v_order.id;

  END LOOP;
END;
$$;

-- 4. Schedule daily / 15-minute background cleanup job for abandoned carts using pg_cron
DO $$
BEGIN
  -- Unschedule existing job if any
  PERFORM cron.unschedule('cleanup-abandoned-orders');
EXCEPTION WHEN OTHERS THEN
  -- ignore if job doesn't exist or pg_cron isn't loaded
END;
$$;

SELECT cron.schedule(
  'cleanup-abandoned-orders',
  '*/15 * * * *',
  $$ SELECT public.cleanup_abandoned_orders(); $$
);
