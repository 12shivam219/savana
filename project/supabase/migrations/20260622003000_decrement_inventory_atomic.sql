-- Atomic stock decrement function to prevent stale inventory overwrite race conditions
CREATE OR REPLACE FUNCTION decrement_variant_stock(
  p_variant_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock integer;
  v_sku text;
BEGIN
  -- Lock the specific row for update to prevent concurrent modifications
  SELECT inventory_quantity, sku INTO v_current_stock, v_sku
  FROM public.product_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product variant not found (ID: %)', p_variant_id;
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for item (SKU: %). Available: %, Requested: %', v_sku, v_current_stock, p_quantity;
  END IF;

  UPDATE public.product_variants
  SET 
    inventory_quantity = inventory_quantity - p_quantity,
    is_in_stock = (inventory_quantity - p_quantity) > 0,
    updated_at = now()
  WHERE id = p_variant_id;
END;
$$;
