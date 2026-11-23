import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

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
export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey, {
  global: {
    fetch: (input, init = {}) => {
      // Timeout nativo (AbortSignal.timeout dispara TimeoutError solo, sin controller +
      // setTimeout). Si el caller trae su propia signal (cancelación de usuario), se COMBINA
      // con AbortSignal.any — antes el `init.signal ?? ctrl.signal` la pisaba y el timeout
      // quedaba desactivado justo en los requests cancelables. AbortSignal.any requiere
      // Safari 17.4+/Firefox 124+: sin él se conserva la señal del caller sin timeout
      // (piso de navegadores del repo: Safari/iPadOS 16.4+).
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      return fetch(input, {
        ...init,
        signal: !init.signal
          ? timeout
          : typeof AbortSignal.any === 'function'
            ? AbortSignal.any([init.signal, timeout])
            : init.signal,
      });
    },
  },
});
