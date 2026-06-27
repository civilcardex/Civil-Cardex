import { createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { usePersistedState } from "../hooks/usePersistedState";

export interface EPData {
  qac: string;
  qasc: string;
  hfac: string;
  hfacs: string;
  hfotros: string;
  pred: string;
  pmin: string;
  pmax: string;
  zbomba: string;
  ztop: string;
  zcis: string;
  hfcis: string;
  nt: string;
  nr: string;
  etab: string;
  etam: string;
  fs: string;
  ciclos: string;
  alfa: string;
  vsuc: string;
  vimp: string;
  dnsuc: string;
  dnimp: string;
  modo: "red" | "cisterna";
  pcomercial: string;
}

const EP_DEFAULTS: EPData = {
  qac: "", qasc: "",
  hfac: "", hfacs: "", hfotros: "",
  pred: "", pmin: "5", pmax: "51",
  zbomba: "", ztop: "", zcis: "", hfcis: "",
  nt: "1", nr: "1",
  etab: "0.65", etam: "0.85", fs: "1.15",
  ciclos: "6", alfa: "0.30",
  vsuc: "1.5", vimp: "2.0",
  dnsuc: "", dnimp: "",
  modo: "red",
  pcomercial: "",
};

interface EPContextValue {
  ep: EPData;
  updEP: (field: keyof EPData, val: any) => void;
}

const EPContext = createContext<EPContextValue | null>(null);

export function EPProvider({ children }: { children?: ReactNode }) {
  const [ep, setEP] = usePersistedState<EPData>("ep", EP_DEFAULTS,
    (saved) => ({ ...EP_DEFAULTS, ...(saved as Partial<EPData>) })
  );

  const updEP = useCallback((field: keyof EPData, val: any) => {
    setEP(prev => ({ ...prev, [field]: val }));
  }, []);

  const value = useMemo(() => ({ ep, updEP }), [ep]);

  return (
    <EPContext.Provider value={value}>
      {children}
    </EPContext.Provider>
  );
}

export function useEP() {
  const ctx = useContext(EPContext);
  if (!ctx) throw new Error('useEP must be used within EPProvider');
  return ctx;
}
