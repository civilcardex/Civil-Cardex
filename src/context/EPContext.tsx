import { useState, createContext, useEffect, type ReactNode } from "react";
import { loadFromStorage, saveToStorage } from "../services/storageService";
import { createUseContext } from "./contextHelpers";

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
  setEP: React.Dispatch<React.SetStateAction<EPData>>;
  updEP: (field: keyof EPData, val: any) => void;
}

const EPContext = createContext<EPContextValue | null>(null);

export function EPProvider({ children }: { children?: ReactNode }) {
  const [ep, setEP] = useState<EPData>(() => {
    const saved = loadFromStorage("ep", null);
    if (saved) return { ...EP_DEFAULTS, ...(saved as Partial<EPData>) };
    return EP_DEFAULTS;
  });

  const updEP = (field: keyof EPData, val: any) => {
    setEP(prev => {
      const next = { ...prev, [field]: val };
      return next;
    });
  };

  useEffect(() => {
    saveToStorage("ep", ep);
  }, [ep]);

  return (
    <EPContext.Provider value={{ ep, setEP, updEP }}>
      {children}
    </EPContext.Provider>
  );
}

export const useEP = createUseContext(EPContext, 'useEP');
