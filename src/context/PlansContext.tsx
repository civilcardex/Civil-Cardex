import { useState, useEffect, useRef, createContext, type ReactNode } from 'react';
import { saveToStorage, loadFromStorage, removeFromStorage } from '../services/storageService';
import { storePDF, loadPDF, deletePDF } from '../services/idbStorage';
import { PLANS_META_KEY } from '../constants/storage-keys';
import { createUseContext } from './contextHelpers';

interface PlanMeta { id: number; name: string; nivel: number | null; scale: number; status: string; origen?: { x_px: number; y_px: number } | null }
interface PlanItem { id: number; file: File; name: string; nivel: number | null; scale: number; status: string; origen?: { x_px: number; y_px: number } | null }
interface PlansContextValue {
  plans: PlanItem[];
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  addPlans: (newFiles: FileList | File[]) => PlanItem[];
  removePlan: (id: number) => void;
  updatePlan: (id: number, updates: Partial<PlanItem>) => void;
  confirmPlan: (id: number) => void;
  getPlanById: (id: number) => PlanItem | null;
}

const PlansContext = createContext<PlansContextValue | null>(null);

function persistMeta(plans: PlanItem[]) {
  const meta: PlanMeta[] = plans.map(p => ({ id: p.id, name: p.name, nivel: p.nivel, scale: p.scale, status: p.status, origen: p.origen }));
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
      const restored: PlanItem[] = [];
      for (const m of meta) {
        const file = await loadPDF(m.id);
        if (file) {
          restored.push({ id: m.id, file, name: file.name, nivel: m.nivel, scale: m.scale, status: m.status, origen: m.origen });
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
        pdfs.push({ id, file: f, name: f.name, nivel: null, scale: 100, status: 'pending', origen: null });
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

  const getPlanById = (id: number) => {
    return plans.find(p => p.id === id) || null;
  };

  return (
    <PlansContext.Provider value={{ plans, error, setError, addPlans, removePlan, updatePlan, confirmPlan, getPlanById }}>
      {children}
    </PlansContext.Provider>
  );
}

export const usePlans = createUseContext(PlansContext, 'usePlans');
