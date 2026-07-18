import { createContext, useContext, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { MATS_DEFAULT, PROFS_DEFAULT, CRIT0 } from "../constants";
import { usePersistedState } from "../../../hooks/usePersistedState";
import { ACTIVE_PROYECTO_ID_KEY } from "../constants/storage-keys";
import { saveProyectoCoreData } from "../services/proyectoDataService";

export interface Proyecto {
  nombre: string; dir: string; mun: string; dep: string;
  uso: string; empresa: string; p_red: string; dot: string;
  mat_af: string; mat_ac: string; mat_rci: string;
  mat_san: string; mat_ll: string; mat_ven: string; mat_gas: string;
  altitud: string; p_atm: string;
  poblFija: number; poblFlot: number; areaPiscina: number; areaVerdes: number;
  C_escorrentia: number; pendienteSan: number;
}
export interface MaterialItem { id: string; val: string }
export interface ProfItem { id: string; red: string; col: string; prof: number; norma: string; nota: string }
export interface CritItem { id: string; red: string; param: string; val: string; uni: string; norma: string; art: string; cumple: string; nota: string }
interface ProjectContextValue {
  pisos: any[]; proy: Proyecto; mats: Record<string, MaterialItem[]>;
  profs: ProfItem[]; crits: CritItem[];
  setPisos: React.Dispatch<React.SetStateAction<any[]>>;
  setP: (k: string, v: string | number) => void;
  setProyAll: (p: Proyecto) => void;
  setMats: React.Dispatch<React.SetStateAction<Record<string, MaterialItem[]>>>;
  setProfs: React.Dispatch<React.SetStateAction<ProfItem[]>>;
  setCrits: React.Dispatch<React.SetStateAction<CritItem[]>>;
  resetToDefaults: () => void;
}

export const PROY_DEFAULTS: Proyecto = {
  nombre:'', dir:'',
  mun:'', dep:'',
  uso:'', empresa:'',
  p_red:'', dot:'',
  mat_af:'PVC-PR', mat_ac:'PVC-PR', mat_rci:'Acero SCH 40',
  mat_san:'PVC sanitario', mat_ll:'PVC sanitario',
  mat_ven:'PVC sanitario', mat_gas:'PE al PE',
  altitud:'959', p_atm:'90.32',
  poblFija:6, poblFlot:10, areaPiscina:40.12, areaVerdes:50,
  C_escorrentia:0.95, pendienteSan:0.02,
};

function cloneMats(): Record<string, MaterialItem[]> {
  return Object.fromEntries(
    Object.entries(MATS_DEFAULT).map(([k, v]) => [k, v.map(item => ({...item}))])
  );
}
function cloneProfs(): ProfItem[] { return PROFS_DEFAULT.map(p => ({...p})); }
function cloneCrits(): CritItem[] { return CRIT0.map(c => ({...c})); }

const MATS_CLONED = cloneMats();
const PROFS_CLONED = cloneProfs();
const CRITS_CLONED = cloneCrits();

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children?: ReactNode }) {
const [pisos, setPisos] = usePersistedState<any[]>('civilflow_pisos', []);
const [proy, setProy] = usePersistedState<Proyecto>('civilflow_proy', PROY_DEFAULTS);
const [mats, setMats] = usePersistedState<Record<string, MaterialItem[]>>('civilflow_mats', MATS_CLONED,
  (saved) => {
    const savedMats = saved as Record<string, MaterialItem[]>;
    const merged = { ...MATS_CLONED };
    for (const k of Object.keys(savedMats)) {
      merged[k] = savedMats[k];
    }
    return merged;
  }
);
const [profs, setProfs] = usePersistedState<ProfItem[]>('civilflow_profs', PROFS_CLONED);
const [crits, setCrits] = usePersistedState<CritItem[]>('civilflow_crits', CRITS_CLONED);

const setP = useCallback((k: string, v: string | number) => setProy(p => ({ ...p, [k]: v })), [setProy]);
const setProyAll = useCallback((p: Proyecto) => setProy(p), [setProy]);

const resetToDefaults = useCallback(() => {
  setPisos([]);
  setProy({ ...PROY_DEFAULTS });
  setMats(cloneMats());
  setProfs(cloneProfs());
  setCrits(cloneCrits());
}, [setPisos, setProy, setMats, setProfs, setCrits]);

// Debounced cloud backup of everything project-scoped besides trazos and plan PDFs
// (those save through their own dedicated paths). Mirrors usePersistedState's own
// localStorage debounce, just with a longer window since this hits the network.
useEffect(() => {
  const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
  if (!proyectoId) return;
  const timer = setTimeout(() => {
    saveProyectoCoreData(Number(proyectoId), { pisos, proy, mats, profs, crits });
  }, 1200);
  return () => clearTimeout(timer);
}, [pisos, proy, mats, profs, crits]);

const value = useMemo(() => ({
  pisos, proy, mats, profs, crits,
  setPisos, setP, setProyAll, setMats, setProfs, setCrits, resetToDefaults,
}), [pisos, proy, mats, profs, crits, setPisos, setP, setProyAll, setMats, setProfs, setCrits, resetToDefaults]);

return (
<ProjectContext.Provider value={value}>
{children}
</ProjectContext.Provider>
);
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
