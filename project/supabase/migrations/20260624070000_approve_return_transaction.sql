-- PostgreSQL function to wrap return approval and stock replenishment into a single transaction
CREATE OR REPLACE FUNCTION approve_return_and_restock(
  p_order_id uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item record;
  v_current_stock integer;
BEGIN
  -- 1. Lock the order row to prevent concurrent modifications
  PERFORM 1
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 2. Loop over order items and replenish inventory atomically
  FOR v_item IN 
    SELECT variant_id, quantity 
    FROM public.order_items 
    WHERE order_id = p_order_id
  LOOP
    -- Lock product variant row for update
    SELECT inventory_quantity INTO v_current_stock
    FROM public.product_variants
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product variant not found (ID: %)', v_item.variant_id;
    END IF;

    -- Increment stock atomically
    UPDATE public.product_variants
    SET 
      inventory_quantity = inventory_quantity + v_item.quantity,
      is_in_stock = TRUE,
      updated_at = now()
    WHERE id = v_item.variant_id;
  END LOOP;

  -- 3. Update order status, payment status, and notes
  UPDATE public.orders
  SET 
    status = 'returned',
    payment_status = 'refunded',
    notes = p_notes,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;
