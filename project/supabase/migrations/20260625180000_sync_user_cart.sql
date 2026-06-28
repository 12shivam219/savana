-- Create public.sync_user_cart function to perform atomic cart synchronization
CREATE OR REPLACE FUNCTION public.sync_user_cart(
  p_cart_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete items where the actual stock in the database is 0
  DELETE FROM public.cart_items 
  WHERE cart_id = p_cart_id 
    AND variant_id IN (
      SELECT id FROM public.product_variants WHERE inventory_quantity <= 0
    );

  -- Delete only the items missing from the payload
  IF jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
    DELETE FROM public.cart_items 
    WHERE cart_id = p_cart_id 
      AND variant_id NOT IN (
        SELECT (item->>'variant_id')::uuid 
        FROM jsonb_array_elements(p_items) AS item
      );

    -- Insert/update the rest (UPSERT), capping quantity to actual stock levels
    INSERT INTO public.cart_items (cart_id, product_id, variant_id, quantity)
    SELECT 
      p_cart_id,
      (item->>'product_id')::uuid,
      (item->>'variant_id')::uuid,
      LEAST(pv.inventory_quantity, (item->>'quantity')::integer)
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.product_variants pv ON pv.id = (item->>'variant_id')::uuid
    WHERE pv.inventory_quantity > 0
    ON CONFLICT (cart_id, variant_id) 
    DO UPDATE SET quantity = EXCLUDED.quantity;
  ELSE
    DELETE FROM public.cart_items WHERE cart_id = p_cart_id;
  END IF;
END;
$$;
