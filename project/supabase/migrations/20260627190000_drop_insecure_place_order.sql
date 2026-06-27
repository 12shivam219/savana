-- Drop the insecure 12-argument place_order function overload to prevent client-side forgery and bypass of tax/shipping amounts
DROP FUNCTION IF EXISTS public.place_order(
  p_order_number text,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_shipping_amount numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_billing_address jsonb,
  p_shipping_address jsonb,
  p_payment_method text,
  p_payment_status text,
  p_items jsonb,
  p_redeemed_points integer
);
