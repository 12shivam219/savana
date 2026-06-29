// Reproduce the concurrency failure: 5 concurrent calls with same idempotency_key
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

  // Reset stock to 50
  const { data: bp } = await supabase.from('products').select('id, sale_price, base_price').eq('slug', 'breezy-linen-shirt').single();
  const { data: variants } = await supabase.from('product_variants').select('id').eq('product_id', bp.id).order('id').limit(1);
  const variant = variants[0];
  await supabase.from('product_variants').update({ inventory_quantity: 50, is_in_stock: true }).eq('product_id', bp.id);

  const unitPrice = Number(bp.sale_price);
  const idempotencyKey = `idem-${Date.now()}-${Math.random()}`;
  const orderNumber = `DBGCONC${Date.now()}`;

  const args = {
    p_order_number: orderNumber,
    p_subtotal: unitPrice,
    p_tax_amount: 0,
    p_shipping_amount: 0,
    p_discount_amount: 0,
    p_total: unitPrice,
    p_billing_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
    p_shipping_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
    p_payment_method: 'cod',
    p_payment_status: 'pending',
    p_items: [
      {
        product_id: bp.id, variant_id: variant.id, quantity: 1,
        unit_price: unitPrice, total_price: unitPrice,
        product_name: 'X', product_image: '/placeholder.svg', size: 'M', color: 'X',
      },
    ],
    p_redeemed_points: 0,
    p_coupon_code: null,
    p_idempotency_key: idempotencyKey,
  };

  console.log('Firing 5 concurrent place_order with same key...');
  const results = await Promise.allSettled([
    supabase.rpc('place_order', args),
    supabase.rpc('place_order', args),
    supabase.rpc('place_order', args),
    supabase.rpc('place_order', args),
    supabase.rpc('place_order', args),
  ]);

  let okCount = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const v = r.value;
      if (v.data) {
        okCount++;
        console.log(`  [${i}] OK: order ${v.data}`);
      } else {
        console.log(`  [${i}] FAILED error:`, v.error?.message, '| hint:', v.error?.hint);
      }
    } else {
      console.log(`  [${i}] REJECTED:`, r.reason?.message || r.reason);
    }
  });
  console.log(`OK count: ${okCount}`);

  const { data: orders } = await supabase.from('orders').select('id, order_number').eq('idempotency_key', idempotencyKey);
  console.log('Orders with this idempotency_key:', orders?.length, orders);
}

main().catch((e) => console.error('SCRIPT ERROR:', e));