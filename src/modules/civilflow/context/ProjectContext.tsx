import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ACTIVE_PROYECTO_ID_KEY } from '../constants/storage-keys';
import { saveProyectoCoreData, loadProyectoData } from '../services/proyectoDataService';
import type { Piso } from '../lib/shared/projectTypes';
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

/** Estado agregado del proyecto: pisos, proyecto, materiales, profundidades y criterios reunidos en un solo valor de contexto para que el área de trabajo no dependa de cada sub-contexto por separado. */
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
  /** Suspende el guardado en la nube con debounce. Quienes resetean el estado y luego lo
   * repueblan de forma asíncrona desde Supabase (ProfilePage.openProyecto,
   * ProjectCreateDialog) deben llamar esto ANTES de resetear y `resumeCloudSync` DESPUÉS
   * de que su propia restauración termine — si no, el estado vacío transitorio del reset
   * queda escrito en la nube por el debounce antes de que la restauración pueda correr,
   * borrando los datos reales del proyecto. */
  pauseCloudSync: () => void;
  resumeCloudSync: () => void;
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

  // Respaldo en la nube con debounce de todo lo que pertenece al proyecto, salvo trazos y
  // PDFs de planos (esos se guardan por sus propios caminos dedicados). Mismo patrón de
  // debounce que usePersistedState en localStorage, pero con ventana más larga porque aquí
  // se golpea la red. Condicionado a restoreDone para que el estado vacío del montaje jamás
  // borre el respaldo en la nube cuando la restauración asíncrona de abajo tarda más que la
  // ventana del debounce. restoreDone nace en true cuando no hay nada que restaurar (sin
  // proyecto activo o con datos locales presentes) y solo pasa a true cuando la restauración
  // asíncrona de la nube aplica sus datos.
  const [restoreDone, setRestoreDone] = useState(() => {
    const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
    if (!proyectoId) return true;
    // mats se excluye a propósito: MaterialesContext siempre cae al default no vacío
    // MATS_CLONED (categorías predefinidas por red), así que Object.keys(mats).length
    // da > 0 incluso con localStorage vacío o acabado de limpiar — incluirlo aquí habría
    // vuelto hasLocalData true incondicionalmente, saltándose el efecto de restauración
    // de la nube de abajo en cada montaje (navegador nuevo, logout/login, reapertura desde
    // Profile) y el proyecto siempre mostraría defaults en blanco en vez del respaldo real.
    const hasLocalData = pisos.length > 0 || proy.nombre.trim() !== '';
    return hasLocalData;
  });
  useEffect(() => {
    if (!restoreDone) return;
    const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
    if (!proyectoId) return;
    const isEmptyCore =
      pisos.length === 0 &&
      profs.length === 0 &&
      crits.length === 0 &&
      Object.keys(mats).length === 0 &&
      proy.nombre.trim() === '';
    if (isEmptyCore) return;
    const timer = setTimeout(() => {
      saveProyectoCoreData(Number(proyectoId), { pisos, proy, mats, profs, crits });
    }, 1200);
    return () => clearTimeout(timer);
  }, [pisos, proy, mats, profs, crits, restoreDone]);

  // Restauración de la nube al montar: la fuente de verdad del área de trabajo es
  // localStorage, que llega vacío en un navegador nuevo (re-login, otro dispositivo,
  // storage limpiado). Supabase guarda el respaldo — se trae una sola vez mientras el
  // estado local sigue en blanco para que el proyecto, pisos, materiales, profundidades y
  // criterios vuelvan en lugar de mostrar un área de trabajo vacía.
  // Si hay datos locales, ganan ellos (una edición reciente no debe ser pisada por un
  // respaldo más viejo).
  // Sin ref de montaje único: en dev StrictMode monta el efecto dos veces y un ref dejaría
  // que la primera corrida (abortada) bloquee para siempre a la segunda. El flag ignore
  // alcanza — solo cancela el fetch en vuelo en un desmontaje real.
  useEffect(() => {
    if (restoreDone) return;
    const proyectoId = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
    if (!proyectoId) return;
    let ignore = false;
    (async () => {
      const data = await loadProyectoData(Number(proyectoId));
      if (ignore) return;
      if (data?.pisos && data.pisos.length > 0) setPisos(data.pisos);
      if (data?.proy) {
        // El mapper de filas del RPC devuelve Partial<Proyecto> con campos undefined para
        // las columnas faltantes — se filtran para que los defaults de PROY_DEFAULTS
        // sobrevivan al merge.
        const patch = Object.fromEntries(
          Object.entries(data.proy).filter(([, v]) => v != null),
        ) as Partial<Proyecto>;
        setProy((p) => ({ ...p, ...patch }));
      }
      if (data?.mats && Object.keys(data.mats).length > 0) setMats(data.mats);
      if (data?.profs && data.profs.length > 0) setProfs(data.profs);
      if (data?.crits && data.crits.length > 0) setCrits(data.crits);
      setRestoreDone(true);
    })();
    return () => {
      ignore = true;
    };
    // Intención de montaje único — restoreDone ya codifica los casos sin restauración, así
    // que nada más necesita re-ejecutarse cuando cambia el estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pauseCloudSync = useCallback(() => setRestoreDone(false), []);
  const resumeCloudSync = useCallback(() => setRestoreDone(true), []);

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
      pauseCloudSync,
      resumeCloudSync,
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
      pauseCloudSync,
      resumeCloudSync,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/** Provider raíz que compone los sub-contextos Pisos, Proyecto, Materiales, Profundidades, Criterios. */
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

/** Hook para leer/escribir el estado agregado del proyecto. @returns {ProjectContextValue} */
export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
