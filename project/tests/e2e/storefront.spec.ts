import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve .env file relative to tests directory
const envPath = path.resolve(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
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

// Use the existing admin account — avoids registration and RLS elevation complexity
const ADMIN_EMAIL = '12shivamtiwari219@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';

test.describe('E-Commerce Storefront Journey', () => {
  const testName = 'E2E Test User';
  const targetProductSlug = 'flowy-maxi-dress';

  test('should complete standard storefront purchase flow & decrement inventory', async ({ page }) => {
    // ----------------------------------------------------------------
    // 0. Authenticate test-side supabase client and clear admin's cart
    // to prevent accumulated items from previous tests from messing up expectations
    // ----------------------------------------------------------------
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(authErr).toBeNull();
    expect(authData.user).toBeTruthy();

    const { data: adminCart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', authData.user!.id)
      .maybeSingle();
    if (adminCart) {
      await supabase.from('cart_items').delete().eq('cart_id', adminCart.id);
    }

    // ----------------------------------------------------------------
    // 1. Sign in as admin user
    // ----------------------------------------------------------------
    await page.goto('/login');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });
    expect(page.url()).toContain('/account');

    // ----------------------------------------------------------------
    // 2. Reset target variant stock to a known value BEFORE page load
    // ----------------------------------------------------------------
    const { data: dbProduct } = await supabase
      .from('products')
      .select('id, base_price, sale_price')
      .eq('slug', targetProductSlug)
      .single();
    expect(dbProduct).toBeTruthy();

    const initialStock = 50;
    const { error: stockResetErr } = await supabase
      .from('product_variants')
      .update({ inventory_quantity: initialStock, is_in_stock: true })
      .eq('product_id', dbProduct!.id);
    expect(stockResetErr).toBeNull();

    // ----------------------------------------------------------------
    // 3. Navigate to the product page and verify it loads
    // ----------------------------------------------------------------
    await page.goto(`/product/${targetProductSlug}`);
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 10000 });

    const productName = await page.locator('h1').textContent();
    const productPriceText = await page.locator('.price, .price-sale').first().textContent();
    expect(productName).toBeTruthy();
    expect(productPriceText).toBeTruthy();

    // Verify price matches database
    const dbPrice = dbProduct?.sale_price || dbProduct?.base_price;
    const pagePriceNum = parseInt(productPriceText!.replace(/[^0-9]/g, ''), 10);
    expect(pagePriceNum).toEqual(dbPrice);

    // Verify variant stock matches the reset value
    const { data: dbVariantsCheck } = await supabase
      .from('product_variants')
      .select('id, inventory_quantity')
      .eq('product_id', dbProduct!.id)
      .order('id', { ascending: true });
    expect(dbVariantsCheck![0].inventory_quantity).toBe(initialStock);

    // ----------------------------------------------------------------
    // 4. Add to cart → open drawer → proceed to checkout
    // ----------------------------------------------------------------
    await page.click('button:has-text("Add to Cart")');
    await page.click('header button:has(svg.lucide-shopping-bag)');
    await expect(page.locator('h2:has-text("Shopping Cart")')).toBeVisible();
    await page.click('button:has-text("Proceed to Secure Checkout")');
    await page.waitForURL('**/checkout');

    // ----------------------------------------------------------------
    // 5. Fill checkout form and place order
    // ----------------------------------------------------------------
    await page.fill('input[name="fullName"]', testName);
    await page.fill('input[name="phone"]', '9876543210');
    await page.fill('input[name="address"]', '123 E2E Street, Tech Park');
    await page.fill('input[name="apartment"]', 'Block A, Suite 404');
    await page.fill('input[name="city"]', 'Bengaluru');
    await page.fill('input[name="state"]', 'Karnataka');
    await page.fill('input[name="pincode"]', '560001');
    await page.click('text=Credit/Debit Card');
    await page.click('button[type="submit"]:has-text("Place Order")');

    await page.waitForURL('**/orders', { timeout: 15000 });
    expect(page.url()).toContain('/orders');

    // ----------------------------------------------------------------
    // 6. Verify order was created in DB
    // ----------------------------------------------------------------
    const { data: dbOrders, error: orderFetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', authData.user!.id)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(orderFetchErr).toBeNull();
    expect(dbOrders!.length).toBeGreaterThan(0);
    const dbOrder = dbOrders![0];
    expect(dbOrder.status).toBe('PAID');
    expect(dbOrder.payment_status).toBe('completed');

    // Fetch the order items to find out which variant was actually purchased
    const { data: dbOrderItems, error: itemsFetchErr } = await supabase
      .from('order_items')
      .select('variant_id, quantity')
      .eq('order_id', dbOrder.id);
    expect(itemsFetchErr).toBeNull();
    expect(dbOrderItems!.length).toBeGreaterThan(0);
    const purchasedVariantId = dbOrderItems![0].variant_id;
    const purchasedQty = dbOrderItems![0].quantity;

    // ----------------------------------------------------------------
    // 7. Verify inventory decremented
    // ----------------------------------------------------------------
    const { data: updatedVariant } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', purchasedVariantId)
      .single();

    expect(updatedVariant).toBeTruthy();
    expect(updatedVariant!.inventory_quantity).toBe(initialStock - purchasedQty);
  });
});
