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
 * Arranca con el caché de localStorage (para no parpadear) y se hidrata al montar desde
 * la fuente de verdad (aparatos_usuario, o aparatos_catalogo_global como base cuando el
 * usuario aún no tiene filas; udBase desde aparatos_ud_base_global). La BD gana sobre el
 * caché. La persistencia a la BD es debounced (600 ms) y SOLO cuando el usuario edita
 * (dirty) — así el catálogo base no se copia a filas propias sin modificación previa.
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
