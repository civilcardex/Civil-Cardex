/**
 * Inyección de Dmuro (RCI) al motor: el motor jamás lee storage — la capa React le pasa la
 * DMR (distancia máxima de rociador a muro) del piso ACTIVO al montar, cada vez que RCI lo
 * reescribe (EV_RCI_VIVO_SAVED), al cambiar de piso (EV_PLAN_LOADED) y entre pestañas
 * (EV_STORAGE cross-tab). Sin S (separación entre rociadores) en ese piso, inyecta null.
 */
import { useEffect, type MutableRefObject } from 'react';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { RCI_ESTADO_VIVO_KEY, VISOR_ACTIVE_PLAN_ID_KEY } from '../../constants/storage-keys.ts';
import { EV_STORAGE, EV_RCI_VIVO_SAVED, EV_PLAN_LOADED } from '../../utils/fixtureEvents.ts';
import { distanciaMaximaMuroRci } from '../../lib/rci/tables.ts';
import { renumeraRociadores } from '../../lib/PlanoEngine/RCIAutoDraw.ts';

export function useDmuroRciInjection(
  engineRef: MutableRefObject<PlanoEngine | null>,
  currentId: number | string | null | undefined,
): void {
  useEffect(() => {
    const inyectar = (): void => {
      const vivo = loadFromStorage<{
        clas?: { riesgo?: string };
        pisos?: { rows?: Array<{ planId?: string; riesgo?: string; S?: number | string | null }> };
      } | null>(RCI_ESTADO_VIVO_KEY, null);
      const planId =
        currentId != null ? String(currentId) : localStorage.getItem(VISOR_ACTIVE_PLAN_ID_KEY);
      const fila = planId
        ? vivo?.pisos?.rows?.find((r) => String(r.planId || '') === planId)
        : null;
      /* Numeración ROC-N al cargar el piso (ped. usuario 2026-11-13): rociadores guardados
       * antes del consecutivo quedan con el valor pelado ('rociador') y el glifo mostraba
       * «ROC-rociador». Al cargar/inyectar se estampa el # global por piso. Idempotente. */
      const eng = engineRef.current;
      if (eng) {
        const s = Number(String(fila?.S ?? '').replace(',', '.'));
        eng.sRci = Number.isFinite(s) && s > 0 ? s : null;
        eng.dmuroRci = distanciaMaximaMuroRci(fila?.S, fila?.riesgo || vivo?.clas?.riesgo || '');
      }
      if (
        eng &&
        (
          eng as unknown as { ramales?: Array<{ net?: string; accMed?: Record<string, string> }> }
        ).ramales?.some(
          (r) =>
            r.net === 'rci' &&
            Object.values(r.accMed || {}).some((v) => /rociador/i.test(String(v))),
        )
      ) {
        renumeraRociadores(eng as never);
        eng.render();
      }
    };
    inyectar();
    window.addEventListener(EV_RCI_VIVO_SAVED, inyectar);
    window.addEventListener(EV_PLAN_LOADED, inyectar);
    window.addEventListener(EV_STORAGE, inyectar);
    return () => {
      window.removeEventListener(EV_RCI_VIVO_SAVED, inyectar);
      window.removeEventListener(EV_PLAN_LOADED, inyectar);
      window.removeEventListener(EV_STORAGE, inyectar);
    };
  }, [currentId, engineRef]);
}
