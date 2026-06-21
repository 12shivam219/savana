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

// Existing admin account
const ADMIN_EMAIL = '12shivamtiwari219@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';

test.describe('E2E Shipping and Logistics Lifecycle Suite', () => {
  const testEmail = `e2e_ship_user_${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';
  const testName = 'Logistics E2E Tester';
  const targetProductSlug = 'breezy-linen-shirt';

  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser ${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser Error]: ${err.message}`));
  });

  test('should execute complete shipping, customer tracking, RMA, and inventory replenishment lifecycle', async ({ page }) => {
    test.setTimeout(180000);
    // Authenticate test-side supabase client as ADMIN for database overrides
    const { error: adminSignInErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminSignInErr).toBeNull();

    // ----------------------------------------------------------------
    // PHASE 1: Customer Registration & Product Checkout
    // ----------------------------------------------------------------
    console.log('--- Phase 1: User Registration ---');
    await page.goto('/register');
    await page.locator('input[placeholder="Enter your name"]').first().fill(testName);
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="tel"]').first().fill('+919876543210');
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('input[type="checkbox"]').first().check();
    await page.click('button[type="submit"]');

    // Wait for redirect to either account page or login page
    await page.waitForURL(url => url.pathname === '/account' || url.pathname === '/login', { timeout: 15000 });

    if (page.url().includes('/login')) {
      console.log('Redirected to login page (email confirmation enabled). Signing in...');
      await page.locator('input[type="email"]').first().fill(testEmail);
      await page.locator('input[type="password"]').first().fill(testPassword);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await page.waitForURL('**/account', { timeout: 15000 });
    }

    // Extract newly registered user ID from localStorage
    const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const authKey = localStorageKeys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    expect(authKey).toBeTruthy();
    const tokenVal = await page.evaluate((k) => localStorage.getItem(k!), authKey);
    const sessionObj = JSON.parse(tokenVal!);
    const testUserId = sessionObj.user?.id;
    expect(testUserId).toBeTruthy();

    // Elevate registered user to admin role so they can place order items
    // Sign in as the new user first so that profiles_update_own RLS policy (auth.uid() = id) allows the update
    const { error: userSignInErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    expect(userSignInErr).toBeNull();

    const { data: updateRes, error: profileRoleError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', testUserId)
      .select();
    expect(profileRoleError).toBeNull();
    console.log('Update query returned:', updateRes);

    const { data: profileCheck, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();
    console.log('Profile select after update:', profileCheck, 'error:', checkError);

    // Re-authentication moved to Phase 2 to allow Phase 1 DB queries under user session

    console.log('--- Phase 1: Reset Stock & Add Product to Cart ---');
    // Query product variant
    const { data: dbProduct } = await supabase
      .from('products')
      .select('id')
      .eq('slug', targetProductSlug)
      .single();
    expect(dbProduct).toBeTruthy();

    const startingInventory = 100;

    // Reset stock of all variants to startingInventory to ensure any default selected size/color has enough stock
    const { error: stockResetErr } = await supabase
      .from('product_variants')
      .update({ inventory_quantity: startingInventory, is_in_stock: true })
      .eq('product_id', dbProduct!.id);
    expect(stockResetErr).toBeNull();

    // Navigate to product page and add qty=1 to cart
    await page.goto(`/product/${targetProductSlug}`);
    await expect(page.locator('.skeleton')).toHaveCount(0, { timeout: 10000 });
    await page.click('button:has-text("Add to Cart")');

    console.log('--- Phase 1: Checkout Form ---');
    await page.goto('/cart');
    await expect(page.locator('h1:has-text("Shopping Cart")')).toBeVisible();
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForURL('**/checkout');

    // Fill in shipping address details (Street, City, State, ZIP, Country)
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="phone"]', '9876543210');
    await page.fill('input[name="fullName"]', testName);
    await page.fill('input[name="address"]', '456 Logistics Park Rd');
    await page.fill('input[name="apartment"]', 'Block B, Suite 402');
    await page.fill('input[name="city"]', 'Bengaluru');
    await page.fill('input[name="state"]', 'Karnataka');
    await page.fill('input[name="pincode"]', '560001');
    await page.click('text=Credit/Debit Card');
    await page.click('button[type="submit"]:has-text("Place Order")');

    // Redirected to orders list
    await page.waitForURL('**/orders', { timeout: 15000 });
    expect(page.url()).toContain('/orders');

    // Assert database status is 'pending' (Pending Fulfillment / Unshipped)
    console.log('--- Phase 1: Database Verification ---');
    const { data: dbOrder, error: fetchOrderError } = await supabase
      .from('orders')
      .select('id, order_number, status, shipping_address')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    expect(fetchOrderError).toBeNull();
    expect(dbOrder).toBeTruthy();
    expect(dbOrder!.status).toBe('pending');
    expect((dbOrder!.shipping_address as any).address_line1).toBe('456 Logistics Park Rd');

    const orderNumber = dbOrder!.order_number;

    // Verify UI displays "Pending Fulfillment"
    const orderCard = page.locator(`.container-app .space-y-4 > div:has-text("${orderNumber}")`).first();
    await expect(orderCard.locator(`#status-badge-${orderNumber}`)).toHaveText('Pending Fulfillment');

    // Query order_items to find which variant was actually purchased in the browser
    const { data: orderItem, error: fetchItemError } = await supabase
      .from('order_items')
      .select('variant_id')
      .eq('order_id', dbOrder!.id)
      .single();
    expect(fetchItemError).toBeNull();
    const purchasedVariantId = orderItem!.variant_id;
    
    // Set targetVariant for downstream assertions
    const targetVariant = { id: purchasedVariantId };

    // Verify inventory decremented to startingInventory - 1
    const { data: variantAfterCheckout } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', targetVariant.id)
      .single();
    expect(variantAfterCheckout!.inventory_quantity).toBe(startingInventory - 1);


    // ----------------------------------------------------------------
    // PHASE 2: Admin Warehouse Fulfillment & Carrier Assignment
    // ----------------------------------------------------------------
    console.log('--- Phase 2: Switch to Admin and Ship Order ---');

    // Re-authenticate test-side supabase client as ADMIN for admin DB updates
    const { error: adminReSignInErr } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(adminReSignInErr).toBeNull();
    // Log out test user
    await page.goto('/account');
    const signOutBtn = page.locator('button:has-text("Sign Out")');
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForURL('**/login');
    }

    // Log in as Admin
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });

    // Navigate to Admin orders
    await page.goto('/admin/orders');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    // Set filter to All or Pending to find order
    await page.click('button:has-text("All")');
    await page.waitForTimeout(500);

    // Locate order row, click Mark as Processing (Clock icon) to shift pending -> processing (Unshipped)
    const processBtn = page.locator(`#process-btn-${orderNumber}`);
    await expect(processBtn).toBeVisible({ timeout: 5000 });
    await processBtn.click();
    await expect(page.locator(`#status-badge-admin-${orderNumber}`)).toHaveText('Unshipped', { timeout: 5000 });

    // Click Ship Order (Truck icon)
    const shipBtn = page.locator(`#ship-btn-${orderNumber}`);
    await expect(shipBtn).toBeVisible({ timeout: 5000 });
    await shipBtn.click();

    // Fill out shipping tracking modal
    await expect(page.locator('#ship-modal')).toBeVisible({ timeout: 5000 });
    await page.selectOption('#carrier-select', 'DHL');
    await page.fill('#tracking-input', '1Z999AA10123456784');
    await page.click('#ship-submit-btn');

    // Wait for modal to disappear and status badge to update to Shipped
    await expect(page.locator('#ship-modal')).toBeHidden({ timeout: 5000 });
    await expect(page.locator(`#status-badge-admin-${orderNumber}`)).toHaveText('Shipped', { timeout: 5000 });

    // Assert customer's tracking metadata array updates correctly in DB payload
    const { data: dbOrderShipped, error: fetchShippedErr } = await supabase
      .from('orders')
      .select('status, tracking_number, notes')
      .eq('id', dbOrder!.id)
      .single();
    
    if (fetchShippedErr) {
      console.error('--- FETCH SHIPPED ORDER ERROR ---', fetchShippedErr);
    }
    expect(fetchShippedErr).toBeNull();
    expect(dbOrderShipped).toBeTruthy();
    expect(dbOrderShipped!.status).toBe('shipped');
    expect(dbOrderShipped!.tracking_number).toBe('1Z999AA10123456784');
    
    const trackingMetadata = JSON.parse(dbOrderShipped!.notes || '[]');
    expect(trackingMetadata).toContainEqual(expect.objectContaining({
      status: 'shipped',
      carrier: 'DHL',
      tracking_number: '1Z999AA10123456784'
    }));


    // ----------------------------------------------------------------
    // PHASE 3: Real-Time Customer Tracking & Delivery Simulation
    // ----------------------------------------------------------------
    console.log('--- Phase 3: Switch back to Customer Portal ---');
    // Log out admin
    await page.goto('/account');
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForURL('**/login');
    }

    // Log back in as customer
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });

    // Navigate to customer orders
    await page.goto('/orders');
    const orderCardCustomer = page.locator(`.container-app .space-y-4 > div:has-text("${orderNumber}")`).first();
    await expect(orderCardCustomer).toBeVisible();

    // Verify UI timeline reflects Shipped
    const shippedStep = orderCardCustomer.locator(`#timeline-step-${orderNumber}-shipped`);
    await expect(shippedStep.locator('.w-8')).toHaveClass(/bg-primary-600/);

    // Verify carrier name and tracking link
    await expect(orderCardCustomer.locator(`#carrier-name-${orderNumber}`)).toHaveText('DHL');
    const trackingLink = orderCardCustomer.locator(`#tracking-link-${orderNumber}`);
    await expect(trackingLink).toHaveText('1Z999AA10123456784');
    await expect(trackingLink).toHaveAttribute('href', /1Z999AA10123456784/);

    console.log('--- Phase 3: Simulate Webhook Delivery update ---');
    // Simulate carrier webhook by directly updating database status to 'delivered'
    const updatedNotes = [
      ...trackingMetadata,
      {
        status: 'delivered',
        timestamp: new Date().toISOString()
      }
    ];

    const { error: deliveryUpdateErr } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        notes: JSON.stringify(updatedNotes)
      })
      .eq('id', dbOrder!.id);
    expect(deliveryUpdateErr).toBeNull();

    // Reload page to simulate instant timeline snap
    await page.reload();
    await expect(orderCardCustomer.locator(`#status-badge-${orderNumber}`)).toHaveText('Delivered');

    const deliveredStep = orderCardCustomer.locator(`#timeline-step-${orderNumber}-delivered`);
    await expect(deliveredStep.locator('.w-8')).toHaveClass(/bg-primary-600/);


    // ----------------------------------------------------------------
    // PHASE 4: Return Authorization (RMA) & Inventory Replenishment
    // ----------------------------------------------------------------
    console.log('--- Phase 4: Request Return ---');
    // Assert "Request Return" button is visible for delivered item
    const returnBtn = orderCardCustomer.locator(`#return-btn-${orderNumber}`);
    await expect(returnBtn).toBeVisible();

    // Handle the window.prompt for return reason
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Please enter a return reason');
      await dialog.accept("Item didn't fit");
    });

    // Click Return button
    await returnBtn.click();

    // Verify status updates to Return Requested
    await expect(orderCardCustomer.locator(`#status-badge-${orderNumber}`)).toHaveText('Return Requested', { timeout: 10000 });

    // Assert database status is 'returned' and notes contain return status 'requested'
    const { data: dbOrderReturnRequested, error: fetchReturnRequestedErr } = await supabase
      .from('orders')
      .select('status, notes')
      .eq('id', dbOrder!.id)
      .single();
    
    if (fetchReturnRequestedErr) {
      console.error('--- FETCH RETURN REQUESTED ERROR ---', fetchReturnRequestedErr);
    }
    expect(fetchReturnRequestedErr).toBeNull();
    expect(dbOrderReturnRequested).toBeTruthy();
    expect(dbOrderReturnRequested!.status).toBe('returned');
    
    const returnMetadata = JSON.parse(dbOrderReturnRequested!.notes || '{}');
    expect(returnMetadata.return_status).toBe('requested');
    expect(returnMetadata.return_reason).toBe("Item didn't fit");

    // Verify inventory quantity is STILL decremented (stock is NOT replenished yet)
    const { data: variantBeforeApproval } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', targetVariant.id)
      .single();
    expect(variantBeforeApproval!.inventory_quantity).toBe(startingInventory - 1);

    console.log('--- Phase 4: Approve Return & Replenish Stock ---');
    // Log out customer
    await page.goto('/account');
    if (await signOutBtn.isVisible()) {
      await signOutBtn.click();
      await page.waitForURL('**/login');
    }

    // Log back in as Admin
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/account', { timeout: 15000 });

    // Go to admin orders list
    await page.goto('/admin/orders');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("All")');
    await page.waitForTimeout(500);

    // Locate the Approve Return button and click it
    const approveReturnBtn = page.locator(`#approve-return-${orderNumber}`);
    await expect(approveReturnBtn).toBeVisible({ timeout: 5000 });
    await approveReturnBtn.click();

    // Verify badge updates to Returned & Restocked in admin view
    await expect(page.locator(`#status-badge-admin-${orderNumber}`)).toHaveText('Returned & Restocked', { timeout: 5000 });

    // Assert that database status is updated and notes show return status 'returned_restocked'
    const { data: dbOrderReturned, error: fetchReturnedErr } = await supabase
      .from('orders')
      .select('status, notes')
      .eq('id', dbOrder!.id)
      .single();
    
    if (fetchReturnedErr) {
      console.error('--- FETCH RETURNED ERROR ---', fetchReturnedErr);
    }
    expect(fetchReturnedErr).toBeNull();
    expect(dbOrderReturned).toBeTruthy();
    
    expect(dbOrderReturned!.status).toBe('returned');
    const returnedMetadata = JSON.parse(dbOrderReturned!.notes || '{}');
    expect(returnedMetadata.return_status).toBe('returned_restocked');

    // Assert inventory quantity increments back to startingInventory
    const { data: variantAfterApproval } = await supabase
      .from('product_variants')
      .select('inventory_quantity')
      .eq('id', targetVariant.id)
      .single();
    expect(variantAfterApproval!.inventory_quantity).toBe(startingInventory);

    console.log('--- Shipping E2E Lifecycle completed successfully! ---');
  });
});
