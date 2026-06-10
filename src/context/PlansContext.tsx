import { useState, createContext, useContext, type ReactNode } from 'react';

interface PlanItem { id: number; file: File; name: string; nivel: number | null; scale: number; status: string }
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

export function PlansProvider({ children }: { children?: ReactNode }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addPlans = (newFiles: FileList | File[]) => {
    const pdfs: PlanItem[] = [];
    for (const f of newFiles) {
      const isPdf = f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) pdfs.push({ id: Date.now() + Math.random(), file: f, name: f.name, nivel: null, scale: 100, status: 'pending' });
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

export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within <PlansProvider>');
  return ctx;
}
