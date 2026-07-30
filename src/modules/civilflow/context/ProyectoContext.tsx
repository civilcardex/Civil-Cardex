import { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react';
import { usePersistedState } from '../../../hooks/usePersistedState';

export interface Proyecto {
  nombre: string;
  dir: string;
  ciudad: string;
  pais: string;
  uso: string;
  empresa: string;
  p_red: string;
  dot: string;
  mat_af: string;
  mat_ac: string;
  mat_rci: string;
  mat_san: string;
  mat_ll: string;
  mat_ven: string;
  mat_gas: string;
  altitud: string;
  p_atm: string;
  poblFija: number;
  poblFlot: number;
  areaPiscina: number;
  areaVerdes: number;
  C_escorrentia: number;
  pendienteSan: number;
}

export const PROY_DEFAULTS: Proyecto = {
  nombre: '',
  dir: '',
  ciudad: '',
  pais: '',
  uso: '',
  empresa: '',
  p_red: '',
  dot: '',
  mat_af: 'PVC-PR',
  mat_ac: 'PVC-PR',
  mat_rci: 'Acero SCH 40',
  mat_san: 'PVC sanitario',
  mat_ll: 'PVC sanitario',
  mat_ven: 'PVC sanitario',
  mat_gas: 'PE al PE',
  altitud: '959',
  p_atm: '90.32',
  poblFija: 6,
  poblFlot: 10,
  areaPiscina: 40.12,
  areaVerdes: 50,
  C_escorrentia: 0.95,
  pendienteSan: 0.02,
};

interface ProyectoContextValue {
  proy: Proyecto;
  setP: (k: string, v: string | number) => void;
  setProyAll: (p: Proyecto) => void;
  setProy: React.Dispatch<React.SetStateAction<Proyecto>>;
}

export const ProyectoContext = createContext<ProyectoContextValue | null>(null);

// Projects saved before the ciudad/pais rename still have the old 'mun'/'dep' keys — map them
// across once on load so existing projects don't appear to lose their city/country.
function recoverProyecto(saved: unknown): Proyecto {
  const s = saved as Partial<Proyecto> & { mun?: string; dep?: string };
  return {
    ...PROY_DEFAULTS,
    ...s,
    ciudad: s.ciudad ?? s.mun ?? PROY_DEFAULTS.ciudad,
    pais: s.pais ?? s.dep ?? PROY_DEFAULTS.pais,
  };
}

/** Provides proyecto master data (location, usage, materials, defaults) persisted to localStorage. */
export function ProyectoProvider({ children }: { children?: ReactNode }) {
  const [proy, setProy] = usePersistedState<Proyecto>(
    'civilflow_proy',
    PROY_DEFAULTS,
    recoverProyecto,
  );

  const setP = useCallback(
    (k: string, v: string | number) => setProy((p) => ({ ...p, [k]: v })),
    [setProy],
  );
  const setProyAll = useCallback((p: Proyecto) => setProy(p), [setProy]);

  const value = useMemo(
    () => ({ proy, setP, setProyAll, setProy }),
    [proy, setP, setProyAll, setProy],
  );

  return <ProyectoContext.Provider value={value}>{children}</ProyectoContext.Provider>;
}

/** Hook to read/write proyecto data. @returns {ProyectoContextValue} */
export function useProyecto() {
  const ctx = useContext(ProyectoContext);
  if (!ctx) throw new Error('useProyecto must be used within ProyectoProvider');
  return ctx;
}
