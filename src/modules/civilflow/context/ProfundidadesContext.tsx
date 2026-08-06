import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PROFS_DEFAULT } from '../constants';
import { usePersistedState } from '../../../hooks/usePersistedState';

export interface ProfItem {
  id: string;
  red: string;
  col: string;
  prof: number;
  norma: string;
  nota: string;
}

function cloneProfs(): ProfItem[] {
  return PROFS_DEFAULT.map((p) => ({ ...p }));
}

const PROFS_CLONED = cloneProfs();

interface ProfundidadesContextValue {
  profs: ProfItem[];
  setProfs: React.Dispatch<React.SetStateAction<ProfItem[]>>;
}

export const ProfundidadesContext = createContext<ProfundidadesContextValue | null>(null);

/** Provee especificaciones de profundidad de enterrado por red/columna con persistencia en localStorage. */
export function ProfundidadesProvider({ children }: { children?: ReactNode }) {
  const [profs, setProfs] = usePersistedState<ProfItem[]>('civilflow_profs', PROFS_CLONED);

  const value = useMemo(() => ({ profs, setProfs }), [profs, setProfs]);

  return <ProfundidadesContext.Provider value={value}>{children}</ProfundidadesContext.Provider>;
}

/** Hook para acceder a las especificaciones de profundidad. @returns {ProfundidadesContextValue} */
export function useProfundidades() {
  const ctx = useContext(ProfundidadesContext);
  if (!ctx) throw new Error('useProfundidades must be used within ProfundidadesProvider');
  return ctx;
}

export { cloneProfs, PROFS_CLONED };
