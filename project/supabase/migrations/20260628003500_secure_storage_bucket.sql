-- Create the product-images bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist to prevent conflict
DROP POLICY IF EXISTS "Allow public read-only access to product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin to insert product images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin to delete/update product images" ON storage.objects;

-- Create RLS policies for the product-images bucket
-- 1. Public Read-only access
CREATE POLICY "Allow public read-only access to product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- 2. Insert access for authenticated admin users
CREATE POLICY "Allow admin to insert product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' 
  AND (public.is_admin_check(auth.uid()))
);

-- 3. Delete/Update access for authenticated admin users
CREATE POLICY "Allow admin to delete/update product images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'product-images' 
  AND (public.is_admin_check(auth.uid()))
)
WITH CHECK (
  bucket_id = 'product-images' 
  AND (public.is_admin_check(auth.uid()))
);
