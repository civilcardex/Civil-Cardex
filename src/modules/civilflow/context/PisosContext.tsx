import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { Piso } from "../components/useWorkAreaState";

interface PisosContextValue {
  pisos: Piso[];
  setPisos: React.Dispatch<React.SetStateAction<Piso[]>>;
}

export const PisosContext = createContext<PisosContextValue | null>(null);

export function PisosProvider({ children }: { children?: ReactNode }) {
  const [pisos, setPisos] = usePersistedState<Piso[]>('civilflow_pisos', []);

  const value = useMemo(() => ({ pisos, setPisos }), [pisos, setPisos]);

  return (
    <PisosContext.Provider value={value}>
      {children}
    </PisosContext.Provider>
  );
}

export function usePisos() {
  const ctx = useContext(PisosContext);
  if (!ctx) throw new Error('usePisos must be used within PisosProvider');
  return ctx;
}
