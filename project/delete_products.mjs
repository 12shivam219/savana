import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://evzlqrekovjimofgddwj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2emxxcmVrb3ZqaW1vZmdkZHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjMyNTksImV4cCI6MjA5NzQzOTI1OX0.dibnBJJe1RtuKZsMrL6A7SlKl3e9gv4fFCkDuAJXhW8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deleteAllProducts() {
  // 1. Sign in
  console.log('Signing in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: '12shivamtiwari219@gmail.com',
    password: 'Admin@123',
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log('Signed in as:', authData.user.email, '| user id:', userId);

  // 2. Check current profile role
  const { data: profile, error: profileFetchErr } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .single();

  if (profileFetchErr) {
    console.error('Profile fetch error:', profileFetchErr.message);
  } else {
    console.log('Current profile:', profile);
  }

  // 3. Ensure this user has admin role in profiles
  if (profile?.role !== 'admin') {
    console.log('Setting role to admin...');
    const { error: roleErr } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId);

    if (roleErr) {
      console.error('Could not set admin role:', roleErr.message);
    } else {
      console.log('Role set to admin.');
    }
  } else {
    console.log('Already admin.');
  }

  // 4. Fetch all products
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, name');

  if (fetchError) {
    console.error('Fetch error:', fetchError.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('No products found — nothing to delete.');
    process.exit(0);
  }

  console.log(`\nFound ${products.length} products to delete:`);
  products.forEach(p => console.log(`  - ${p.name}`));

  // 5. Delete each product by ID (RLS admin policy applies per-row)
  let deleted = 0;
  for (const product of products) {
    const { error: delErr } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (delErr) {
      console.error(`  ✗ Failed to delete "${product.name}": ${delErr.message}`);
    } else {
      console.log(`  ✓ Deleted: ${product.name}`);
      deleted++;
    }
  }

  console.log(`\nDone. Deleted ${deleted}/${products.length} products.`);

  // 6. Verify
  const { data: remaining } = await supabase.from('products').select('id');
  console.log(`Remaining products in DB: ${remaining?.length ?? 'unknown'}`);
}

deleteAllProducts();
