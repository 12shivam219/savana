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
  -- Delete all existing items for the cart
  DELETE FROM public.cart_items WHERE cart_id = p_cart_id;

  -- Insert new items from the jsonb array
  IF jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.cart_items (cart_id, product_id, variant_id, quantity)
    SELECT 
      p_cart_id,
      (item->>'product_id')::uuid,
      (item->>'variant_id')::uuid,
      (item->>'quantity')::integer
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
END;
$$;
