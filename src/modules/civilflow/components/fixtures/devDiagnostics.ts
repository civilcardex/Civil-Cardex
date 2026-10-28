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
import { leerJournalTrazos, limpiarJournalTrazos } from '../../services/storage/trazosJournal.ts';

declare global {
  interface Window {
    __cfDiag?: (net: 'af' | 'ac' | 'gas') => unknown;
    __cfScale?: () => unknown;
    __cfSave?: () => Promise<unknown>;
    __cfJournal?: (limpiar?: boolean) => unknown;
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
  // __cfSave() — veredicto de guardado POR PISO: conteos (ramales/bajantes/fantasmas) + ts de
  // la caché local VS lo que devuelve la BD (get_plano_data). Con esto se ve en cuál de los
  // dos lados pierde el piso (local vacío = el snapshot nunca se escribió; bd vacía = el RPC
  // llegó sin contenido o falló) sin adivinar. El pisado local→BD o BD→local (árbitro por ts)
  // queda evidenciado comparando los dos ts del mismo piso. (Caso abierto: cubierta.)
  window.__cfSave = async () => {
    const meta = leerPlansMeta();
    const out: Record<string, unknown> = {};
    const { supabase } = await import('../../../../lib/supabase');
    for (const m of meta) {
      const pid = String(m.id);
      let local: {
        ramales?: unknown[];
        bajantes?: unknown[];
        crossFloorGhosts?: unknown[];
        ts?: number;
      } = {};
      try {
        local = JSON.parse(localStorage.getItem(`civilflow_${TRAZOS_PREFIX}${pid}`) || '{}');
      } catch {
        /* local ilegible → conteos 0 */
      }
      let bd: unknown = null;
      try {
        const { data, error } = await supabase.rpc('get_plano_data', { p_plano_id: Number(pid) });
        if (error) bd = { bdError: error.message };
        else if (!data?.plano) bd = { bdError: 'sin plano en BD' };
        else
          bd = {
            nRam: (data.ramales ?? []).length,
            nBaj: (data.bajantes ?? []).length,
            ts: data.plano.ts,
          };
      } catch (e) {
        bd = { bdError: String(e) };
      }
      out[pid] = {
        piso: `n${m.nivel ?? '?'}`,
        nombre: m.nombre ?? m.name ?? null,
        local: {
          nRam: local.ramales?.length ?? 0,
          nBaj: local.bajantes?.length ?? 0,
          nGhost: local.crossFloorGhosts?.length ?? 0,
          ts: local.ts ?? null,
        },
        bd,
      };
    }
    // eslint-disable-next-line no-console -- herramienta de diagnóstico (solo DEV)
    console.log('[CF-SAVE] ' + JSON.stringify({ v: 'v1', pisos: out }));
    return { v: 'v1', pisos: out };
  };
  // __cfJournal() — caja negra de escrituras del doc de trazos (sobrevive al cierre de la
  // pestaña: la clave vive fuera del namespace civilflow_). Con `true` limpia primero:
  // __cfJournal(true) → reproducir → __cfJournal().
  window.__cfJournal = (limpiar?: boolean) => {
    if (limpiar) limpiarJournalTrazos();
    const entradas = leerJournalTrazos();
    // eslint-disable-next-line no-console -- herramienta de diagnóstico (solo DEV)
    console.log('[CF-JOURNAL] ' + JSON.stringify(entradas));
    return entradas;
  };
}
