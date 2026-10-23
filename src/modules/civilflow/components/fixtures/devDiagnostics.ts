/** Diagnóstico de la propagación y de la escala (solo DEV).
 *
 * window.__cfDiag(net) corre la propagación y vuelca piezas/libros/enlaces; window.__cfScale
 * vuelva la escala por piso para cazar derivas. En producción no se importa: el gate
 * import.meta.env.DEV hace que el bundle de prod ni incluya este módulo.
 *
 * ponytail: movido de useFixtureMirrors (110L de consola en medio del hook).
 */
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { collectSourceAgg, trazaDeUltimoGrupo } from '../../utils/bajanteAssociation';
import { diagUltimaPropagacion, propagarAparatosPresion } from '../../utils/propagation';
import { leerPlansMeta } from '../../utils/plansMeta.ts';
import { loadAll } from '../fixturesStorage.ts';

declare global {
  interface Window {
    __cfDiag?: (net: 'af' | 'ac' | 'gas') => unknown;
    __cfScale?: () => unknown;
  }
}

export function instalarDiagnosticoDev(): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return;
  // Diagnóstico (orig. usuario): __cfDiag('ac') en consola corre la propagación y devuelve el
  // análisis completo (piezas, libros, bajadas, transferencias, aristas, bajantes+ucAplicado).
  // __cfScale() vuelca por piso origen/calibración/scaleM/ts — para cazar si la deriva de
  // trazos (corridos/más cortos tras recargar) reaparece: compara DOS dumps entre sesiones;
  // scaleM u origen que cambian solos = piso afectado.
  // Los ganchos de diagnóstico (__cfDiag, __cfScale) solo existen en DEV: en producción
  // exponían la topología completa del proyecto del cliente a cualquiera que abriera la
  // consola, y __cfDiag además permite mutar la propagación en vivo.
  window.__cfDiag = (net) => {
    propagarAparatosPresion(net);
    const diag = diagUltimaPropagacion() as Record<string, unknown>;
    // Sección ASOC (montantes entre pisos): por cada montante con origenId — puntero, libro
    // en storage, grupo que llega del superior y disco propio. Con ESTO se ve en cuál eslabón
    // muere la herencia sin adivinar (orig. usuario MAC1: panel mezclando propio + heredado).
    try {
      const counts = loadAll();
      const asoc: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(`civilflow_${TRAZOS_PREFIX}`)) continue;
        const pid = k.slice(`civilflow_${TRAZOS_PREFIX}`.length);
        let d: {
          bajantes?: Array<Record<string, unknown>>;
          ramales?: Array<Record<string, unknown>>;
        };
        try {
          d = JSON.parse(localStorage.getItem(k) || '{}');
        } catch {
          continue;
        }
        for (const b of d.bajantes || []) {
          if (b.tipo !== 'montante' || !b.origenId) continue;
          const [upPlan, upBaj] = String(b.origenId).split('|');
          let grupo: Record<string, number> | null = null;
          let detalle: unknown = null;
          try {
            const upRaw = JSON.parse(
              localStorage.getItem(`civilflow_${TRAZOS_PREFIX}${upPlan}`) || 'null',
            ) as { bajantes?: never[]; ramales?: never[] } | null;
            const upB = upRaw?.bajantes?.find((x) => (x as { id?: string }).id === upBaj);
            if (upB) {
              grupo = collectSourceAgg({
                net,
                planId: String(upPlan),
                bajId: String(upBaj),
                liveBaj: null,
                liveRamales: null,
                storedBaj: upB as never,
                storedRamales: (upRaw?.ramales ?? null) as never,
                counts,
                hidro: {} as never,
              }).agg;
              detalle = trazaDeUltimoGrupo();
            }
          } catch {
            /* sin caché del piso superior */
          }
          asoc[`${String(b.code || b.id)}@${pid}`] = {
            tipo: b.tipo,
            origenId: b.origenId,
            libroStorage: b.ucAplicado ?? null,
            grupoDelSuperior: grupo,
            // De dónde salió CADA pieza del grupo (clave propia, cierre, servi, libro) —
            // con esto un dump nombra la rama exacta sin adivinar.
            grupoDetalle: detalle,
            disk: counts[`${net}_${String(b.id)}_${pid}`] ?? null,
            anillo: Object.keys((b.desplazamientos as Record<string, unknown>) || {}),
          };
        }
      }
      diag.asoc = asoc;
    } catch {
      /* diag best-effort */
    }
    // Impreso en consola como texto: seleccionar la línea [CF-DIAG] y copiar (Ctrl+C) — más
    // fácil que copiar objetos anidados (orig. usuario: el JSON del clipboard no llegó).
    // La versión va impresa EN el dump: si no dice v54, el tab corre un bundle viejo y los
    // arreglos recientes no están cargados (fue la causa de varias rondas de "sigue igual").
    // Solo en DEV: en producción el volcado expone la topología del proyecto del cliente
    // a cualquiera que abra la consola del navegador.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- herramienta de diagnóstico (solo DEV)
      console.log('[CF-DIAG v58] ' + JSON.stringify({ v: 'v58', ...diag }));
    }
    return { v: 'v58', ...diag };
  };
  window.__cfScale = () => {
    try {
      const meta = leerPlansMeta();
      const global = meta.find((m) => m.calGlobal === true && m.origen && m.scale);
      const pisos: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(`civilflow_${TRAZOS_PREFIX}`)) continue;
        const pid = k.slice(`civilflow_${TRAZOS_PREFIX}`.length);
        try {
          const d = JSON.parse(localStorage.getItem(k) || '{}') as {
            scaleM?: number;
            ts?: number;
            ramales?: Array<{ pts?: number[][] }>;
            bajantes?: unknown[];
          };
          pisos[pid] = {
            scaleM: d.scaleM ?? null,
            ts: d.ts ?? null,
            nRam: (d.ramales || []).length,
            nBaj: (d.bajantes || []).length,
            primerPt: d.ramales?.[0]?.pts?.[0] ?? null,
            metaOrigen: meta.find((m) => String(m.id) === String(pid))?.origen ?? null,
          };
        } catch {
          pisos[pid] = { parseError: true };
        }
      }
      return { escalaGlobal: global?.scale ? global.scale / 100 : null, meta, pisos };
    } catch (e) {
      return { error: String(e) };
    }
  };
}
