import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function assertSupabase() {
  if (!supabase) throw new Error('Falta configurar Supabase en el archivo .env.local.');
  return supabase;
}
