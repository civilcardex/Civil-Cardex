import { useState, useRef, useEffect, useCallback } from "react";
import PlanoEngine from "../../lib/PlanoEngine";
import { saveToStorage } from "../../services/storageService";
import { writeSanDrawingSync, writeHydroDrawingSync } from "../../utils/drawingSync";

export function usePdfAutoSave(
  engineRef: React.MutableRefObject<PlanoEngine | null>,
  currentIdRef: React.MutableRefObject<any>,
  plans: any[],
) {
  const [saveStatus, setSaveStatus] = useState("saved");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveTrazosToStorage = useCallback(() => {
    const eng = engineRef.current;
    const id = currentIdRef.current;
    if (!eng || !id) return;
    const key = `trazos_${id}`;
    saveToStorage(key, eng.saveWork());
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', saveTrazosToStorage);
    return () => window.removeEventListener('beforeunload', saveTrazosToStorage);
  }, [saveTrazosToStorage]);

  useEffect(() => {
    return () => { saveTrazosToStorage(); };
  }, [saveTrazosToStorage]);

  const doSave = useCallback(() => {
    if (!engineRef.current) return;
    const id = currentIdRef.current;
    if (!id) return;
    saveToStorage(`trazos_${id}`, engineRef.current.saveWork());
    try { writeSanDrawingSync(plans); } catch (_) {}
    try { writeHydroDrawingSync(plans); } catch (_) {}
    engineRef.current._dirty = false;
    setSaveStatus('saved');
  }, [plans]);

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

  useEffect(() => {
    if (saveStatus !== 'unsaved') return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!engineRef.current?._dirty) { setSaveStatus('saved'); return; }
      setSaveStatus('saving');
      doSave();
    }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [saveStatus, doSave]);

  return { saveStatus, setSaveStatus, doSave, saveTrazosToStorage, autoSaveTimerRef };
}
