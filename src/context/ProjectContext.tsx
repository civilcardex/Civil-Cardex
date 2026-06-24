import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MATS_DEFAULT, PROFS_DEFAULT, CRIT0 } from "../constants";
import { usePersistedState } from "../hooks/usePersistedState";

interface Proyecto {
  nombre: string; dir: string; mun: string; dep: string;
  uso: string; empresa: string; p_red: string; dot: string;
  mat_af: string; mat_ac: string; mat_rci: string;
  mat_san: string; mat_ll: string; mat_ven: string; mat_gas: string;
  altitud: string; p_atm: string;
  poblFija: number; poblFlot: number; areaPiscina: number; areaVerdes: number;
  C_escorrentia: number; pendienteSan: number;
}
interface MaterialItem { id: string; val: string }
interface ProfItem { id: string; red: string; col: string; prof: number; norma: string; nota: string }
interface CritItem { id: string; red: string; param: string; val: string; uni: string; norma: string; art: string; cumple: string; nota: string }
interface ProjectContextValue {
  pisos: any[]; proy: Proyecto; mats: Record<string, MaterialItem[]>;
  profs: ProfItem[]; crits: CritItem[];
  setPisos: React.Dispatch<React.SetStateAction<any[]>>;
  setP: (k: string, v: any) => void;
  setMats: React.Dispatch<React.SetStateAction<Record<string, MaterialItem[]>>>;
  setProfs: React.Dispatch<React.SetStateAction<ProfItem[]>>;
  setCrits: React.Dispatch<React.SetStateAction<CritItem[]>>;
}

const PROY_DEFAULTS: Proyecto = {
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

const MATS_CLONED: Record<string, MaterialItem[]> = Object.fromEntries(
  Object.entries(MATS_DEFAULT).map(([k, v]) => [k, v.map(item => ({...item}))])
);

const PROFS_CLONED: ProfItem[] = PROFS_DEFAULT.map(p => ({...p}));
const CRITS_CLONED: CritItem[] = CRIT0.map(c => ({...c}));

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children?: ReactNode }) {
const [pisos, setPisos] = usePersistedState<any[]>('civilflow_pisos', []);
const [proy, setProy] = usePersistedState<Proyecto>('civilflow_proy', PROY_DEFAULTS);
const [mats, setMats] = usePersistedState<Record<string, MaterialItem[]>>('civilflow_mats', MATS_CLONED);
const [profs, setProfs] = usePersistedState<ProfItem[]>('civilflow_profs', PROFS_CLONED);
const [crits, setCrits] = usePersistedState<CritItem[]>('civilflow_crits', CRITS_CLONED);

const setP = (k: string, v: any) => setProy(p => ({ ...p, [k]: v }));

const value = useMemo(() => ({
  pisos, proy, mats, profs, crits,
  setPisos, setP, setMats, setProfs, setCrits,
}), [pisos, proy, mats, profs, crits]);

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
