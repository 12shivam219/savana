import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://evzlqrekovjimofgddwj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2emxxcmVrb3ZqaW1vZmdkZHdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjMyNTksImV4cCI6MjA5NzQzOTI1OX0.dibnBJJe1RtuKZsMrL6A7SlKl3e9gv4fFCkDuAJXhW8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deleteAllProducts() {
  // 1. Sign in
  console.log('Signing in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'priyanktiwari219@gmail.com',
    password: 'Admin12',
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    process.exit(1);
  }
  console.log('Signed in as:', authData.user.email, '| role:', authData.user.role);

  // 2. Fetch all product IDs first
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

  console.log(`Found ${products.length} products:`);
  products.forEach(p => console.log(`  - ${p.id} | ${p.name}`));

  // 3. Delete all products (cascades to variants, images via FK ON DELETE CASCADE)
  const { error: deleteError, count } = await supabase
    .from('products')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // matches all rows

  if (deleteError) {
    console.error('Delete error:', deleteError.message, deleteError.details);
    process.exit(1);
  }

  console.log(`\nDeleted ${count ?? products.length} products successfully.`);

  // 4. Verify
  const { data: remaining } = await supabase.from('products').select('id');
  console.log(`Remaining products in DB: ${remaining?.length ?? 0}`);
}

deleteAllProducts();
