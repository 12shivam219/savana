import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup() {
  const envPath = path.resolve(__dirname, '../.env');
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
    throw new Error('Supabase credentials missing from .env');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const ADMIN_EMAIL = '12shivamtiwari219@gmail.com';
  const ADMIN_PASSWORD = 'Admin@123';

  console.log('Resetting test database...');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (authErr) {
    throw new Error(`Failed to authenticate admin for database reset: ${authErr.message}`);
  }

  const { error: resetErr } = await supabase.rpc('reset_test_database');
  if (resetErr) {
    throw new Error(`Failed to reset test database: ${resetErr.message}`);
  }

  console.log('Database reset and seeded successfully.');
}

export default globalSetup;
