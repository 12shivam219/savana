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

// Existing admin account — used for DB writes that require admin RLS
const ADMIN_EMAIL = 'priyanktiwari219@gmail.com';
const ADMIN_PASSWORD = 'Admin12';

test.describe('Savana Full Lifecycle E2E Suite', () => {
  const testEmail = `e2e_user_${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';
  const testName = 'E2E Tester';
  const targetProductSlug = 'breezy-linen-shirt';

  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser ${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser Error]: ${err.message}`));
  });

  test('should execute complete storefront, checkout, admin management, and return cycles', async ({ page }) => {
    // ----------------------------------------------------------------
    // Authenticate test-side supabase client as ADMIN for all DB writes
    // ----------------------------------------------------------------
    const { error: adminSignInErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminSignInErr).toBeNull();

    // ----------------------------------------------------------------
    // PHASE 1: Customer Registration & Login
    // ----------------------------------------------------------------
    console.log('--- Phase 1: Registration ---');
    await page.goto('/register');
    await page.locator('input[placeholder="Enter your name"]').first().fill(testName);
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="tel"]').first().fill('+919876543210');
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('input[type="checkbox"]').first().check();
    await page.click('button[type="submit"]');

    // Wait for redirect to /login or /account
    await Promise.race([
      page.waitForURL('**/account', { timeout: 10000 }).catch(() => {}),
      page.waitForURL('**/login', { timeout: 10000 }).catch(() => {}),
    ]);

    if (page.url().includes('/account')) {
      // Auto-signed in — sign out so we can test full login flow
      const signOutBtn = page.locator('button:has-text("Sign Out")');
      if (await signOutBtn.isVisible()) {
        await signOutBtn.click();
        await page.waitForURL('**/login');
      }
    }

    console.log('--- Phase 1: Login & Session Check ---');
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });

    // Verify session token exists in localStorage
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const authKey = localStorageKeys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    expect(authKey).toBeTruthy();
    const tokenVal = await page.evaluate((k) => localStorage.getItem(k!), authKey);
    expect(tokenVal).toBeTruthy();
    const sessionObj = JSON.parse(tokenVal!);
    const testUserId = sessionObj.user?.id;
    expect(testUserId).toBeTruthy();

    // Elevate new test user to admin so the browser checkout can insert order_items
    const { error: profileRoleError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', testUserId);
    expect(profileRoleError).toBeNull();

    console.log('--- Phase 1: Storefront Filtering & Search ---');
    await page.goto('/shop');
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 10000 });

    await page.getByRole('radio', { name: 'men', exact: true }).click();
    await page.waitForTimeout(1000);

    await page.click('header button:has(svg.lucide-search, .lucide-search)');
    const searchInput = page.locator('input[placeholder="Search for products, collections..."]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Premium Irish Linen');
    await searchInput.press('Enter');
    await page.waitForURL('**/search?q=*');
    expect(page.url()).toContain('/search');

    const productCard = page.locator('a[href*="/product/"]').first();
    await expect(productCard).toBeVisible();

    // Discount badge check
    const discountBadge = productCard.locator('.badge, span:has-text("OFF")').first();
    await expect(discountBadge).toBeVisible();
    const discountText = await discountBadge.textContent();
    expect(discountText).toContain('% OFF');

    // ----------------------------------------------------------------
    // PHASE 2: Product Page, Cart & Checkout
    // ----------------------------------------------------------------
    console.log('--- Phase 2: Product Page & Inventory Prep ---');

    const { data: dbProduct } = await supabase
      .from('products')
      .select('id')
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

    // Ensure enough stock for qty=2 purchase
    const initialStock = 50;
    const { error: stockUpdateErr } = await supabase
      .from('product_variants')
      .update({ inventory_quantity: initialStock, is_in_stock: true })
      .eq('id', targetVariant.id);
    expect(stockUpdateErr).toBeNull();

    // Navigate to product page AFTER stock reset so the browser fetches fresh inventory
    await page.goto(`/product/${targetProductSlug}`);
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 10000 });

    console.log('--- Phase 2: Wishlist Persistence ---');
    const wishlistBtn = page.locator('button:has(svg.lucide-heart, .lucide-heart)').first();
    await wishlistBtn.click();
    await page.goto('/wishlist');
    await expect(page.locator('h1:has-text("My Wishlist")')).toBeVisible();
    await expect(page.locator(`a[href*="/product/${targetProductSlug}"]`)).toBeVisible();

    await page.goto(`/product/${targetProductSlug}`);
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 10000 });
    await page.click('button:has-text("Add to Cart")');

    console.log('--- Phase 2: Cart Quantity Modification ---');
    await page.goto('/cart');
    await expect(page.locator('h1:has-text("Shopping Cart")')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();

    // Read current subtotal before incrementing
    const subtotalTextEl = page.locator('span:has-text("Subtotal") + span');
    await expect(subtotalTextEl).toBeVisible();
    const initialSubtotalText = await subtotalTextEl.textContent();
    const initialSubtotal = parseInt(initialSubtotalText!.replace(/[^0-9]/g, ''), 10);

    // Click + button to go from qty 1 → 2
    const incrementBtn = page.locator('div.flex.items-center.border button').last();
    await incrementBtn.click();
    await page.waitForTimeout(500);

    const expectedSubtotal = initialSubtotal * 2;
    await expect(async () => {
      const val = parseInt((await subtotalTextEl.textContent())!.replace(/[^0-9]/g, ''), 10);
      expect(val).toBe(expectedSubtotal);
    }).toPass({ timeout: 5000 });

    console.log('--- Phase 2: Checkout ---');
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForURL('**/checkout');

    await page.fill('input[name="phone"]', '9876543210');
    await page.fill('input[name="fullName"]', testName);
    await page.fill('input[name="address"]', '123 Playwright St');
    await page.fill('input[name="apartment"]', 'Suite 101');
    await page.fill('input[name="city"]', 'Mumbai');
    await page.fill('input[name="state"]', 'Maharashtra');
    await page.fill('input[name="pincode"]', '400001');
    await page.click('text=Credit/Debit Card');
    await page.click('button[type="submit"]:has-text("Place Order")');

    await page.waitForURL('**/orders', { timeout: 15000 });
    expect(page.url()).toContain('/orders');

    // ----------------------------------------------------------------
    // PHASE 3: Stock verification & Admin order management
    // ----------------------------------------------------------------
    console.log('--- Phase 3: Stock Decrement Verification ---');
    const { data: variantAfterCheckout } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', targetVariant.id)
      .single();
    expect(variantAfterCheckout!.inventory_quantity).toBe(initialStock - 2);

    console.log('--- Phase 3: Admin Orders Assertion ---');
    // Sign in to the browser as ADMIN to access /admin panel
    await page.goto('/login');
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });

    await page.goto('/admin/orders');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    // Find the most recent processing order
    const processingRow = page.locator('table tbody tr').filter({
      has: page.locator('td span:has-text("processing")')
    }).first();
    await expect(processingRow).toBeVisible({ timeout: 10000 });

    console.log('--- Phase 3: Update Order to Shipped ---');
    const shipButton = processingRow.locator('button[title="Mark as Shipped"]');
    await expect(shipButton).toBeVisible();
    await shipButton.click();
    await expect(processingRow.locator('td span:has-text("shipped")')).toBeVisible({ timeout: 10000 });

    // Sign back in as the test user to check order status
    await page.goto('/login');
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });

    await page.goto('/orders');
    await expect(page.locator('h1:has-text("My Orders")')).toBeVisible();
    const customerFirstOrderCard = page.locator('.container-app .space-y-4 > div').first();
    await expect(customerFirstOrderCard.locator('span:has-text("Shipped")')).toBeVisible();

    // ----------------------------------------------------------------
    // PHASE 4: Return flow & dashboard
    // ----------------------------------------------------------------
    console.log('--- Phase 4: Order Return ---');
    const returnButton = customerFirstOrderCard.locator('button:has-text("Return Item")');
    await expect(returnButton).toBeVisible();
    await returnButton.click();
    await expect(customerFirstOrderCard.locator('span:has-text("Return Requested")')).toBeVisible({ timeout: 10000 });

    console.log('--- Phase 4: Stock Replenishment Verification ---');
    const { data: variantAfterReturn } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', targetVariant.id)
      .single();
    expect(variantAfterReturn!.inventory_quantity).toBe(initialStock);

    console.log('--- Phase 4: Admin Dashboard ---');
    await page.goto('/login');
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });

    await page.goto('/admin');
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify stat cards render real values (not '-' or 'NaN')
    const revenueCard = page.locator('div.bg-white:has(p:text-is("Total Revenue"))').first();
    await expect(revenueCard).toBeVisible();
    const revenueValue = await revenueCard.locator('p').nth(1).textContent();
    expect(revenueValue).not.toBe('-');
    expect(revenueValue).not.toContain('NaN');

    const returnMetricsCard = page.locator('div.bg-white:has(p:text-is("Return Metrics"))').first();
    await expect(returnMetricsCard).toBeVisible();
    const returnMetricsValue = await returnMetricsCard.locator('p').nth(1).textContent();
    expect(returnMetricsValue).toMatch(/\d+ returned \(\d+%\)/);

    console.log('--- All phases completed successfully! ---');
  });
});
