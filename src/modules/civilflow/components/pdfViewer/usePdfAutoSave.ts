import { useState, useRef, useEffect, useCallback } from 'react';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';
import { saveToStorage, saveTrazosToDB } from '../../services/storageService';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
  markPlanTrazosFresh,
} from '../../utils/drawingSync';
import { TRAZOS_PREFIX, LAST_TRAZOS_ID_KEY } from '../../constants/storage-keys';
import type { PlanItem } from '../../context/PlansContext';

export function usePdfAutoSave(
  engineRef: React.MutableRefObject<PlanoEngine | null>,
  currentIdRef: React.MutableRefObject<string | number | undefined>,
  plans: PlanItem[],
  loadingPlanRef?: React.MutableRefObject<boolean>,
) {
  const [saveStatus, setSaveStatus] = useState('saved');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback((eng: PlanoEngine, id: string | number) => {
    try {
      const work = eng.saveWork();
      work.ts = Date.now();
      saveToStorage(`${TRAZOS_PREFIX}${id}`, work);
      markPlanTrazosFresh(id);
      if (id !== 'work') {
        saveToStorage(LAST_TRAZOS_ID_KEY, id);
        saveTrazosToDB(String(id), work);
      }
    } catch {
      // ignore
    }
  }, []);

  const saveTrazosToStorage = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !eng._dirty) return;
    // Carga en vuelo: el engine está a medio hidratar (o aún con el piso anterior bajo el id
    // nuevo, usePlanoLoadSwitch reasigna _loadedPlanId antes de cargar) — guardar aquí persiste
    // un trabajo vacío/ajeno con ts fresco y pisa la caché buena del piso entrante.
    if (loadingPlanRef?.current) return;
    const id = eng._loadedPlanId || currentIdRef.current || 'work';
    performSave(eng, id);
  }, [currentIdRef, engineRef, performSave, loadingPlanRef]);

  const doSave = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (loadingPlanRef?.current) return;
    const id = eng._loadedPlanId || currentIdRef.current || 'work';
    eng._dirty = false;
    performSave(eng, id);
    // Guard del GC (mismo motivo que syncDrawings en PdfViewer): el autosave también
    // dispara write*DrawingSync.
    if (eng._loadedPlanId) {
      setSyncLoadedLiveIds(String(eng._loadedPlanId), [
        ...eng.ramales.flatMap((r) => [r.id, r.label].filter(Boolean) as string[]),
        ...eng.bajantes.flatMap((b) => [b.id, b.code].filter(Boolean) as string[]),
      ]);
    }
    try {
      writeSanDrawingSync(plans);
    } catch {
      /* ignore */
    }
    try {
      writeHydroDrawingSync(plans);
    } catch {
      /* ignore */
    }
    setSaveStatus('saved');
  }, [currentIdRef, engineRef, plans, performSave, loadingPlanRef]);

  // Guardar de forma robusta al cerrar pestaña, ocultar ventana o recargar
  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'hidden') {
        const eng = engineRef.current;
        if (eng && eng._dirty) doSave();
      }
    };
    const handleUnload = () => {
      const eng = engineRef.current;
      if (eng && eng._dirty) doSave();
    };

    window.addEventListener('visibilitychange', handleVis);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [doSave, engineRef]);

  // Guardar al desmontar el hook (cambio de ruta, hot-reload, etc.)
  useEffect(() => {
    return () => {
      saveTrazosToStorage();
    };
  }, [saveTrazosToStorage]);

  const markDirty = useCallback(() => {
    if (saveStatus === 'saved') setSaveStatus('unsaved');
  }, [saveStatus]);

  // Auto-save con debounce de 1500 ms tras detectar estado 'unsaved'
  useEffect(() => {
    if (saveStatus !== 'unsaved') return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const eng = engineRef.current;
      if (!eng?._dirty || loadingPlanRef?.current) {
        setSaveStatus('saved');
        return;
      }
      setSaveStatus('saving');
      doSave();
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [saveStatus, doSave, engineRef, loadingPlanRef]);

  return { saveStatus, setSaveStatus, doSave, saveTrazosToStorage, autoSaveTimerRef, markDirty };
}
