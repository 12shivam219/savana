// Probe: does the Supabase project auto-confirm signups?
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

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const email = `autoconfirm-probe-${Date.now()}@gmail.com`;
const password = 'Probe123!';

console.log('Trying signup @gmail.com...');
const { data, error } = await sb.auth.signUp({
  email, password,
  options: { data: { full_name: 'AutoProbe' } },
});
console.log('signup error:', error?.message);
console.log('signup response keys:', data ? Object.keys(data) : null);
console.log('  data.session:', data?.session ? 'present' : 'null');
console.log('  data.user:', data?.user ? `${data.user.id} confirmed=${data.user.email_confirmed_at}` : 'null');

if (data?.session) {
  console.log('Got session — trying search_products...');
  const { data: prods, error: rpcErr } = await sb.rpc('search_products', { p_query: 'shirt' });
  console.log('search_products result count:', prods?.length, 'err:', rpcErr?.message);
}

await sb.auth.signOut();

console.log('\nTrying signup with @example.com (should fail)...');
const { error: exErr } = await sb.auth.signUp({
  email: `probe-${Date.now()}@example.com`, password: 'Probe123!',
  options: { data: { full_name: 'Ex' } },
});
console.log('signup @example.com error:', exErr?.message || 'OK');