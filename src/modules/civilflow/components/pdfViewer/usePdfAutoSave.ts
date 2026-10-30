/** Autosave del visor: 1.5 s tras la última edición, más guardado de emergencia al cerrar pestaña/cambiar de piso (beforeunload/pagehide/desmonte). Ej: mueves un ramal → "unsaved" → 1.5 s → snapshot a caché local + BD y "✔ Guardado". */
import { useState, useRef, useEffect, useCallback } from 'react';
import PlanoEngine from '../../lib/PlanoEngine/PlanoEngine.ts';
import {
  writeSanDrawingSync,
  writeHydroDrawingSync,
  setSyncLoadedLiveIds,
} from '../../utils/drawingSync.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { persistTrazosSnapshot } from './persistStrokes.ts';

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
      // Misma secuencia que el onDirty del engine — núcleo compartido en persistTrazos.
      persistTrazosSnapshot(eng, id);
    } catch {
      // ignore
    }
  }, []);

  const saveTrazosToStorage = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !eng._dirty) return;
    // SIN guard de loadingPlanRef (orig. usuario: elementos del PRIMER piso perdidos): el
    // _dirty ya garantiza ediciones reales sobre el contenido cargado — el contenido del
    // motor al desmontar es el del piso visible, cargue o no su await de BD.
    const id = eng._loadedPlanId || currentIdRef.current || 'work';
    performSave(eng, id);
  }, [currentIdRef, engineRef, performSave]);

  const doSave = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    // SIN guard de loadingPlanRef (mismo motivo que saveTrazosToStorage): cerrar la pestaña
    // o cambiar de piso durante el await de BD de la entrada no puede perder las ediciones —
    // el _dirty solo se enciende con ediciones reales sobre el contenido ya cargado.
    const id = eng._loadedPlanId || currentIdRef.current || 'work';
    eng._dirty = false;
    performSave(eng, id);
    // Guard del GC (mismo motivo que syncDrawings en PdfViewer): el autosave también
    // dispara write*DrawingSync.
    if (eng._loadedPlanId) {
      setSyncLoadedLiveIds(String(eng._loadedPlanId), [
        ...eng.ramales.flatMap((r) => [r.id, r.label].filter(Boolean) as string[]),
        ...eng.bajantes.flatMap((b) => [b.id, b.code].filter(Boolean) as string[]),
        ...eng.areas.flatMap((a) => [a.id, a.label].filter(Boolean) as string[]),
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
  }, [currentIdRef, engineRef, plans, performSave]);

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
