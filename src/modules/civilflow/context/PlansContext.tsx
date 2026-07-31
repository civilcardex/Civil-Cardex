import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { saveToStorage, loadFromStorage, removeFromStorage } from '../services/storageService';
import { storePDF, loadPDF, deletePDF } from '../services/idbStorage';
import { uploadPlanPDF, deletePlanPDF, downloadPlanPDF } from '../services/pdfStorageService';
import { saveProyectoPlansMeta, loadProyectoData } from '../services/proyectoDataService';
import { PLANS_META_KEY, ACTIVE_PROYECTO_ID_KEY } from '../constants/storage-keys';
import { devError } from '../../../utils/devError';

function getActiveProyectoId(): number | null {
  const raw = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
  return raw ? Number(raw) : null;
}

export interface PlanMeta {
  id: number;
  name: string;
  nivel: number | null;
  scale: number;
  status: string;
  origen?: { x_px: number; y_px: number } | null;
  factorX?: number | null;
  factorY?: number | null;
  calGlobal?: boolean | null;
  definedScale?: number | null;
}
export interface PlanItem {
  id: number;
  file: File;
  name: string;
  nivel: number | null;
  scale: number;
  status: string;
  origen?: { x_px: number; y_px: number } | null;
  factorX?: number | null;
  factorY?: number | null;
  calGlobal?: boolean | null;
  definedScale?: number | null;
}
/** Plan state management API — provides plan list, error state, and CRUD operations (add, remove, update, confirm, reset, restore). */
interface PlansContextValue {
  plans: PlanItem[];
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  addPlans: (newFiles: FileList | File[]) => PlanItem[];
  removePlan: (id: number) => void;
  updatePlan: (id: number, updates: Partial<PlanItem>) => void;
  confirmPlan: (id: number) => void;
  resetPlans: () => void;
  restorePlans: (items: PlanItem[]) => void;
  /** Suspends the debounced cloud-save effect. See ProjectContext.pauseCloudSync — same
   * reasoning applies here: callers that reset `plans` and then asynchronously restore it
   * from Supabase must pause first or the reset's empty list gets saved (deleting every
   * planos row) before the restore runs. */
  pauseCloudSync: () => void;
  resumeCloudSync: () => void;
}

export const PlansContext = createContext<PlansContextValue | null>(null);

function persistMeta(plans: (PlanItem | PlanMeta)[]) {
  const meta: PlanMeta[] = plans.map((p) => {
    if ('file' in p) {
      const { file: _file, ...meta } = p;
      return meta;
    }
    return p;
  });
  if (meta.length === 0) {
    removeFromStorage(PLANS_META_KEY);
  } else {
    saveToStorage(PLANS_META_KEY, meta);
  }
}

