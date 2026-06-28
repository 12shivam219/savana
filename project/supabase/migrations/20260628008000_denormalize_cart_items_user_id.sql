-- Add user_id column directly to cart_items table for denormalization
-- This prevents the real-time subscription DDoS vulnerability by allowing clients to filter by user_id.

ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill user_id from public.carts
UPDATE public.cart_items ci
SET user_id = c.user_id
FROM public.carts c
WHERE ci.cart_id = c.id;

-- Create set_cart_items_user_id trigger function
CREATE OR REPLACE FUNCTION public.set_cart_items_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.carts WHERE id = NEW.cart_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on cart_items BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS tr_set_cart_items_user_id ON public.cart_items;
CREATE TRIGGER tr_set_cart_items_user_id
  BEFORE INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cart_items_user_id();

-- Recreate index on user_id for fast queries and Realtime filtering
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

-- Update RLS policies for cart_items to leverage user_id directly
DROP POLICY IF EXISTS "cart_items_own_all" ON public.cart_items;
CREATE POLICY "cart_items_own_all" ON public.cart_items FOR ALL
  TO authenticated USING (
    tenant_id = public.get_current_tenant_id() AND (user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()
    ))
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id() AND (user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.carts WHERE id = cart_id AND user_id = auth.uid()
    ))
  );
