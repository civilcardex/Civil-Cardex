// Guardado/carga al cambiar de plano activo: si el plano anterior estaba sucio, vacía su
// autosave pendiente y persiste el trabajo; después carga los trazos del plano entrante
// (loadTrazosForPlan) o resetea el motor si no tiene nada guardado. Marca loadingPlanRef
// durante la carga para que onDirty no guarde estados a medio montar.
import { useEffect } from 'react';
import { saveToStorage } from '../../services/storageService';
import { devError } from '../../../../utils/devError';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoEngine';

interface UsePlanoLoadSwitchParams {
  engineRef: React.MutableRefObject<PlanoEngine | null>;
  engineReady: boolean;
  currentId: number | undefined;
  currentIdRef: React.RefObject<string | number | null | undefined>;
  loadTrazosForPlan: (eng: PlanoEngine, resolvedId: string | number) => Promise<boolean>;
  syncDrawings: () => void;
  autoSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadingPlanRef: React.MutableRefObject<boolean>;
  activeNetRef: React.RefObject<string>;
  activeNetworksRef: React.RefObject<Set<string>>;
  setActiveNet: React.Dispatch<React.SetStateAction<string>>;
  setScaleM: React.Dispatch<React.SetStateAction<string>>;
}

/** Guardado y carga al cambiar de plano: persiste el trabajo pendiente del plano anterior y
 *  carga los trazos del entrante, o resetea el motor si el plano no tiene nada guardado. */
export function usePlanoLoadSwitch({
  engineRef,
  engineReady,
  currentId,
  currentIdRef,
  loadTrazosForPlan,
  syncDrawings,
  autoSaveTimerRef,
  loadingPlanRef,
  activeNetRef,
  activeNetworksRef,
  setActiveNet,
  setScaleM,
}: UsePlanoLoadSwitchParams): void {
  useEffect(() => {
    if (!engineRef.current || !engineReady) return;
    const eng = engineRef.current;
    const prevId = eng._loadedPlanId;
    if (prevId && prevId !== currentId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (!loadingPlanRef.current && eng._dirty) {
        const work = eng.saveWork();
        work.ts = Date.now();
        saveToStorage(`trazos_${prevId}`, work);
        eng._dirty = false;
      }
    }
    const resolvedId = currentIdRef.current || currentId || '';
    if (!resolvedId) {
      loadingPlanRef.current = false;
      return;
    }
    eng._loadedPlanId = resolvedId;
    loadingPlanRef.current = true;
    (async () => {
      try {
        const loaded = await loadTrazosForPlan(eng, resolvedId);
        const currentRefId = currentIdRef.current || 'work';
        if (resolvedId !== currentRefId) {
          loadingPlanRef.current = false;
          return;
        }
        if (loaded) {
          const fallbackNet =
            activeNetworksRef.current &&
            activeNetworksRef.current.size > 0 &&
            !activeNetworksRef.current.has('af')
              ? Array.from(activeNetworksRef.current)[0]
              : activeNetRef.current || 'af';
          const loadedNet = eng.activeNet || fallbackNet;
          const sm = eng.scaleM;
          setActiveNet(loadedNet);
          if (sm != null) setScaleM(String(sm));
          requestAnimationFrame(() => {
            loadingPlanRef.current = false;
            if (engineRef.current) engineRef.current.render();
          });
        } else if (currentId) {
          eng.ramales = [];
          eng.bajantes = [];
          eng.areas = [];
          eng.dims = [];
          eng.textAnnots = [];
          eng.selId = null;
          eng.activeRamal = null;
          eng.activeArea = null;
          eng.setActiveNet(activeNetRef.current);
          eng.render();
          loadingPlanRef.current = false;
        }
      } catch (e) {
        devError('[LOAD] error', e);
        loadingPlanRef.current = false;
      }
    })();
    syncDrawings();
  }, [
    currentId,
    engineReady,
    loadTrazosForPlan,
    syncDrawings,
    autoSaveTimerRef,
    engineRef,
    currentIdRef,
    loadingPlanRef,
    activeNetRef,
    activeNetworksRef,
    setActiveNet,
    setScaleM,
  ]);
}
