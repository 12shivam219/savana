-- Add a generated tsvector column to products for name and description search
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tsv_name tsvector 
GENERATED ALWAYS AS (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))) STORED;

-- Create GIN index for optimal sub-millisecond full-text searches
CREATE INDEX IF NOT EXISTS idx_products_tsv_name ON public.products USING gin(tsv_name);

-- Create a search function that uses the tsvector column and websearch_to_tsquery
CREATE OR REPLACE FUNCTION public.search_products(p_query text)
RETURNS SETOF public.products
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.products
  WHERE 
    tsv_name @@ websearch_to_tsquery('english', p_query)
    OR name ILIKE '%' || p_query || '%'
  ORDER BY 
    ts_rank(tsv_name, websearch_to_tsquery('english', p_query)) DESC,
    name ASC;
$$;
