import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { CRIT0 } from '../constants';
import { usePersistedState } from '../../../hooks/usePersistedState';

export interface CritItem {
  id: string;
  red: string;
  param: string;
  val: string;
  uni: string;
  norma: string;
  art: string;
  cumple: string;
  nota: string;
}

function cloneCrits(): CritItem[] {
  return CRIT0.map((c) => ({ ...c }));
}

const CRITS_CLONED = cloneCrits();

interface CriteriosContextValue {
  crits: CritItem[];
  setCrits: React.Dispatch<React.SetStateAction<CritItem[]>>;
}

export const CriteriosContext = createContext<CriteriosContextValue | null>(null);

/** Provides design criteria checklist (norm compliance) with localStorage persistence. */
export function CriteriosProvider({ children }: { children?: ReactNode }) {
  const [crits, setCrits] = usePersistedState<CritItem[]>('civilflow_crits', CRITS_CLONED);

  const value = useMemo(() => ({ crits, setCrits }), [crits, setCrits]);

  return <CriteriosContext.Provider value={value}>{children}</CriteriosContext.Provider>;
}

/** Hook to access design criteria. @returns {CriteriosContextValue} */
export function useCriterios() {
  const ctx = useContext(CriteriosContext);
  if (!ctx) throw new Error('useCriterios must be used within CriteriosProvider');
  return ctx;
}

export { cloneCrits, CRITS_CLONED };