/** Wraps children with plan state, restoring PDFs from IndexedDB on mount and persisting metadata to localStorage + cloud backup. Debounces cloud saves (1200ms) after restore is done. */
export function PlansProvider({ children }: { children?: ReactNode }) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const [restoreDone, setRestoreDone] = useState(false);
  // Distinct from restoreDone (which only means "local IndexedDB restore settled"): the
  // debounced cloud-backup effect below must not fire until the cloud-restore effect has
  // also settled, or an empty `plans` (still being restored from the cloud) races the
  // 1200ms save timer and can overwrite real cloud data with an empty array before the
  // restore finishes reading it — losing every plano on refresh/relogin/reopen.
  const [cloudRestoreDone, setCloudRestoreDone] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    // One-time mount guard for an async localStorage restore below — not derivable from
    // props/state available during render.
    if (plans.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestoreDone(true);
      return;
    }
    (async () => {
      const meta = loadFromStorage<PlanMeta[]>(PLANS_META_KEY, []);
      if (meta.length === 0) {
        setRestoreDone(true);
        return;
      }

      let metaChanged = false;
      const sanitizedMeta: PlanMeta[] = [];
      const files: (File | null)[] = [];

      for (const m of meta) {
        const isDecimal = !Number.isInteger(m.id);
        if (isDecimal) {
          const cleanId = Math.floor(m.id);
          const file = await loadPDF(m.id);
          if (file) {
            // Save under clean integer ID in IndexedDB
            await storePDF(cleanId, file);
            await deletePDF(m.id);

            // Rename localStorage trazos key if present
            const oldTrazosKey = `trazos_${m.id}`;
            const newTrazosKey = `trazos_${cleanId}`;
            const oldTrazos = loadFromStorage(oldTrazosKey, null);
            if (oldTrazos) {
              saveToStorage(newTrazosKey, oldTrazos);
              removeFromStorage(oldTrazosKey);
            }

            sanitizedMeta.push({ ...m, id: cleanId });
            files.push(file);
            metaChanged = true;
          }
        } else {
          const file = await loadPDF(m.id);
          sanitizedMeta.push(m);
          files.push(file);
        }
      }

      if (metaChanged) {
        persistMeta(sanitizedMeta.map(({ id, ...r }) => ({ id, ...r })));
      }

      const restored: PlanItem[] = [];
      for (let i = 0; i < sanitizedMeta.length; i++) {
        const file = files[i];
        const m = sanitizedMeta[i];
        if (file) {
          restored.push({
            id: m.id,
            file,
            name: file.name,
            nivel: m.nivel,
            scale: m.scale,
            status: m.status,
            origen: m.origen,
            factorX: m.factorX || null,
            factorY: m.factorY || null,
            calGlobal: m.calGlobal || null,
            definedScale: m.definedScale || null,
          });
        }
      }
      if (restored.length > 0) setPlans(restored);
      setRestoreDone(true);
    })();
    // Intentionally mount-once (guarded by restoredRef above) — plans.length is only read for
    // the guard's current value at that single execution, not meant to re-run on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cloud restore: same reasoning as ProjectContext — a fresh browser has no localStorage
  // plan metadata and no IndexedDB PDFs, but Supabase holds both (planos table + plan_pdfs
  // bucket). Runs once after the local restore finishes, only when the local list is empty,
  // and re-caches everything locally so subsequent visits are offline-first again.
  // No mount-once ref: in dev StrictMode mounts the effect twice, and a ref would let the
  // first (aborted) run permanently block the second one. The ignore flag alone is enough
  // — it only cancels the in-flight fetch on a real unmount.
  useEffect(() => {
    if (!restoreDone) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId || plans.length > 0) {
      // One-time mount guard for the async cloud restore below — not derivable from
      // props/state available during render (plans.length settles async via IndexedDB).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCloudRestoreDone(true);
      return;
    }
    let ignore = false;
    (async () => {
      const data = await loadProyectoData(proyectoId);
      const meta = data?.plans_meta;
      if (!ignore && meta && meta.length > 0) {
        const restored: PlanItem[] = [];
        for (const m of meta) {
          const file = await downloadPlanPDF(proyectoId, m.id, m.name);
          if (file) {
            const item: PlanItem = {
              id: m.id,
              file,
              name: m.name,
              nivel: m.nivel,
              scale: m.scale,
              status: m.status,
              origen: m.origen,
              factorX: m.factorX || null,
              factorY: m.factorY || null,
              calGlobal: m.calGlobal || null,
              definedScale: m.definedScale || null,
            };
            restored.push(item);
            storePDF(m.id, file).catch((e) => {
              devError('storePDF error during cloud restore:', e);
            });
          }
        }
        if (!ignore && restored.length > 0) setPlans(restored);
      }
      if (!ignore) setCloudRestoreDone(true);
    })();
    return () => {
      ignore = true;
    };
    // Mount-once after local restore — plans.length is only read for the emptiness guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDone]);

  useEffect(() => {
    if (!restoreDone) return;
    persistMeta(plans);
  }, [plans, restoreDone]);

  // Debounced cloud backup of the plans list (metadata only — PDF binaries upload
  // separately as they're added). Same debounce spirit as usePersistedState, just
  // gated on restoreDone so it never fires with a stale empty list before the
  // local IndexedDB restore above has had a chance to populate `plans`.
  useEffect(() => {
    if (!cloudRestoreDone) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    const timer = setTimeout(() => {
      const meta = plans.map(({ file: _file, ...m }) => m);
      saveProyectoPlansMeta(proyectoId, meta);
    }, 1200);
    return () => clearTimeout(timer);
  }, [plans, cloudRestoreDone]);

  const addPlans = useCallback((newFiles: FileList | File[]) => {
    const pdfs: PlanItem[] = [];
    const proyectoId = getActiveProyectoId();
    for (const f of newFiles) {
      const isPdf = f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        pdfs.push({
          id,
          file: f,
          name: f.name,
          nivel: null,
          scale: 100,
          status: 'pending',
          origen: null,
          factorX: null,
          factorY: null,
          calGlobal: null,
        });
        storePDF(id, f).catch((e) => {
          devError('storePDF error:', e);
        });
        if (proyectoId) uploadPlanPDF(proyectoId, id, f);
      }
    }
    if (pdfs.length === 0 && newFiles.length > 0) {
      setError('Solo se permiten archivos PDF.');
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setError(null);
        errorTimerRef.current = null;
      }, 3000);
      return [];
    }
    if (pdfs.length === 0) return [];
    setPlans((prev) => [...prev, ...pdfs]);
    return pdfs;
  }, []);

  const removePlan = useCallback((id: number) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    deletePDF(id).catch((e) => {
      devError('deletePDF error:', e);
    });
    const proyectoId = getActiveProyectoId();
    if (proyectoId) deletePlanPDF(proyectoId, id);
  }, []);

  const updatePlan = useCallback((id: number, updates: Partial<PlanItem>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const confirmPlan = useCallback((id: number) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id && p.status === 'pending' ? { ...p, status: 'confirmed' } : p)),
    );
  }, []);

  const resetPlans = useCallback(() => {
    setPlans([]);
    removeFromStorage(PLANS_META_KEY);
  }, []);

  const restorePlans = useCallback((items: PlanItem[]) => {
    setPlans(items);
  }, []);

  const pauseCloudSync = useCallback(() => setCloudRestoreDone(false), []);
  const resumeCloudSync = useCallback(() => setCloudRestoreDone(true), []);

  const value = useMemo(
    () => ({
      plans,
      error,
      setError,
      addPlans,
      removePlan,
      updatePlan,
      confirmPlan,
      resetPlans,
      restorePlans,
      pauseCloudSync,
      resumeCloudSync,
    }),
    [
      plans,
      error,
      addPlans,
      removePlan,
      updatePlan,
      confirmPlan,
      resetPlans,
      restorePlans,
      pauseCloudSync,
      resumeCloudSync,
    ],
  );

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

/** Consumer hook for PlansContext — returns {plans, error, setError, addPlans, removePlan, updatePlan, confirmPlan, resetPlans, restorePlans}. Throws if used outside PlansProvider. */
export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within PlansProvider');
  return ctx;
}
