import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeName = (error as { name?: unknown }).name;
  const maybeMessage = (error as { message?: unknown }).message;

  return (
    maybeName === 'AuthApiError' &&
    typeof maybeMessage === 'string' &&
    maybeMessage.includes('Invalid Refresh Token')
  );
}

