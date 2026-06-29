// Quick DB introspection: list deployed function signatures, products, profiles.
// Uses the anon key only — we can read public function bodies via RPC,
// but to inspect schemas we need the service role. So we'll just call
// `rpc('uuid_nil')` style queries to peek at table contents.

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
  // Sign in as admin to get a session token
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: '12shivamtiwari219@gmail.com',
    password: 'Admin@123',
  });
  if (authErr) {
    console.log('AUTH FAILED:', authErr.message);
    return;
  }
  console.log('Signed in as admin:', auth.user.email);
  console.log('User app_metadata:', JSON.stringify(auth.user.app_metadata));
  console.log('User user_metadata:', JSON.stringify(auth.user.user_metadata));

  // Look up profile.tenant_id for the admin
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, role, tenant_id, loyalty_points')
    .eq('id', auth.user.id)
    .single();
  console.log('Admin profile:', profile, 'err:', pErr?.message);

  // List all distinct tenant_ids in products + product_variants
  const { data: products } = await supabase
    .from('products')
    .select('id, slug, name, tenant_id, is_active, deleted_at, sale_price, base_price');
  console.log(`Products count: ${products?.length}`);
  const tenants = new Set();
  (products || []).forEach((p) => {
    tenants.add(p.tenant_id);
    if (p.slug === 'breezy-linen-shirt') {
      console.log('  breezy-linen-shirt:', JSON.stringify(p));
    }
  });
  console.log('Distinct product tenants:', [...tenants]);

  // List variants for breezy-linen-shirt
  const bp = products?.find((p) => p.slug === 'breezy-linen-shirt');
  if (bp) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id, sku, inventory_quantity, is_in_stock, tenant_id')
      .eq('product_id', bp.id);
    console.log(`Variants for breezy-linen-shirt:`, variants);
  }
}

main().catch((e) => console.error('SCRIPT ERROR:', e));