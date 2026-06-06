import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { UD_BASE_INIT, APS_DEFAULT } from "../constants";
import { safeParse } from "../utils/parseUtils";

const ApparatusContext = createContext<any>(null);

const APS_STORAGE_KEY = 'civilflow_aps_v4';
function loadAps() {
  const raw = safeParse(localStorage.getItem(APS_STORAGE_KEY), null);
  if (raw && Array.isArray(raw)) return raw;
  return APS_DEFAULT.map(a => ({...a}));
}

export function ApparatusProvider({ children }: { children: ReactNode }) {
const [udBase, setUdBase] = useState([...UD_BASE_INIT]);

const [aps, setAps] = useState(loadAps);

useEffect(() => {
  try { localStorage.setItem(APS_STORAGE_KEY, JSON.stringify(aps)); } catch (e) { console.error('ApparatusContext persist aps:', e); }
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

export function useApparatus() {
  const ctx = useContext(ApparatusContext);
  if (!ctx) throw new Error("useApparatus must be used within <ApparatusProvider>");
  return ctx;
}
