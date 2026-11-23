/**
 * Inyección de material/Ø de los ramales rci al motor: el motor jamás lee storage — cuando la
 * pestaña Hidráulica RCI cambia el material de la red (o el Ø) y escribe el doc de trazos
 * (EV_TRAZOS_SAVED), el canvas vivo aplica los cambios SIN recargar el piso (ped. usuario
 * 2026-11-21: el cambio debe verse en dibujo de redes). También al cambiar de piso
 * (EV_PLAN_LOADED) y entre pestañas (EV_STORAGE). Idempotente: solo pinta si difiere.
 * Espejo de useDmuroRciInjection (mismo patrón de eventos).
 */
import { useEffect, type MutableRefObject } from 'react';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { EV_STORAGE, EV_TRAZOS_SAVED, EV_PLAN_LOADED } from '../../utils/fixtureEvents.ts';
import type { DrawingData } from '../../utils/drawingSyncTypes.ts';

export function useMaterialRciInjection(
  engineRef: MutableRefObject<PlanoEngine | null>,
  currentId: number | string | null | undefined,
): void {
  useEffect(() => {
    const inyectar = (): void => {
      const eng = engineRef.current;
      if (!eng) return;
      const pid =
        currentId != null ? String(currentId) : (eng as { _loadedPlanId?: unknown })._loadedPlanId;
      if (pid == null || pid === '' || pid === 'work') return;
      const doc = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + pid, null);
      if (!doc?.ramales) return;
      let cambio = false;
      for (const tr of doc.ramales || []) {
        if (tr.net !== 'rci' || tr.tipo !== 'ramal' || !tr.id) continue;
        const r = eng.ramales.find((x) => x.id === tr.id);
        if (!r) continue;
        if (tr.material !== undefined && (r.material || '') !== tr.material) {
          r.material = tr.material;
          cambio = true;
        }
        if (tr.diametro !== undefined && (r.diametro || '') !== tr.diametro) {
          r.diametro = tr.diametro;
          cambio = true;
        }
      }
      if (cambio) {
        eng.render();
      }
    };
    inyectar();
    window.addEventListener(EV_TRAZOS_SAVED, inyectar);
    window.addEventListener(EV_PLAN_LOADED, inyectar);
    window.addEventListener(EV_STORAGE, inyectar);
    return () => {
      window.removeEventListener(EV_TRAZOS_SAVED, inyectar);
      window.removeEventListener(EV_PLAN_LOADED, inyectar);
      window.removeEventListener(EV_STORAGE, inyectar);
    };
  }, [currentId, engineRef]);
}
