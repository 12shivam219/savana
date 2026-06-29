// Verify: can admin read newly-signed-up (unconfirmed) user's profile?
// And: can we manually confirm them via SQL?
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
const { error: authErr } = await ADMIN.auth.signInWithPassword({
  email: '12shivamtiwari219@gmail.com', password: 'Admin@123',
});
if (authErr) { console.log('Admin auth failed:', authErr.message); process.exit(1); }

// Try to read the recently-created probe user via the admin auth API
// (this needs service role normally, but let's see)
const { data: list, error: listErr } = await ADMIN.auth.admin.listUsers({ perPage: 5 });
console.log('listUsers err:', listErr?.message || 'OK');
console.log('first 5 users:');
(list?.users || []).slice(0, 5).forEach((u) => {
  console.log(`  ${u.email} | id=${u.id} | confirmed=${u.email_confirmed_at || 'no'} | app_meta=${JSON.stringify(u.app_metadata)}`);
});

// Check the recently-created probe user directly
const { data: probe, error: probeErr } = await ADMIN.auth.admin.getUserById('b76fe966-e27b-4f5c-8d0c-0e99eb831d77');
console.log('getUserById:', probeErr?.message || 'OK', '|', probe?.user?.email, 'confirmed:', probe?.user?.email_confirmed_at);

// Can we read profiles for users we didn't create?
const { data: probeProfile, error: profileErr } = await ADMIN.from('profiles').select('*').eq('id', 'b76fe966-e27b-4f5c-8d0c-0e99eb831d77').single();
console.log('profile read err:', profileErr?.message || 'OK', '|', probeProfile);

await ADMIN.auth.signOut();