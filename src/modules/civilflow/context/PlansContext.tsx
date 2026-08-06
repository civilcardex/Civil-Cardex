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
import type { PlanMeta } from '../lib/shared/projectTypes';
export type { PlanMeta } from '../lib/shared/projectTypes';

function getActiveProyectoId(): number | null {
  const raw = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
  return raw ? Number(raw) : null;
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
/** API de gestión del estado de planos — lista de planos, estado de error y operaciones CRUD (add, remove, update, confirm, reset, restore). */
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
  /** Suspende el efecto de guardado en la nube con debounce. Ver ProjectContext.pauseCloudSync
   * — aplica el mismo razonamiento: quien resetea `plans` y luego lo restaura de forma
   * asíncrona desde Supabase debe pausar primero o la lista vacía del reset se guarda
   * (borrando cada fila de planos) antes de que corra la restauración. */
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

/** Envuelve a los hijos con el estado de planos: restaura los PDFs desde IndexedDB al montar y persiste la metadata en localStorage + respaldo en la nube. Debouncea los guardados en la nube (1200ms) una vez terminada la restauración. */
export function PlansProvider({ children }: { children?: ReactNode }) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const [restoreDone, setRestoreDone] = useState(false);
  // Distinto de restoreDone (que solo significa "la restauración local desde IndexedDB
  // terminó"): el efecto de respaldo en la nube con debounce de abajo no debe dispararse
  // hasta que el efecto de restauración desde la nube también haya terminado, o un `plans`
  // vacío (aún restaurándose desde la nube) compite contra el timer de 1200ms y puede
  // sobrescribir los datos reales con un array vacío antes de que la restauración termine
  // de leerlos — perdiendo todos los planos en refresh/re-login/reapertura.
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
    // Guarda de una sola ejecución para la restauración asíncrona desde localStorage de
    // abajo — no se puede derivar de props/estado disponibles durante el render.
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
            // Guarda el PDF bajo el ID entero limpio en IndexedDB para que el resto del flujo lo encuentre con el ID ya saneado.
            await storePDF(cleanId, file);
            await deletePDF(m.id);

            // Renombra la clave de trazos en localStorage si existe, para que los trazos sigan al plan con el ID corregido y no queden huérfanos con el ID decimal.
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
    // Montaje único a propósito (protegido por restoredRef arriba) — plans.length solo se lee
    // para el valor actual de la guarda en esa única ejecución, no para re-correr en cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restauración desde la nube: mismo razonamiento que ProjectContext — un navegador nuevo
  // no tiene metadata de planos en localStorage ni PDFs en IndexedDB, pero Supabase guarda
  // ambos (tabla planos + bucket plan_pdfs). Corre una sola vez después de que termina la
  // restauración local, solo cuando la lista local está vacía, y vuelve a cachear todo
  // localmente para que las visitas siguientes sean offline-first de nuevo.
  // Sin ref de montaje único: en dev StrictMode monta el efecto dos veces y un ref dejaría
  // que la primera corrida (abortada) bloquee para siempre a la segunda. El flag ignore
  // alcanza — solo cancela el fetch en vuelo en un desmontaje real.
  useEffect(() => {
    if (!restoreDone) return;
    const proyectoId = getActiveProyectoId();
    if (!proyectoId || plans.length > 0) {
      // Guarda de una sola ejecución para la restauración asíncrona desde la nube de abajo
      // — no se puede derivar de props/estado disponibles durante el render (plans.length
      // se asienta de forma asíncrona vía IndexedDB).
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
    // Montaje único después de la restauración local — plans.length solo se lee para la
    // guarda de lista vacía.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDone]);

  useEffect(() => {
    if (!restoreDone) return;
    persistMeta(plans);
  }, [plans, restoreDone]);

  // Respaldo en la nube con debounce de la lista de planos (solo metadata — los binarios PDF
  // suben por separado conforme se agregan). Mismo espíritu de debounce que usePersistedState,
  // pero condicionado a restoreDone para que jamás dispare con una lista vacía vieja antes de
  // que la restauración local desde IndexedDB haya tenido oportunidad de poblar `plans`.
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

/** Hook consumidor de PlansContext — devuelve {plans, error, setError, addPlans, removePlan, updatePlan, confirmPlan, resetPlans, restorePlans}. Lanza error si se usa fuera de PlansProvider. */
export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within PlansProvider');
  return ctx;
}
