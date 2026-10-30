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
import { loadFromStorage, saveToStorage } from '../services/storageService.ts';
import { APS_STORAGE_KEY } from '../constants/storage-keys.ts';
import { loadAparatosUsuario, saveAparatosUsuario } from '../services/apparatusService.ts';
import { guardaConReintento } from '../../../utils/saveToCloud.ts';

/** Aparato sanitario de la lista UD base: id, nombre y cuántas UD (Unidades de Desague) gasta. Ej: lavamanos -> 2 UD. */
export interface UdBaseItem {
  id: string;
  nombre: string;
  ud: number;
}
/** Fila del catálogo APS (Aparatos del Proyecto): sigla, nombre, grupo, UC (Unidades de Consumo) af/ac, UD, presiones mín/máx, consumo de gas y control. Ej: inodoro con ucaf=4.2, ud=4. */
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

/** Entrega la lista de aparatos (el catálogo que usan las tablas). Arranca del caché local para no parpadear y trae la BD al montar. Ej: base UD (Unidades de Desague) + tus ítems propios. */
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
      // El snapshot del catálogo es destructivo: si falla, se reintenta y se avisa.
      void guardaConReintento('catalogo-aparatos', () => saveAparatosUsuario(aps));
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

/** Lee el catálogo de aparatos. Falla fuera del provider. */
export function useApparatus() {
  const ctx = useContext(ApparatusContext);
  if (!ctx) throw new Error('useApparatus must be used within ApparatusProvider');
  return ctx;
}
