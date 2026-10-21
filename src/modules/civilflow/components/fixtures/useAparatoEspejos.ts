import type { EspejosArgs } from './aparatoEspejosTipos.ts';
export type { EspejosArgs } from './aparatoEspejosTipos.ts';
import { correrEspejos } from './aparatoEspejos.ts';
export { correrEspejos };
import { TRAZOS_PREFIX } from '../../constants/almacenamientoClaves.ts';
import { collectSourceAgg, trazaDeUltimoGrupo } from '../../utils/bajanteAssociation';
import { devError } from '../../../../utils/desarrolloError.ts';
import {
  diagUltimaPropagacion,
  esRedAparatosPresion,
  propagarAparatosPresion,
} from '../../utils/propagation';
import { emitAparatosClear } from '../../utils/aparatoEventos.ts';
import { leerPlansMeta } from '../../utils/planosMeta.ts';
import { loadAll, loadHidroData, saveAll, stableStringify } from '../aparatosAlmacenamiento.ts';
import { loadPlanTrazos } from '../../services/almacenamientoServicio.ts';
import { useEffect } from 'react';

// Diagnóstico (orig. usuario): __cfDiag('ac') en consola corre la propagación y devuelve el
// análisis completo (piezas, libros, bajadas, transferencias, aristas, bajantes+ucAplicado).
// __cfScale() vuelca por piso origen/calibración/scaleM/ts — para cazar si la deriva de
// trazos (corridos/más cortos tras recargar) reaparece: compara DOS dumps entre sesiones;
// scaleM u origen que cambian solos = piso afectado.
declare global {
  interface Window {
    __cfDiag?: (net: 'af' | 'ac' | 'gas') => unknown;
    __cfScale?: () => unknown;
  }
}
if (typeof window !== 'undefined') {
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
    // eslint-disable-next-line no-console -- herramienta de diagnóstico solicitada por el usuario
    console.log('[CF-DIAG v58] ' + JSON.stringify({ v: 'v58', ...diag }));
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
/** Datos que necesita el grupo de efectos de espejos (viajan en un objeto: el panel pasa sus funciones tal cual). */
/** (1) Sanado de sifones fantasma: reconcilia el conteo 'sif' con los glifos vivos del piso. */
export function correrSanadoSifones(a: EspejosArgs): void {
  const { engineRef, loadingPlanRef, setCounts } = a;
  const eng = engineRef.current;
  if (!eng || loadingPlanRef?.current) return;
  const pid = String(eng._loadedPlanId ?? '');
  if (!pid) return;
  const all = loadAll();
  let dirty = false;
  for (const r of eng.ramales) {
    if (r.net !== 'san' && r.net !== 'll') continue;
    const key = `${r.net}_${r.id}_${pid}`;
    let glifos = 0;
    if (r.accesorioInicio === 'sifon') glifos++;
    if (r.accesorioFin === 'sifon') glifos++;
    if (r.accMed)
      for (const v of Object.values(r.accMed as unknown as Record<string, string>))
        if (v === 'sifon') glifos++;
    const contado = all[key]?.['sif'] || 0;
    if (contado === glifos) continue;
    const cur = { ...(all[key] || {}) };
    if (glifos > 0) cur.sif = glifos;
    else delete cur.sif;
    if (Object.keys(cur).length) all[key] = cur;
    else delete all[key];
    dirty = true;
  }
  if (dirty) {
    saveAll(all);
    setCounts(all);
    try {
      emitAparatosClear();
    } catch {
      /* ignore */
    }
  }
}
/** Propaga los aparatos por la red de af (Agua Fria)/ac (Agua Caliente) cuando cambia la
 *  selección: espera 250 ms para no recalcular a cada clic, y al cambiar de tramo hace
 *  el cálculo al instante (sin eso, el tramo anterior quedaba sin propagar). Tras cada
 *  corrida refresca el estado del panel DIRECTO (sin depender del round-trip del evento:
 *  el bail por igualdad del reload y el timing del debounce dejaban el panel rancio hasta
 *  reseleccionar, orig. usuario caso RAC2-P2). */
export function correrPropagacion(a: EspejosArgs): () => void {
  const { netId, setCounts, setHidroData, onLibrosChange, engineRef } = a;
  // TODAS las redes de presión en cada corrida (orig. usuario: al montar corría solo la
  // red activa — la de 'ac' corría 250ms DESPUÉS del primer clic y el panel mostraba el
  // residuo viejo de la red transitoria).
  const redes = esRedAparatosPresion(netId)
    ? [netId, ...['af', 'ac', 'gas'].filter((n) => n !== netId)]
    : ['af', 'ac', 'gas'];
  // Refresco explícito post-corrida: re-lee lo que la propagación acaba de escribir para
  // que el panel pinte fresco en este mismo ciclo (orig. usuario: solo reseleccionando se
  // veían bien los aparatos). Conteos con bail anti-loop (objeto nuevo solo si cambió el
  // contenido); los libros se refrescan vía tick dedicado porque se leen directo en render.
  const refrescarPanel = (): void => {
    try {
      const next = loadAll();
      setCounts((prev) => (stableStringify(prev) === stableStringify(next) ? prev : next));
    } catch {
      /* sin storage (tests) */
    }
    try {
      const nextH = loadHidroData();
      setHidroData((prev) => (stableStringify(prev) === stableStringify(nextH) ? prev : nextH));
    } catch {
      /* sin storage (tests) */
    }
    try {
      onLibrosChange?.();
    } catch {
      /* sin panel (tests) */
    }
  };
  const correr = (): void => {
    for (const n of redes) {
      try {
        propagarAparatosPresion(n as 'af' | 'ac' | 'gas');
      } catch (e) {
        devError('[CF-PROP] error en propagación:', e);
      }
    }
    // El ucAplicado refrescado vive en storage — el MOTOR lo traía rancio de la asociación
    // (orig. usuario MAC1: +1 lavadero en el panel derecho hasta recargar). Espejo directo.
    const eng = engineRef.current;
    if (eng) {
      const pid = String(
        (eng as unknown as { _loadedPlanId?: string | number })._loadedPlanId ?? '',
      );
      for (const b of eng.bajantes || []) {
        if (b.tipo !== 'montante') continue;
        try {
          const trazos = loadPlanTrazos(pid) as {
            bajantes?: Array<{ id?: string; ucAplicado?: Record<string, Record<string, number>> }>;
          } | null;
          if (!trazos || !trazos.bajantes) continue;
          const mon = trazos.bajantes.find((x) => x.id === b.id);
          if (mon && mon.ucAplicado) b.ucAplicado = mon.ucAplicado;
        } catch {
          /* ignore */
        }
      }
    }
  };
  const t = window.setTimeout(() => {
    correr();
    refrescarPanel();
  }, 250);
  // Al cambiar de selección NO se cancela en silencio (auditoría #5): se vacía lo pendiente
  // de forma síncrona — a estas alturas el menú ya abrió y la corrida es solo math de
  // storage, el mismo costo que el autosave que ya corre en este ciclo.
  return () => {
    window.clearTimeout(t);
    correr();
    refrescarPanel();
  };
}
/** (3) Espejos de salidas + herencia entre pisos + bomba: el efecto grande, mantiene las
 *  claves espejo al día cada vez que algo cambia. */
export function useFixtureMirrors(a: EspejosArgs): void {
  const {
    engineRef,
    loadingPlanRef,
    planLoadedTick,
    netId,
    targetId,
    counts,
    hidroData,
    planId,
    plans,
    agregadoBajante,
    exitsDeBajante,
    setCounts,
  } = a;
  useEffect(() => {
    correrSanadoSifones(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismos deps que el effect original
  }, [planLoadedTick, engineRef, loadingPlanRef, setCounts]);
  useEffect(() => {
    const cleanup = correrPropagacion(a);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismos deps que el effect original
  }, [netId, targetId]);
  useEffect(() => {
    correrEspejos(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mismos deps explícitos que el effect original
  }, [
    counts,
    hidroData,
    planId,
    plans,
    netId,
    agregadoBajante,
    exitsDeBajante,
    engineRef,
    loadingPlanRef,
    planLoadedTick,
  ]);
}
