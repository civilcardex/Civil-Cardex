import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
}

// RLS: el esquema normalizado (supabase/migrations/20260730000001_civilflow_schema.sql + parches)
// habilita RLS y crea policies CRUD owner por auth.uid() en TODAS las tablas, más revoke de
// grants a anon. 20260813000001_rls_project_ownership.sql además verifica la propiedad del
// proyecto/plano referenciado en los INSERT/UPDATE de las tablas hijas.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
