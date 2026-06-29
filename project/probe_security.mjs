// Probe all admin/tenant RPCs as admin and as customer to see actual messages.
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

const ADMIN = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function asAdmin() {
  console.log('\n=== As ADMIN ===');
  const { error: authErr } = await ADMIN.auth.signInWithPassword({
    email: '12shivamtiwari219@gmail.com',
    password: 'Admin@123',
  });
  console.log('Auth:', authErr?.message || 'OK');

  // cancel_order with ghost UUID
  const { error: ce } = await ADMIN.rpc('cancel_order', { p_order_id: '00000000-0000-0000-0000-000000000000' });
  console.log('cancel_order(ghost):', ce?.message || 'no error');

  // approve_return_and_restock with ghost UUID
  const { error: ae } = await ADMIN.rpc('approve_return_and_restock', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_notes: 'test',
  });
  console.log('approve_return(ghost):', ae?.message || 'no error');

  // simulate_payment_success with non-existent order
  const { error: pe } = await ADMIN.rpc('simulate_payment_success', { p_order_number: 'NONEXIST123' });
  console.log('simulate_payment(non-existent):', pe?.message || 'no error');

  // Try sending payment-webhook with x-mock-payment + no signature
  const resp = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/payment-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      'x-mock-payment': 'true',
    },
    body: JSON.stringify({ order_number: '00000000-0000-0000-0000-000000000000' }),
  });
  console.log('payment-webhook(x-mock,no-sig):', resp.status, await resp.text());

  // Try x-test-payment + bogus signature
  const resp2 = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/payment-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      'x-test-payment': 'true',
      'x-test-signature': 'deadbeef',
    },
    body: JSON.stringify({ order_number: '00000000-0000-0000-0000-000000000000' }),
  });
  console.log('payment-webhook(x-test,bad-sig):', resp2.status, await resp2.text());
}

async function asCustomer() {
  console.log('\n=== As NEW CUSTOMER ===');
  // create a new client + signup
  const CUST = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const email = `probe-${Date.now()}@gmail.com`;
  const password = 'Probe123!';
  const { error: signupErr } = await CUST.auth.signUp({
    email, password, options: { data: { full_name: 'Probe' } },
  });
  console.log('signup @gmail.com:', signupErr?.message || 'OK');
  const { error: signinErr } = await CUST.auth.signInWithPassword({ email, password });
  console.log('signin:', signinErr?.message || 'OK');

  // Try approve_return_and_restock
  const { error: ae } = await CUST.rpc('approve_return_and_restock', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_notes: 'unauthorized',
  });
  console.log('approve_return:', ae?.message || 'no error');

  // Try simulate_payment_success
  const { error: pe } = await CUST.rpc('simulate_payment_success', { p_order_number: 'X' });
  console.log('simulate_payment:', pe?.message || 'no error');

  // Try cancel_order with ghost
  const { error: ce } = await CUST.rpc('cancel_order', { p_order_id: '00000000-0000-0000-0000-000000000000' });
  console.log('cancel_order(ghost):', ce?.message || 'no error');
}

await asAdmin();
await asCustomer();
await ADMIN.auth.signOut();