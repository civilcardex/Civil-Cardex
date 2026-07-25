import { createContext, useContext, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import { ACTIVE_PROYECTO_ID_KEY } from '../constants/storage-keys';
import { saveProyectoCoreData } from '../services/proyectoDataService';
import type { Piso } from '../components/useWorkAreaState';
import { PisosProvider, usePisos } from './PisosContext';
import { ProyectoProvider, useProyecto, type Proyecto, PROY_DEFAULTS } from './ProyectoContext';
import {
  MaterialesProvider,
  useMateriales,
  type MaterialItem,
  cloneMats,
} from './MaterialesContext';
import {
  ProfundidadesProvider,
  useProfundidades,
  type ProfItem,
  cloneProfs,
} from './ProfundidadesContext';
import { CriteriosProvider, useCriterios, type CritItem, cloneCrits } from './CriteriosContext';

export type { Proyecto, MaterialItem, ProfItem, CritItem };
export { PROY_DEFAULTS };

/** Aggregated project-scoped state: pisos, proyecto, materiales, profundidades, criterios. */
interface ProjectContextValue {
  pisos: Piso[];
  proy: Proyecto;
  mats: Record<string, MaterialItem[]>;
  profs: ProfItem[];
  crits: CritItem[];
  setPisos: React.Dispatch<React.SetStateAction<Piso[]>>;
  setP: (k: string, v: string | number) => void;
  setProyAll: (p: Proyecto) => void;
  setMats: React.Dispatch<React.SetStateAction<Record<string, MaterialItem[]>>>;
  setProfs: React.Dispatch<React.SetStateAction<ProfItem[]>>;
  setCrits: React.Dispatch<React.SetStateAction<CritItem[]>>;
  resetToDefaults: () => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

function ProjectContextBridge({ children }: { children?: ReactNode }) {
  const { pisos, setPisos } = usePisos();
  const { proy, setP, setProyAll, setProy } = useProyecto();
  const { mats, setMats } = useMateriales();
  const { profs, setProfs } = useProfundidades();
  const { crits, setCrits } = useCriterios();

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

  const value = useMemo(
    () => ({
      pisos,
      proy,
      mats,
      profs,
      crits,
      setPisos,
      setP,
      setProyAll,
      setMats,
      setProfs,
      setCrits,
      resetToDefaults,
    }),
    [
      pisos,
      proy,
      mats,
      profs,
      crits,
      setPisos,
      setP,
      setProyAll,
      setMats,
      setProfs,
      setCrits,
      resetToDefaults,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/** Root project provider composing Pisos, Proyecto, Materiales, Profundidades, Criterios sub-contexts. */
export function ProjectProvider({ children }: { children?: ReactNode }) {
  return (
    <PisosProvider>
      <ProyectoProvider>
        <MaterialesProvider>
          <ProfundidadesProvider>
            <CriteriosProvider>
              <ProjectContextBridge>{children}</ProjectContextBridge>
            </CriteriosProvider>
          </ProfundidadesProvider>
        </MaterialesProvider>
      </ProyectoProvider>
    </PisosProvider>
  );
}

/** Hook to read/write aggregated project state. @returns {ProjectContextValue} */
export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
