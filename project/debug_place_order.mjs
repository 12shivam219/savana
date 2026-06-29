// Try calling place_order directly with admin to see the real error.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envContent = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...rest] = line.split('=');
  if (k) env[k.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: '12shivamtiwari219@gmail.com',
    password: 'Admin@123',
  });
  if (authErr) {
    console.log('AUTH FAILED:', authErr.message);
    return;
  }

  // Get a variant
  const { data: bp } = await supabase
    .from('products')
    .select('id, sale_price, base_price, slug')
    .eq('slug', 'breezy-linen-shirt')
    .single();
  console.log('Product:', bp);

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, sku, inventory_quantity, tenant_id')
    .eq('product_id', bp.id)
    .order('id')
    .limit(1);
  const variant = variants[0];
  console.log('Variant:', variant);

  const unitPrice = Number(bp.sale_price ?? bp.base_price);
  const subtotal = unitPrice;
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const shipping = subtotal >= 999 ? 0 : 99;
  const total = Math.max(0, subtotal + tax + shipping);

  console.log('Expected subtotal:', subtotal, 'tax:', tax, 'shipping:', shipping, 'total:', total);

  // Try a single place_order call
  const { data, error } = await supabase.rpc('place_order', {
    p_order_number: `DBG${Date.now()}`,
    p_subtotal: subtotal,
    p_tax_amount: tax,
    p_shipping_amount: shipping,
    p_discount_amount: 0,
    p_total: total,
    p_billing_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
    p_shipping_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
    p_payment_method: 'cod',
    p_payment_status: 'pending',
    p_items: [
      {
        product_id: bp.id,
        variant_id: variant.id,
        quantity: 1,
        unit_price: unitPrice,
        total_price: unitPrice,
        product_name: 'X',
        product_image: '/placeholder.svg',
        size: 'M',
        color: 'X',
      },
    ],
    p_redeemed_points: 0,
    p_coupon_code: null,
    p_idempotency_key: `dbg-${Date.now()}`,
  });

  console.log('place_order data:', data);
  console.log('place_order error:', error);
  if (error) console.log('  message:', error.message, '| details:', error.details, '| hint:', error.hint);
}

main().catch((e) => console.error('SCRIPT ERROR:', e));