-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily midnight cleanup job for abandoned carts (updated_at older than 30 days)
-- Note: deleting from public.carts will automatically cascade delete entries in public.cart_items
SELECT cron.schedule(
  'cleanup-phantom-carts',
  '0 0 * * *',
  $$ DELETE FROM public.carts WHERE updated_at < now() - INTERVAL '30 days' $$
);
