/**
 * Sincronización del panel de aparatos con el storage/BD: poda de accesorios gas de planos
 * borrados, push de áreas rejillas, recarga ante eventos de sync, y escritura de los blobs
 * sanitario/hidráulico al dibujo. Los 4 efectos viven aquí en el MISMO orden en que vivían
 * inline en FixturesPanel (el orden de hooks no cambia). Ej: el menú contextual re-ancla una
 * clave -> EV_STORAGE -> reloadAll refresca los conteos del panel.
 */
import { useEffect } from 'react';
import {
  EV_APARATOS_CLEAR,
  EV_SAN_SYNC,
  EV_HIDRO_SYNC,
  EV_STORAGE,
} from '../../utils/fixtureEvents.ts';
import { devError } from '../../../../utils/devError.ts';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
} from '../../utils/drawingSync.ts';
import { startRejillasGasodSync, hidratarRejillasGasod } from '../rejillasGasodSync';
import { guardarSnapshotDelPanel } from '../pdfViewer/persistStrokes.ts';
import { podarGasAccPorPlanos } from '../../utils/drawingSyncGc.ts';
import {
  loadAll,
  loadHidroData,
  loadGasAcc,
  type CountsMap,
  type GasAccMap,
  type HidroDataMap,
  stableStringify,
} from '../fixturesStorage.ts';

/** Lo que el sync necesita del motor vivo (el panel pasa su ref de PlanoEngine). */
export interface MotorSync {
  _loadedPlanId?: string | number | null;
  ramales: Array<{ id?: string; label?: string }>;
  bajantes: Array<{ id?: string; code?: string }>;
  areas: Array<{ id?: string; label?: string }>;
}

/**
 * Efectos de sincronización externa del panel (misma posición y orden que tenían inline:
 * poda -> rejillas -> recarga por eventos -> escritura de blobs). Llamarlo donde estaban.
 */
export function usePanelStorageSync({
  plans,
  setCounts,
  setHidroData,
  setGasAcc,
  counts,
  hidroData,
  engineRef,
  loadingPlanRef,
}: {
  plans: Parameters<typeof writeSanDrawingSync>[0];
  setCounts: React.Dispatch<React.SetStateAction<CountsMap>>;
  setHidroData: React.Dispatch<React.SetStateAction<HidroDataMap>>;
  setGasAcc: React.Dispatch<React.SetStateAction<GasAccMap>>;
  counts: CountsMap;
  hidroData: HidroDataMap;
  engineRef: React.MutableRefObject<MotorSync | null>;
  loadingPlanRef?: React.MutableRefObject<boolean>;
}): void {
  useEffect(() => {
    const { idsVivos, porDisco } = podarGasAccPorPlanos(plans);
    if (porDisco) {
      setGasAcc(porDisco);
      return;
    }
    setGasAcc((prev) => {
      let changed = false;
      const next: GasAccMap = {};
      for (const id of idsVivos) {
        if (prev[id]) next[id] = prev[id];
      }
      if (Object.keys(next).length !== Object.keys(prev).length) changed = true;
      return changed ? next : prev;
    });
  }, [plans, setGasAcc]);

  useEffect(() => {
    // Conteos de áreas rejillas vivos sin la tabla: arranca el push global del blob
    // (asignar/borrar desde el panel llega a BD) e hidrata el fill-missing al montar el
    // visor — antes el panel arrancaba vacío hasta entrar a la tabla de Rejillas.
    startRejillasGasodSync();
    void hidratarRejillasGasod();
  }, []);

  useEffect(() => {
    // Recarga guardada: solo setea si el CONTENIDO cambió (misma ref = bail, sin re-render).
    // Sin esto, escuchar los syncs entraría en loop sync→reload→sync (cada sync dispara
    // evento y cada reload crea refs nuevas). Con esto el panel se entera del re-anclaje
    // de claves (orig. usuario piso 2: montaba con el store vacío y nunca refrescaba).
    const reloadAll = () => {
      setCounts((prev) => {
        const next = loadAll();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
      setHidroData((prev) => {
        const next = loadHidroData();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
      setGasAcc((prev) => {
        const next = loadGasAcc();
        return stableStringify(prev) === stableStringify(next) ? prev : next;
      });
    };
    window.addEventListener(EV_STORAGE, reloadAll);
    window.addEventListener(EV_APARATOS_CLEAR, reloadAll);
    window.addEventListener(EV_SAN_SYNC, reloadAll);
    window.addEventListener(EV_HIDRO_SYNC, reloadAll);
    return () => {
      window.removeEventListener(EV_STORAGE, reloadAll);
      window.removeEventListener(EV_APARATOS_CLEAR, reloadAll);
      window.removeEventListener(EV_SAN_SYNC, reloadAll);
      window.removeEventListener(EV_HIDRO_SYNC, reloadAll);
    };
  }, [setCounts, setHidroData, setGasAcc]);

  useEffect(() => {
    try {
      // Los trazos deben estar FRESCOS antes del sync: writeSanDrawingSync corre la GC de
      // claves aparatos/hidro contra los trazos GUARDADOS — con trazos stale (elementos
      // recién dibujados que el autosave aún no persistía) borraba las claves de aparatos
      // recién asignadas: el panel las seguía mostrando (estado vivo) pero la validación de
      // cierre las leía vacías y disparaba "UC/UD pendientes" (orig. usuario).
      const eng = engineRef.current;
      // Carga en vuelo: el engine aún tiene el piso anterior (o nada) bajo el id del piso
      // entrante — snapshot aquí persistía trabajo vacío/ajeno con ts fresco sobre la caché
      // buena del piso entrante (orig. usuario: pisos vaciados al reabrir).
      if (eng && eng._loadedPlanId != null && !loadingPlanRef?.current) {
        // Anti-vaciado (ver guardarSnapshotDelPanel); el borrado legítimo va por el autosave.
        guardarSnapshotDelPanel(eng as never);
      }
      // Registrar los ids VIVOS del piso cargado ANTES de sincronizar (el GC los consulta):
      // sincronizar sin ellos permitía borrar claves de ramales recientes (guard del GC).
      if (eng && eng._loadedPlanId != null) {
        setSyncLoadedLiveIds(String(eng._loadedPlanId), [
          ...eng.ramales.flatMap((r) => [r.id, r.label].filter(Boolean) as string[]),
          ...eng.bajantes.flatMap((b) => [b.id, b.code].filter(Boolean) as string[]),
          ...eng.areas.flatMap((a) => [a.id, a.label].filter(Boolean) as string[]),
        ]);
      }
      writeSanDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
    try {
      writeHydroDrawingSync(plans);
    } catch (e) {
      devError('AparatosPanel:', e);
    }
  }, [counts, hidroData, plans, engineRef, loadingPlanRef]);
}
