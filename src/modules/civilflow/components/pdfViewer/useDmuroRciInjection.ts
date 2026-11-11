/**
 * Inyección de Dmuro (RCI) al motor: el motor jamás lee storage — la capa React le pasa la
 * DMR (distancia máxima de rociador a muro) del piso ACTIVO al montar, cada vez que RCI lo
 * reescribe (EV_RCI_VIVO_SAVED), al cambiar de piso (EV_PLAN_LOADED) y entre pestañas
 * (EV_STORAGE cross-tab). Evolución del hook que estaba inline en PdfViewer: antes leía SOLO
 * la DMR global (roc.Dmuro); ahora prefiere la fila del piso en pisos.rows y cae a la global.
 * Ej: piso con Dmuro 2,3 m en Pisos → engine.dmuroRci = 2.3; sin valor cae a la global.
 */
import { useEffect, type MutableRefObject } from 'react';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { RCI_ESTADO_VIVO_KEY, VISOR_ACTIVE_PLAN_ID_KEY } from '../../constants/storage-keys.ts';
import { EV_STORAGE, EV_RCI_VIVO_SAVED, EV_PLAN_LOADED } from '../../utils/fixtureEvents.ts';

export function useDmuroRciInjection(
  engineRef: MutableRefObject<PlanoEngine | null>,
  currentId: number | string | null | undefined,
): void {
  useEffect(() => {
    const inyectar = (): void => {
      const vivo = loadFromStorage<{
        pisos?: { rows?: Array<{ planId?: string; Dmuro?: number | string }> };
        roc?: { Dmuro?: number | string };
      } | null>(RCI_ESTADO_VIVO_KEY, null);
      const planId =
        currentId != null ? String(currentId) : localStorage.getItem(VISOR_ACTIVE_PLAN_ID_KEY);
      const fila = planId
        ? vivo?.pisos?.rows?.find((r) => String(r.planId || '') === planId)
        : null;
      const dm = parseFloat(String(fila?.Dmuro ?? vivo?.roc?.Dmuro ?? '').replace(',', '.'));
      if (engineRef.current) engineRef.current.dmuroRci = dm > 0 ? dm : null;
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
