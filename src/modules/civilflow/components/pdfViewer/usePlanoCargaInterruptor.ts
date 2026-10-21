import { useEffect } from 'react';
import type PlanoEngine from '../../lib/PlanoEngine/PlanoMotor.ts';
import { cargarMallas } from '../../lib/PlanoEngine/nodos';
import { emitPlanLoaded } from '../../utils/aparatoEventos.ts';
import { devError } from '../../../../utils/desarrolloError.ts';
import { persistTrazosSnapshot } from './persisteTrazos.ts';

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
        // Guardado COMPARTIDO (caché local + BD): antes solo se escribía la caché local y el
        // autosave pendiente se cancelaba → lo último dibujado en ese piso nunca llegaba a la
        // BD (se perdía al abrir el proyecto en otra pestaña/dispositivo). Además
        // persistTrazosSnapshot conserva la marca de asociación entre pisos y el blindaje
        // anti-borrado de Ldesvio/anillo que `saveToStorage` se comía.
        persistTrazosSnapshot(eng, prevId);
        eng._dirty = false;
      }
    }
    const resolvedId = currentIdRef.current || currentId || '';
    if (!resolvedId) {
      loadingPlanRef.current = false;
      return;
    }
    const finCarga = (): void => {
      loadingPlanRef.current = false;
      try {
        emitPlanLoaded();
      } catch {
        /* ignore */
      }
    };
    eng._loadedPlanId = resolvedId;
    eng.mallasDeclaradas = cargarMallas(eng._loadedPlanId);
    loadingPlanRef.current = true;
    (async () => {
      try {
        const loaded = await loadTrazosForPlan(eng, resolvedId);
        const currentRefId = currentIdRef.current || 'work';
        if (resolvedId !== currentRefId) {
          finCarga();
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
            finCarga();
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
          finCarga();
        }
      } catch (e) {
        devError('[LOAD] error', e);
        finCarga();
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
