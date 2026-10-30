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
//
// Timeout global: sin él, una request colgada en el proxy (red móvil en "midway") NUNCA
// resolvía ni rechazaba -> el debounce de guardado quedaba con la promesa colgada y el
// estado "guardando" para siempre, sin error visible ni forma de reintentar.
const TIMEOUT_MS = 20_000;

/**
 * Cliente Supabase de la app (una sola instancia): RLS por auth.uid() hace el gating real y
 * el fetch propio impone timeout de 20 s — sin él, una request colgada dejaba el estado
 * "guardando" para siempre. Ej: supabase.rpc('save_proyecto', {...}).
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (input, init = {}) => {
      const ctrl = new AbortController();
      const t = setTimeout(
        () => ctrl.abort(new DOMException('timeout', 'TimeoutError')),
        TIMEOUT_MS,
      );
      return fetch(input, { ...init, signal: init.signal ?? ctrl.signal }).finally(() =>
        clearTimeout(t),
      );
    },
  },
});
