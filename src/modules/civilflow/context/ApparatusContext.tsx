import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { UD_BASE_INIT, APS_DEFAULT } from '../constants';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { APS_STORAGE_KEY } from '../constants/storage-keys';
import { loadAparatosUsuario, saveAparatosUsuario } from '../services/apparatusService';

export interface UdBaseItem {
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

/**
 * Provee el catálogo de aparatos sanitarios (base UD + ítems personalizados).
 * Arranca con el caché local para no parpadear y lo actualiza con la BD al montar.
 * Solo guarda a la BD (con retardo) cuando el usuario realmente editó algo.
 */
export function ApparatusProvider({ children }: { children?: ReactNode }) {
  const [udBase, setUdBase] = useState<UdBaseItem[]>([...UD_BASE_INIT]);

  const [aps, setApsState] = useState<ApsItem[]>(loadAps);
  const dirtyRef = useRef(false);
  const setAps: React.Dispatch<React.SetStateAction<ApsItem[]>> = useCallback((updater) => {
    dirtyRef.current = true;
    setApsState(updater);
  }, []);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAparatosUsuario().then((data) => {
      if (cancelled || !data) return;
      // Si el usuario ya editó antes de que responda la red, no pisar su edición en curso
      // (el debounce de guardado ya persiste el snapshot actualizado).
      if (dirtyRef.current) return;
      setUdBase(data.udBase.length > 0 ? data.udBase : [...UD_BASE_INIT]);
      setApsState(data.aps);
      saveToStorage(APS_STORAGE_KEY, data.aps);
    });
    return () => {
      cancelled = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    saveToStorage(APS_STORAGE_KEY, aps);
  }, [aps]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveAparatosUsuario(aps);
    }, 600);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [aps]);

  const value = useMemo(
    () => ({
      udBase,
      aps,
      setAps,
    }),
    [udBase, aps, setAps],
  );

  return <ApparatusContext.Provider value={value}>{children}</ApparatusContext.Provider>;
}

/** Hook para acceder al catálogo de aparatos. @returns {ApparatusContextValue} */
export function useApparatus() {
  const ctx = useContext(ApparatusContext);
  if (!ctx) throw new Error('useApparatus must be used within ApparatusProvider');
  return ctx;
}
