import { useState, useEffect, useMemo, createContext, useContext, type ReactNode } from 'react';
import { UD_BASE_INIT, APS_DEFAULT } from '../constants';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { APS_STORAGE_KEY } from '../constants/storage-keys';

interface UdBaseItem {
  id: string;
  nombre: string;
  ud: number;
}
export interface ApsItem {
  id: string;
  s: string;
  n: string;
  g: string;
  ucaf: number;
  ucac: number;
  ud: number;
  pmin: number;
  pmax: number;
  qg: number;
  ctrl: string;
  _blkUd: boolean;
}
interface ApparatusContextValue {
  udBase: UdBaseItem[];
  aps: ApsItem[];
  setAps: React.Dispatch<React.SetStateAction<ApsItem[]>>;
}

const ApparatusContext = createContext<ApparatusContextValue | null>(null);

function loadAps() {
  const raw = loadFromStorage(APS_STORAGE_KEY, null);
  if (raw && Array.isArray(raw)) return raw;
  return APS_DEFAULT.map((a) => ({ ...a }));
}

/** Provides sanitary apparatus catalog (UD base + custom items) with localStorage persistence. */
export function ApparatusProvider({ children }: { children?: ReactNode }) {
  const [udBase] = useState([...UD_BASE_INIT]);

  const [aps, setAps] = useState(loadAps);

  useEffect(() => {
    saveToStorage(APS_STORAGE_KEY, aps);
  }, [aps]);

  const value = useMemo(
    () => ({
      udBase,
      aps,
      setAps,
    }),
    [udBase, aps],
  );

  return <ApparatusContext.Provider value={value}>{children}</ApparatusContext.Provider>;
}

/** Hook to access apparatus catalog. @returns {ApparatusContextValue} */
export function useApparatus() {
  const ctx = useContext(ApparatusContext);
  if (!ctx) throw new Error('useApparatus must be used within ApparatusProvider');
  return ctx;
}
