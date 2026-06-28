-- Create order_adjustments table for returns and refunds financial audit trails
CREATE TABLE IF NOT EXISTS public.order_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('return', 'refund', 'tax_adjustment', 'fee_adjustment')),
  amount NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL,
  shipping_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on order_adjustments
ALTER TABLE public.order_adjustments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "order_adjustments_own" ON public.order_adjustments;
DROP POLICY IF EXISTS "order_adjustments_admin_all" ON public.order_adjustments;

-- RLS Select Policy for customers and admins
CREATE POLICY "order_adjustments_own" ON public.order_adjustments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_adjustments.order_id
        AND o.user_id = auth.uid()
    ) OR public.is_admin_check(auth.uid())
  );

-- RLS All-Access Policy for admins
CREATE POLICY "order_adjustments_admin_all" ON public.order_adjustments
  FOR ALL TO authenticated
  USING (public.is_admin_check(auth.uid()))
  WITH CHECK (public.is_admin_check(auth.uid()));

-- Recreate approve_return_and_restock to record adjustments using the double-entry return ledger pattern
CREATE OR REPLACE FUNCTION public.approve_return_and_restock(
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
  v_order_tenant_id uuid;
  v_current_tenant_id uuid;
  v_order_subtotal numeric;
  v_order_tax numeric;
  v_order_shipping numeric;
  v_order_discount numeric;
  v_order_total numeric;
BEGIN
  -- Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify admin role
  IF NOT (
    public.jwt_has_admin_role() OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized. Admin privileges required.';
  END IF;

  -- Resolve tenant IDs, financial totals, and check boundaries
  SELECT 
    tenant_id, subtotal, tax_amount, shipping_amount, discount_amount, total
  INTO 
    v_order_tenant_id, v_order_subtotal, v_order_tax, v_order_shipping, v_order_discount, v_order_total
  FROM public.orders 
  WHERE id = p_order_id;
  
  v_current_tenant_id := public.get_current_tenant_id();

  IF v_order_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Access denied. Order belongs to a different tenant.';
  END IF;

  -- Lock the order row to prevent concurrent modifications
  PERFORM 1
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- Loop over order items and replenish inventory atomically
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

  -- Insert a corresponding negative entry into order_adjustments table to preserve a perfect audit trail
  INSERT INTO public.order_adjustments (
    order_id,
    adjustment_type,
    amount,
    tax_amount,
    shipping_amount,
    discount_amount,
    tenant_id,
    notes
  ) VALUES (
    p_order_id,
    'return',
    -v_order_subtotal,
    -v_order_tax,
    -v_order_shipping,
    -v_order_discount,
    v_order_tenant_id,
    p_notes
  );

  -- Update order status, payment status, and notes, keeping original financial columns intact
  UPDATE public.orders
  SET 
    status = 'returned',
    payment_status = 'refunded',
    notes = p_notes,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;
