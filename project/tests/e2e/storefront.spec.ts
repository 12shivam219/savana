import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://evzlqrekovjimofgddwj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2emxxcmVrb3ZqaW1vZmdkZHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjMyNTksImV4cCI6MjA5NzQzOTI1OX0.dibnBJJe1RtuKZsMrL6A7SlKl3e9gv4fFCkDuAJXhW8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Use the existing admin account — avoids registration and RLS elevation complexity
const ADMIN_EMAIL = 'priyanktiwari219@gmail.com';
const ADMIN_PASSWORD = 'Admin12';

test.describe('E-Commerce Storefront Journey', () => {
  const testName = 'E2E Test User';
  const targetProductSlug = 'flowy-maxi-dress';

  test('should complete standard storefront purchase flow & decrement inventory', async ({ page }) => {
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

    // Authenticate test-side supabase client to allow DB writes
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(authErr).toBeNull();
    expect(authData.user).toBeTruthy();

    // ----------------------------------------------------------------
    // 2. Reset target variant stock to a known value BEFORE page load
    // ----------------------------------------------------------------
    const { data: dbProduct } = await supabase
      .from('products')
      .select('id, base_price, sale_price')
      .eq('slug', targetProductSlug)
      .single();
    expect(dbProduct).toBeTruthy();

    const { data: dbVariants } = await supabase
      .from('product_variants')
      .select('id, inventory_quantity')
      .eq('product_id', dbProduct!.id)
      .order('id', { ascending: true });
    expect(dbVariants).toBeTruthy();
    expect(dbVariants!.length).toBeGreaterThan(0);

    const targetVariant = dbVariants![0];
    const initialStock = 50;
    const { error: stockResetErr } = await supabase
      .from('product_variants')
      .update({ inventory_quantity: initialStock, is_in_stock: true })
      .eq('id', targetVariant.id);
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
    expect(dbOrders![0].status).toBe('processing');
    expect(dbOrders![0].payment_status).toBe('completed');

    // ----------------------------------------------------------------
    // 7. Verify inventory decremented by 1
    // ----------------------------------------------------------------
    const { data: updatedVariant } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', targetVariant.id)
      .single();

    expect(updatedVariant).toBeTruthy();
    expect(updatedVariant!.inventory_quantity).toBe(initialStock - 1);
  });
});
