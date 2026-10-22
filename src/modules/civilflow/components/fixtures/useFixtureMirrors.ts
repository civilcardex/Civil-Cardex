import type { EspejosArgs } from './fixtureMirrorsTypes.ts';
export type { EspejosArgs } from './fixtureMirrorsTypes.ts';
import { correrEspejos } from './fixtureMirrors.ts';
export { correrEspejos };
import { devError } from '../../../../utils/devError.ts';
import { esRedAparatosPresion, propagarAparatosPresion } from '../../utils/propagation';
import { emitAparatosClear } from '../../utils/fixtureEvents.ts';
import { loadAll, loadHidroData, saveAll, stableStringify } from '../fixturesStorage.ts';
import { loadPlanTrazos } from '../../services/storageService.ts';
import { useEffect } from 'react';
import { instalarDiagnosticoDev } from './diagnosticoDev';

instalarDiagnosticoDev();

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
    // Lápida {} en vez de borrar: la clave vacía le dice al merge del loader "vacío a
    // propósito" — sin ella, la BD (snapshot del último saveTrazosToDB) resucitaba los
    // aparatos del tramo en cada cambio de piso.
    all[key] = cur;
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
