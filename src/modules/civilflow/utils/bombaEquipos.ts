import { loadFromStorage } from '../services/storageService';
import { TRAZOS_PLAN_PREFIX, TRAZOS_PREFIX } from '../constants/storage-keys';
import { APARATOS_DEF } from '../constants';
import { mapUdBombaDesdeTrazos } from './bombaHerencia';

export interface EquipoBomba {
  code: string;
  nivel: string;
  uds: number;
  net: string;
  planId: string;
  id: string;
}

// Peso UD por aparato (misma tabla que el panel de aparatos): las UDs son conteo × valor
// (1 lavamanos + 1 inodoro = 2+4 = 6 UD, no 2). Ids fuera de tabla pesan 0, igual que en el
// panel (solo filas conocidas multiplican).
const UD_POR_APARATO: Record<string, number> = Object.fromEntries(
  (APARATOS_DEF as Array<{ id: string; ud?: unknown }>).map((d) => [
    d.id,
    typeof d.ud === 'number' ? d.ud : 0,
  ]),
);

/** Suma UD de un mapa por aparato (conteo × valor UD, con override de valores custom). */
export function udsDeMapa(
  mapa: Record<string, number>,
  udOverride?: Record<string, number>,
): number {
  return Object.entries(mapa).reduce(
    (a, [k, v]) => a + (v as number) * (udOverride?.[k] ?? UD_POR_APARATO[k] ?? 0),
    0,
  );
}

/** Tabla de equipos de bomba: TODAS las bombas (tipo 'bomba') de todos los pisos con caché
 *  local, con sus UDs (mapUdBombaDesdeTrazos × valor UD). Usada por BombaARDesign (page 5 +
 *  udTot). `udOverride`: valores UD custom del usuario (misma tabla del panel). */
export function equiposBombaDesdeTrazos(udOverride?: Record<string, number>): EquipoBomba[] {
  const out: EquipoBomba[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // Claves CRUDAS de localStorage ('civilflow_trazos_<id>') — usar el prefijo completo.
      if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
      const planId = k.slice(TRAZOS_PLAN_PREFIX.length);
      // loadFromStorage antepone 'civilflow_' — pasar el prefijo lógico, no la clave cruda.
      const trazos = loadFromStorage<{
        bajantes?: Array<{
          id: string;
          code?: string;
          tipo?: string;
          net?: string;
          pisoBase?: string;
          cajaOrigenId?: string | null;
        }>;
      } | null>(TRAZOS_PREFIX + planId, null);
      for (const b of trazos?.bajantes || []) {
        if (b.tipo !== 'bomba') continue;
        const mapa = mapUdBombaDesdeTrazos(planId, b.id, b.net || 'san');
        out.push({
          code: b.code || b.id,
          nivel: b.pisoBase || '—',
          net: b.net || 'san',
          planId,
          id: b.id,
          uds: udsDeMapa(mapa, udOverride),
        });
      }
    }
  } catch {
    /* best-effort */
  }
  return out;
}
