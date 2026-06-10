import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
