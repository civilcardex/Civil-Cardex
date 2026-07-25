import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { MATS_DEFAULT } from '../constants';
import { usePersistedState } from '../../../hooks/usePersistedState';

export interface MaterialItem {
  id: string;
  val: string;
}

function cloneMats(): Record<string, MaterialItem[]> {
  return Object.fromEntries(
    Object.entries(MATS_DEFAULT).map(([k, v]) => [k, v.map((item) => ({ ...item }))]),
  );
}

const MATS_CLONED = cloneMats();

interface MaterialesContextValue {
  mats: Record<string, MaterialItem[]>;
  setMats: React.Dispatch<React.SetStateAction<Record<string, MaterialItem[]>>>;
}

export const MaterialesContext = createContext<MaterialesContextValue | null>(null);

/** Provides pipe/fitting material catalog per network type, persisted to localStorage. */
export function MaterialesProvider({ children }: { children?: ReactNode }) {
  const [mats, setMats] = usePersistedState<Record<string, MaterialItem[]>>(
    'civilflow_mats',
    MATS_CLONED,
    (saved) => {
      const savedMats = saved as Record<string, MaterialItem[]>;
      const merged = { ...MATS_CLONED };
      for (const k of Object.keys(savedMats)) {
        merged[k] = savedMats[k];
      }
      return merged;
    },
  );

  const value = useMemo(() => ({ mats, setMats }), [mats, setMats]);

  return <MaterialesContext.Provider value={value}>{children}</MaterialesContext.Provider>;
}

/** Hook to access material catalog. @returns {MaterialesContextValue} */
export function useMateriales() {
  const ctx = useContext(MaterialesContext);
  if (!ctx) throw new Error('useMateriales must be used within MaterialesProvider');
  return ctx;
}

export { cloneMats, MATS_CLONED };
