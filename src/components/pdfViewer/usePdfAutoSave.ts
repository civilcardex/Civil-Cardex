import { useState, useRef, useEffect, useCallback } from "react";
import PlanoEngine from "../../lib/PlanoEngine/PlanoEngine";
import { saveToStorage, saveTrazosToDB } from "../../services/storageService";
import { writeSanDrawingSync, writeHydroDrawingSync } from "../../utils/drawingSync";

export function usePdfAutoSave(
  engineRef: React.MutableRefObject<PlanoEngine | null>,
  currentIdRef: React.MutableRefObject<any>,
  plans: any[],
) {
  const [saveStatus, setSaveStatus] = useState("saved");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback((eng: any, id: string) => {
    try {
      const work = eng.saveWork() as any;
      work.ts = Date.now();
      saveToStorage(`trazos_${id}`, work);
      if (id !== 'work') {
        saveToStorage('last_tracos_id', id);
        saveTrazosToDB(id, work);
      }
    } catch (_) {}
  }, []);

  const saveTrazosToStorage = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !eng._dirty) return;
    const id = eng._loadedPlanId || currentIdRef.current || 'work';
    performSave(eng, id);
  }, [performSave]);

  const doSave = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const id = eng._loadedPlanId || currentIdRef.current || 'work';
    eng._dirty = false;
    performSave(eng, id);
    try { writeSanDrawingSync(plans); } catch (_) {}
    try { writeHydroDrawingSync(plans); } catch (_) {}
    setSaveStatus('saved');
  }, [plans, performSave]);

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
  }, [doSave]);

  // Guardar al desmontar el hook (cambio de ruta, hot-reload, etc.)
  useEffect(() => {
    return () => { saveTrazosToStorage(); };
  }, [saveTrazosToStorage]);

  // Observar _dirty cada 300 ms y pasar a 'unsaved' cuando haya cambios pendientes
  useEffect(() => {
    const interval = setInterval(() => {
      const eng = engineRef.current;
      if (!eng) return;
      if (eng._dirty && saveStatus === 'saved') {
        setSaveStatus('unsaved');
      }
    }, 300);
    return () => clearInterval(interval);
  }, [saveStatus]);

  // Auto-save con debounce de 1500 ms tras detectar estado 'unsaved'
  useEffect(() => {
    if (saveStatus !== 'unsaved') return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const eng = engineRef.current;
      if (!eng?._dirty) { setSaveStatus('saved'); return; }
      setSaveStatus('saving');
      doSave();
    }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [saveStatus, doSave]);

  return { saveStatus, setSaveStatus, doSave, saveTrazosToStorage, autoSaveTimerRef };
}