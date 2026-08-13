import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { MATS_DEFAULT, CRIT0, PROFS_DEFAULT } from '../constants';
import { getActiveProyectoId } from '../services/storageService';
import { saveProyectoCoreData, loadProyectoData } from '../services/proyectoDataService';
import { useDebouncedEffect } from '../../../hooks/useDebouncedEffect';
import type { Piso } from '../lib/shared/projectTypes';

export interface Proyecto {
  nombre: string;
  dir: string;
  ciudad: string;
  pais: string;
  uso: string;
  empresa: string;
  p_red: string;
  dot: string;
  mat_af: string;
  mat_ac: string;
  mat_rci: string;
  mat_san: string;
  mat_ll: string;
  mat_ven: string;
  mat_gas: string;
  altitud: string;
  p_atm: string;
  poblFija: number;
  poblFlot: number;
  areaPiscina: number;
  areaVerdes: number;
  C_escorrentia: number;
  pendienteSan: number;
}

export interface MaterialItem {
  id: string;
  val: string;
}

export interface ProfItem {
  id: string;
  red: string;
  col: string;
  prof: number;
  norma: string;
  nota: string;
}

export interface CritItem {
  id: string;
  red: string;
  param: string;
  val: string;
  uni: string;
  norma: string;
  art: string;
  cumple: string;
  nota: string;
}

export const PROY_DEFAULTS: Proyecto = {
  nombre: '',
  dir: '',
  ciudad: '',
  pais: '',
  uso: '',
  empresa: '',
  p_red: '',
  dot: '',
  mat_af: 'PVC-PR',
  mat_ac: 'PVC-PR',
  mat_rci: 'Acero SCH 40',
  mat_san: 'PVC sanitario',
  mat_ll: 'PVC sanitario',
  mat_ven: 'PVC sanitario',
  mat_gas: 'PE al PE',
  altitud: '959',
  p_atm: '90.32',
  poblFija: 6,
  poblFlot: 10,
  areaPiscina: 40.12,
  areaVerdes: 50,
  C_escorrentia: 0.95,
  pendienteSan: 0.02,
};

function cloneMats(): Record<string, MaterialItem[]> {
  return Object.fromEntries(
    Object.entries(MATS_DEFAULT).map(([k, v]) => [k, v.map((item) => ({ ...item }))]),
  );
}

function cloneProfs(): ProfItem[] {
  return PROFS_DEFAULT.map((p) => ({ ...p }));
}

function cloneCrits(): CritItem[] {
  return CRIT0.map((c) => ({ ...c }));
}

const MATS_CLONED = cloneMats();
const PROFS_CLONED = cloneProfs();
const CRITS_CLONED = cloneCrits();

// Proyectos guardados antes del renombre ciudad/pais aún tienen las claves viejas 'mun'/'dep' — se
// mapean una sola vez al cargar para que los proyectos existentes no parezcan perder ciudad/país.
function recoverProyecto(saved: unknown): Proyecto {
  const s = saved as Partial<Proyecto> & { mun?: string; dep?: string };
  return {
    ...PROY_DEFAULTS,
    ...s,
    ciudad: s.ciudad ?? s.mun ?? PROY_DEFAULTS.ciudad,
    pais: s.pais ?? s.dep ?? PROY_DEFAULTS.pais,
  };
}

export { cloneMats, cloneProfs, cloneCrits };

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
  setProy: React.Dispatch<React.SetStateAction<Proyecto>>;
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

/** Provider raíz del estado de proyecto (pisos, proyecto, materiales, profundidades, criterios). */
export function ProjectProvider({ children }: { children?: ReactNode }) {
  const [pisos, setPisos] = usePersistedState<Piso[]>('civilflow_pisos', []);
  const [proy, setProy] = usePersistedState<Proyecto>(
    'civilflow_proy',
    PROY_DEFAULTS,
    recoverProyecto,
  );
  const [mats, setMats] = usePersistedState<Record<string, MaterialItem[]>>(
    'civilflow_mats',
    MATS_CLONED,
    (saved) => {
      const savedMats = saved as Record<string, MaterialItem[]>;
      const merged = { ...MATS_CLONED };
      for (const k of Object.keys(savedMats)) {
        merged[k] = savedMats[k];
      }
      return merged;
    },
  );
  const [profs, setProfs] = usePersistedState<ProfItem[]>('civilflow_profs', PROFS_CLONED);
  const [crits, setCrits] = usePersistedState<CritItem[]>('civilflow_crits', CRITS_CLONED);

  const setP = useCallback(
    (k: string, v: string | number) => setProy((p) => ({ ...p, [k]: v })),
    [setProy],
  );
  const setProyAll = useCallback((p: Proyecto) => setProy(p), [setProy]);

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
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return true;
    // mats se excluye a propósito: siempre cae al default no vacío MATS_CLONED (categorías
    // predefinidas por red), así que Object.keys(mats).length da > 0 incluso con localStorage
    // vacío o acabado de limpiar — incluirlo aquí habría vuelto hasLocalData
    // incondicionalmente, saltándose el efecto de restauración de la nube de abajo en cada
    // montaje (navegador nuevo, logout/login, reapertura desde Profile) y el proyecto siempre
    // mostraría defaults en blanco en vez del respaldo real.
    const hasLocalData = pisos.length > 0 || proy.nombre.trim() !== '';
    return hasLocalData;
  });
  useDebouncedEffect(
    () => {
      if (!restoreDone) return;
      const proyectoId = getActiveProyectoId();
      if (!proyectoId) return;
      const isEmptyCore =
        pisos.length === 0 &&
        profs.length === 0 &&
        crits.length === 0 &&
        Object.keys(mats).length === 0 &&
        proy.nombre.trim() === '';
      if (isEmptyCore) return;
      saveProyectoCoreData(proyectoId, { pisos, proy, mats, profs, crits });
    },
    1200,
    [pisos, proy, mats, profs, crits, restoreDone],
  );

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
    const proyectoId = getActiveProyectoId();
    if (!proyectoId) return;
    let ignore = false;
    (async () => {
      const data = await loadProyectoData(proyectoId);
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
      setProy,
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
      setProy,
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

/** Hook para leer/escribir el estado agregado del proyecto. @returns {ProjectContextValue} */
export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}

/** Compat: sub-selectores del estado agregado (reemplazan los contextos individuales). */
export const usePisos = () => {
  const { pisos, setPisos } = useProject();
  return { pisos, setPisos };
};

export const useProyecto = () => {
  const { proy, setP, setProyAll, setProy } = useProject();
  return { proy, setP, setProyAll, setProy };
};

export const useMateriales = () => {
  const { mats, setMats } = useProject();
  return { mats, setMats };
};

export const useProfundidades = () => {
  const { profs, setProfs } = useProject();
  return { profs, setProfs };
};

export const useCriterios = () => {
  const { crits, setCrits } = useProject();
  return { crits, setCrits };
};
