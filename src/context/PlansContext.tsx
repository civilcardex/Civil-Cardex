import { useState, useEffect, useRef, useMemo, createContext, useContext, type ReactNode } from 'react';
import { saveToStorage, loadFromStorage, removeFromStorage } from '../services/storageService';
import { storePDF, loadPDF, deletePDF } from '../services/idbStorage';
import { PLANS_META_KEY } from '../constants/storage-keys';

interface PlanMeta { id: number; name: string; nivel: number | null; scale: number; status: string; origen?: { x_px: number; y_px: number } | null; factorX?: number | null; factorY?: number | null; calGlobal?: boolean | null; definedScale?: number | null }
interface PlanItem { id: number; file: File; name: string; nivel: number | null; scale: number; status: string; origen?: { x_px: number; y_px: number } | null; factorX?: number | null; factorY?: number | null; calGlobal?: boolean | null; definedScale?: number | null }
interface PlansContextValue {
  plans: PlanItem[];
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  addPlans: (newFiles: FileList | File[]) => PlanItem[];
  removePlan: (id: number) => void;
  updatePlan: (id: number, updates: Partial<PlanItem>) => void;
  confirmPlan: (id: number) => void;
}

const PlansContext = createContext<PlansContextValue | null>(null);

function persistMeta(plans: PlanItem[]) {
  const meta: PlanMeta[] = plans.map(({ file, ...meta }) => meta);
  if (meta.length === 0) {
    removeFromStorage(PLANS_META_KEY);
  } else {
    saveToStorage(PLANS_META_KEY, meta);
  }
}

export function PlansProvider({ children }: { children?: ReactNode }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const restoredRef = useRef(false);
  const [restoreDone, setRestoreDone] = useState(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (plans.length > 0) { setRestoreDone(true); return; }
    (async () => {
      const meta = loadFromStorage<PlanMeta[]>(PLANS_META_KEY, []);
      if (meta.length === 0) { setRestoreDone(true); return; }
      const files = await Promise.all(meta.map(m => loadPDF(m.id)));
      const restored: PlanItem[] = [];
      for (let i = 0; i < meta.length; i++) {
        const file = files[i];
        const m = meta[i];
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
  }, []);

  useEffect(() => {
    if (!restoreDone) return;
    persistMeta(plans);
  }, [plans, restoreDone]);

  const addPlans = (newFiles: FileList | File[]) => {
    const pdfs: PlanItem[] = [];
    for (const f of newFiles) {
      const isPdf = f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const id = Date.now() + Math.random();
        pdfs.push({ id, file: f, name: f.name, nivel: null, scale: 100, status: 'pending', origen: null, factorX: null, factorY: null, calGlobal: null });
        storePDF(id, f).catch(e => { if (import.meta.env.DEV) console.error('storePDF error:', e); });
      }
    }
    if (pdfs.length === 0 && newFiles.length > 0) {
      setError('Solo se permiten archivos PDF.');
      setTimeout(() => setError(null), 3000);
      return [];
    }
    if (pdfs.length === 0) return [];
    setPlans(prev => [...prev, ...pdfs]);
    return pdfs;
  };

  const removePlan = (id: number) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    deletePDF(id).catch(e => { if (import.meta.env.DEV) console.error('deletePDF error:', e); });
  };

  const updatePlan = (id: number, updates: Partial<PlanItem>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const confirmPlan = (id: number) => {
    setPlans(prev => prev.map(p => p.id === id && p.status === 'pending' ? { ...p, status: 'confirmed' } : p));
  };

  const value = useMemo(() => ({ plans, error, setError, addPlans, removePlan, updatePlan, confirmPlan }), [plans, error, addPlans, removePlan, updatePlan, confirmPlan]);

  return (
    <PlansContext.Provider value={value}>
      {children}
    </PlansContext.Provider>
  );
}

export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within PlansProvider');
  return ctx;
}
