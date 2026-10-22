import { devError } from '../../../utils/devError.ts';
import { supabase } from '../../../lib/supabase';
import { NET_COLOR_PREFIX } from '../constants/storage-keys.ts';
import { NETS } from '../lib/PlanoEngine/PlanoState.ts';
import { CF_TABLES } from '../constants/tableNames.ts';

/**
 * Caché de la promesa de colores cargados (DB + localStorage) — evita un fetch repetido
 * cuando WorkArea y PdfViewer piden los colores en el mismo mount.
 */
let loaded: Promise<Record<string, string>> | null = null;

function readLocalColor(netId: string): string | null {
  const raw = localStorage.getItem(NET_COLOR_PREFIX + netId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? colorHexValida(parsed) : null;
  } catch {
    return colorHexValida(raw);
  }
}

/**
 * Colores válidos para el picker: solo hex #rgb/#rrggbb (input[type=color] exige ese
 * formato — un valor viejo tipo 'gray' guardado en una era anterior disparaba el warning
 * "does not conform to the required format" y dejaba el picker muerto).
 */
function colorHexValida(c: string): string | null {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : null;
}

/**
 * Carga el mapa { netId: color } fusionando localStorage (caché en vivo) con
 * perfiles.net_colors (fuente de verdad). Ante fallo de red/BD devuelve lo local.
 */
export function loadNetColors(): Promise<Record<string, string>> {
  if (!loaded) {
    loaded = (async () => {
      const local: Record<string, string> = {};
      for (const net of NETS) {
        const c = readLocalColor(net.id);
        if (c) local[net.id] = c;
      }
      try {
        const { data, error } = await supabase
          .from(CF_TABLES.perfiles)
          .select('net_colors')
          .maybeSingle();
        if (error) throw error;
        const dbColors = (data?.net_colors ?? {}) as Record<string, string>;
        const merged: Record<string, string> = { ...local };
        for (const [id, c] of Object.entries(dbColors)) {
          const v = typeof c === 'string' ? colorHexValida(c) : null;
          if (v) merged[id] = v;
        }
        for (const [id, c] of Object.entries(merged)) {
          try {
            localStorage.setItem(NET_COLOR_PREFIX + id, c);
          } catch {
            // ignorar
          }
        }
        return merged;
      } catch (e) {
        devError('netColorsService load:', e);
        return local;
      }
    })();
  }
  return loaded;
}

/** Pinta cada red con tu color (tuberías y menús cambian al instante). Ej: NETS (catalogo de redes del motor) lee el col del mapa. */
export function applyNetColors(colors: Record<string, string>): void {
  for (const [id, c] of Object.entries(colors)) {
    document.documentElement.style.setProperty('--' + id, c);
    try {
      const net = NETS.find((n) => n.id === id);
      if (net) net.col = c;
    } catch (e) {
      devError(e);
    }
  }
}

/**
 * Persiste un color de red: actualiza la caché en vivo (localStorage) y hace upsert
 * del mapa completo en perfiles.net_colors vía RPC SECURITY DEFINER. Fire-and-forget
 * desde la UI. Ver supabase/migrations/20260813000002_rls_security_definer_writes.sql.
 */
export async function saveNetColor(netId: string, color: string): Promise<void> {
  loaded = null;
  try {
    localStorage.setItem(NET_COLOR_PREFIX + netId, color);
  } catch {
    // ignorar
  }
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data: existing, error: selError } = await supabase
      .from(CF_TABLES.perfiles)
      .select('net_colors')
      .eq('id', session.user.id)
      .maybeSingle();
    if (selError) throw selError;
    const merged = {
      ...((existing?.net_colors ?? {}) as Record<string, string>),
      [netId]: color,
    };
    const { error } = await supabase.rpc('save_net_colors', { p_colors: merged });
    if (error) throw error;
  } catch (e) {
    devError('netColorsService save:', e);
  }
}
