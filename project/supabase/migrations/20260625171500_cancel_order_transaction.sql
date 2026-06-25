-- PostgreSQL function to wrap order cancellation, stock replenishment, and loyalty points reversal/refund into a single transaction
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_order_user_id uuid;
  v_status text;
  v_order_number text;
  v_user_role text;
  v_item record;
  v_current_stock integer;
  v_points_to_reverse integer;
  v_points_to_refund integer;
  v_current_balance integer;
BEGIN
  -- 1. Resolve authenticated user and check authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch order ownership, current status, and order number
  SELECT user_id, status, order_number INTO v_order_user_id, v_status, v_order_number
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order_user_id IS NULL THEN
    RAISE EXCEPTION 'Order not found (ID: %)', p_order_id;
  END IF;

  -- 3. Check authorization (caller must be the owner or an admin)
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_id <> v_order_user_id AND (v_user_role IS NULL OR v_user_role <> 'admin') THEN
    RAISE EXCEPTION 'Not authorized to cancel this order';
  END IF;

  -- 4. Check if order is already cancelled (noop) or non-cancellable
  IF v_status = 'cancelled' THEN
    RETURN;
  END IF;

  IF v_status NOT IN ('pending', 'processing', 'confirmed') THEN
    RAISE EXCEPTION 'Order cannot be cancelled in status: %', v_status;
  END IF;

  -- 5. Lock the order row to prevent concurrent updates
  PERFORM 1
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 6. Loop over items and replenish inventory atomically
  FOR v_item IN 
    SELECT variant_id, quantity 
    FROM public.order_items 
    WHERE order_id = p_order_id
  LOOP
    -- Lock variant row
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

  -- 7. Handle loyalty points reversal and refunds
  -- Sum up points earned on this order
  SELECT COALESCE(SUM(points), 0) INTO v_points_to_reverse
  FROM public.loyalty_transactions
  WHERE order_id = p_order_id AND type = 'earned';

  -- Sum up points redeemed on this order
  SELECT COALESCE(SUM(points), 0) INTO v_points_to_refund
  FROM public.loyalty_transactions
  WHERE order_id = p_order_id AND type = 'redeemed';

  -- A. Refund points that were redeemed
  IF v_points_to_refund > 0 THEN
    PERFORM public.add_loyalty_points(
      v_order_user_id,
      v_points_to_refund,
      'earned',
      'Refunded points from cancelled Order #' || v_order_number,
      p_order_id
    );
  END IF;

  -- B. Reverse points that were earned
  IF v_points_to_reverse > 0 THEN
    -- Get current balance to cap reversal (prevent negative balance violation)
    SELECT loyalty_points INTO v_current_balance
    FROM public.profiles
    WHERE id = v_order_user_id;

    IF v_current_balance IS NULL THEN
      v_current_balance := 0;
    END IF;

    -- Cap reversal to the user's current balance if they already spent some points
    IF v_points_to_reverse > v_current_balance THEN
      v_points_to_reverse := v_current_balance;
    END IF;

    IF v_points_to_reverse > 0 THEN
      PERFORM public.add_loyalty_points(
        v_order_user_id,
        v_points_to_reverse,
        'expired',
        'Reversed points from cancelled Order #' || v_order_number,
        p_order_id
      );
    END IF;
  END IF;

  -- 8. Update order status and payment status
  UPDATE public.orders
  SET 
    status = 'cancelled',
    payment_status = 'refunded',
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;
