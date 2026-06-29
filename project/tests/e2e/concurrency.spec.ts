import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from .env file.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const ADMIN_EMAIL = '12shivamtiwari219@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';

// Match the place_order RPC's server-side price recalculation so we
// don't trip the price-tampering guard. Tax is round(subtotal * 0.18, 2);
// shipping is 0 if subtotal >= 999, else 99; total is the canonical sum.
function serverPrices(unitPrice: number, qty: number, discount: number = 0) {
  const subtotal = unitPrice * qty;
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const shipping = subtotal >= 999 ? 0 : 99;
  const total = Math.max(0, subtotal + tax + shipping - discount);
  return {
    p_subtotal: subtotal,
    p_tax_amount: tax,
    p_shipping_amount: shipping,
    p_discount_amount: discount,
    p_total: total,
  };
}

test.describe('Concurrency: checkout, coupon, idempotency, inventory', () => {
  const targetProductSlug = 'breezy-linen-shirt';

  async function resetStock(adminClient: ReturnType<typeof createClient>, productId: string, qty: number) {
    const { error } = await adminClient
      .from('product_variants')
      .update({ inventory_quantity: qty, is_in_stock: true })
      .eq('product_id', productId);
    expect(error).toBeNull();
  }

  async function getFirstVariantId(adminClient: ReturnType<typeof createClient>, productId: string) {
    const { data, error } = await adminClient
      .from('product_variants')
      .select('id, inventory_quantity')
      .eq('product_id', productId)
      .order('id', { ascending: true })
      .limit(1)
      .single();
    expect(error).toBeNull();
    return data as { id: string; inventory_quantity: number };
  }

  test('place_order is idempotent under concurrent identical submissions', async () => {
    // Sign in as admin so we can mutate DB freely.
    const { error: adminErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr).toBeNull();

    const { data: product } = await supabase
      .from('products')
      .select('id, sale_price, base_price')
      .eq('slug', targetProductSlug)
      .single();
    expect(product).toBeTruthy();

    const variant = await getFirstVariantId(supabase, product!.id);
    await resetStock(supabase, product!.id, 50);

    const idempotencyKey = `idem-${Date.now()}-${Math.random()}`;
    const orderNumber = `SAVCONC${Date.now()}`;
    const unitPrice = Number(product!.sale_price ?? product!.base_price);
    const qty = 1;
    const prices = serverPrices(unitPrice, qty);

    const args = {
      p_order_number: orderNumber,
      p_subtotal: prices.p_subtotal,
      p_tax_amount: prices.p_tax_amount,
      p_shipping_amount: prices.p_shipping_amount,
      p_discount_amount: prices.p_discount_amount,
      p_total: prices.p_total,
      p_billing_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
      p_shipping_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
      p_payment_method: 'cod',
      p_payment_status: 'pending',
      p_items: [
        {
          product_id: product!.id,
          variant_id: variant.id,
          quantity: qty,
          unit_price: unitPrice,
          total_price: unitPrice * qty,
          product_name: 'X',
          product_image: '/placeholder.svg',
          size: 'M',
          color: 'X',
        },
      ],
      p_redeemed_points: 0,
      p_coupon_code: null,
      p_idempotency_key: idempotencyKey,
    };

    // Fire five concurrent calls with the SAME idempotency key.
    const results = await Promise.allSettled([
      supabase.rpc('place_order', args),
      supabase.rpc('place_order', args),
      supabase.rpc('place_order', args),
      supabase.rpc('place_order', args),
      supabase.rpc('place_order', args),
    ]);

    // Exactly one should succeed; the others must report either a unique
    // constraint violation or the same idempotent order id.
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const okResults = fulfilled.filter(
      (r) => (r as PromiseFulfilledResult<{ data: string | null; error: unknown }>).value.data,
    );

    expect(okResults.length).toBeGreaterThanOrEqual(1);

    // Verify only ONE order row exists for this idempotency_key.
    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('id')
      .eq('idempotency_key', idempotencyKey);
    expect(orderErr).toBeNull();
    expect(orders!.length).toBe(1);
  });

  test('inventory never goes negative under concurrent checkout bursts', async () => {
    const { error: adminErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr).toBeNull();

    const { data: product } = await supabase
      .from('products')
      .select('id, sale_price, base_price')
      .eq('slug', targetProductSlug)
      .single();
    expect(product).toBeTruthy();

    const variant = await getFirstVariantId(supabase, product!.id);
    const initialStock = 3;
    await resetStock(supabase, product!.id, initialStock);

    const unitPrice = Number(product!.sale_price ?? product!.base_price);

    async function placeOne(idx: number) {
      const idempotencyKey = `inv-${Date.now()}-${idx}-${Math.random()}`;
      const prices = serverPrices(unitPrice, 1);
      return supabase.rpc('place_order', {
        p_order_number: `SAVINV${Date.now()}${idx}`,
        p_subtotal: prices.p_subtotal,
        p_tax_amount: prices.p_tax_amount,
        p_shipping_amount: prices.p_shipping_amount,
        p_discount_amount: prices.p_discount_amount,
        p_total: prices.p_total,
        p_billing_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
        p_shipping_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
        p_payment_method: 'cod',
        p_payment_status: 'pending',
        p_items: [
          {
            product_id: product!.id,
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
        p_idempotency_key: idempotencyKey,
      });
    }

    // Fire 8 concurrent orders against a stock of 3.
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => placeOne(i)),
    );

    // Exactly 3 should succeed; the rest must fail with insufficient stock.
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const okCount = fulfilled.filter(
      (r) => (r as PromiseFulfilledResult<{ data: string | null; error: { message?: string } | null }>).value.data,
    ).length;
    expect(okCount).toBe(initialStock);

    // Final stock must be 0, never negative.
    const { data: after, error: afterErr } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', variant.id)
      .single();
    expect(afterErr).toBeNull();
    expect(after!.inventory_quantity).toBe(0);
  });

  test('coupon usage_limit is never exceeded under concurrency', async () => {
    const { error: adminErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr).toBeNull();

    // Pick or create a low-limit coupon.
    const couponCode = `LIMIT${Date.now()}`.slice(0, 12).toUpperCase();
    const { error: cErr } = await supabase.from('coupons').insert({
      code: couponCode,
      type: 'fixed',
      value: 1,
      min_order_amount: 0,
      usage_limit: 2,
      used_count: 0,
      valid_from: new Date(Date.now() - 60_000).toISOString(),
      valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      is_active: true,
    });
    expect(cErr).toBeNull();

    const { data: product } = await supabase
      .from('products')
      .select('id, sale_price, base_price')
      .eq('slug', targetProductSlug)
      .single();
    expect(product).toBeTruthy();

    const variant = await getFirstVariantId(supabase, product!.id);
    await resetStock(supabase, product!.id, 50);

    const unitPrice = Number(product!.sale_price ?? product!.base_price);

    async function placeOne(idx: number) {
      const prices = serverPrices(unitPrice, 1, 1);
      return supabase.rpc('place_order', {
        p_order_number: `SAVCUP${Date.now()}${idx}`,
        p_subtotal: prices.p_subtotal,
        p_tax_amount: prices.p_tax_amount,
        p_shipping_amount: prices.p_shipping_amount,
        p_discount_amount: prices.p_discount_amount,
        p_total: prices.p_total,
        p_billing_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
        p_shipping_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
        p_payment_method: 'cod',
        p_payment_status: 'pending',
        p_items: [
          {
            product_id: product!.id,
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
        p_coupon_code: couponCode,
        p_idempotency_key: `cup-${Date.now()}-${idx}`,
      });
    }

    // 6 concurrent attempts against a limit of 2.
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => placeOne(i)),
    );

    const okCount = results.filter((r) => {
      if (r.status !== 'fulfilled') return false;
      const v = r.value as { data: string | null; error: { message?: string } | null };
      return !!v.data;
    }).length;
    expect(okCount).toBe(2);

    const { data: coupon, error: coupErr } = await supabase
      .from('coupons')
      .select('used_count, usage_limit')
      .eq('code', couponCode)
      .single();
    expect(coupErr).toBeNull();
    expect(coupon!.used_count).toBeLessThanOrEqual(coupon!.usage_limit);
  });

  test('price-tampering attempt is rejected by place_order', async () => {
    const { error: adminErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminErr).toBeNull();

    const { data: product } = await supabase
      .from('products')
      .select('id, sale_price, base_price')
      .eq('slug', targetProductSlug)
      .single();
    expect(product).toBeTruthy();

    const variant = await getFirstVariantId(supabase, product!.id);
    await resetStock(supabase, product!.id, 10);

    const realUnitPrice = Number(product!.sale_price ?? product!.base_price);
    const tamperedTotal = 1; // try to buy for 1 INR
    const prices = serverPrices(realUnitPrice, 1);

    const { data, error } = await supabase.rpc('place_order', {
      p_order_number: `SAVTAMP${Date.now()}`,
      p_subtotal: prices.p_subtotal,
      p_tax_amount: prices.p_tax_amount,
      p_shipping_amount: prices.p_shipping_amount,
      p_discount_amount: prices.p_discount_amount,
      p_total: tamperedTotal,
      p_billing_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
      p_shipping_address: { full_name: 'X', phone: '0', address_line1: 'X', city: 'X', state: 'X', pincode: '000000' },
      p_payment_method: 'cod',
      p_payment_status: 'pending',
      p_items: [
        {
          product_id: product!.id,
          variant_id: variant.id,
          quantity: 1,
          unit_price: realUnitPrice,
          total_price: realUnitPrice,
          product_name: 'X',
          product_image: '/placeholder.svg',
          size: 'M',
          color: 'X',
        },
      ],
      p_redeemed_points: 0,
      p_coupon_code: null,
      p_idempotency_key: `tamp-${Date.now()}`,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/mismatch|tampering/);
  });
});