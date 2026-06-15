import { useState, useEffect, createContext, type ReactNode } from "react";
import { UD_BASE_INIT, APS_DEFAULT } from "../constants";
import { loadFromStorage, saveToStorage } from "../services/storageService";
import { APS_STORAGE_KEY } from "../constants/storage-keys";
import { createUseContext } from "./contextHelpers";

interface UdBaseItem { id: string; nombre: string; ud: number }
interface ApsItem { id: string; s: string; n: string; g: string; ucaf: number; ucac: number; ud: number; pmin: number; pmax: number; qg: number; ctrl: string; _blkUd: boolean }
interface ApparatusContextValue {
  udBase: UdBaseItem[];
  aps: ApsItem[];
  setUdBase: React.Dispatch<React.SetStateAction<UdBaseItem[]>>;
  setAps: React.Dispatch<React.SetStateAction<ApsItem[]>>;
}

const ApparatusContext = createContext<ApparatusContextValue | null>(null);

function loadAps() {
  const raw = loadFromStorage(APS_STORAGE_KEY, null);
  if (raw && Array.isArray(raw)) return raw;
  return APS_DEFAULT.map(a => ({...a}));
}

export function ApparatusProvider({ children }: { children?: ReactNode }) {
const [udBase, setUdBase] = useState([...UD_BASE_INIT]);

const [aps, setAps] = useState(loadAps);

useEffect(() => {
  saveToStorage(APS_STORAGE_KEY, aps);
}, [aps]);

return (
<ApparatusContext.Provider value={{
udBase, aps,
setUdBase, setAps,
}}>
{children}
</ApparatusContext.Provider>
);
}

export const useApparatus = createUseContext(ApparatusContext, 'useApparatus');
