import {
  createContext,
  useReducer,
  useRef,
  useMemo,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import { tramosReducer, type Tramo, type TramosState } from './tramosReducer';
import { loadSanLlTramos, loadAfAcTramos } from '../utils/buildTramos';
import { EV_SAN_SYNC, EV_HIDRO_SYNC, EV_STORAGE } from '../utils/fixtureEvents';

export type { Tramo, TramosState };

/** Guarda los tramos dibujados por red para que las tablas lean lo mismo. Ej: san (Sanitaria)/af (Agua Fria)/ac (Agua Caliente)/ll (Lluvias) + sus actualizadores. */
interface TramosContextValue {
  tramosSan: Tramo[];
  tramosAf: Tramo[];
  tramosAc: Tramo[];
  tramosLl: Tramo[];
  /** Recarga las dos listas desde lo guardado y avisa cuándo terminó (la pantalla de carga lo espera). */
  recargar: () => Promise<void>;
  updTramoSan: (id: string, field: string, val: string | number | boolean) => void;
  updTramoAf: (id: string, field: string, val: string | number | boolean) => void;
  updTramoAc: (id: string, field: string, val: string | number | boolean) => void;
  updTramoLL: (key: string, field: string, val: string | number | boolean) => void;
}

const TramosContext = createContext<TramosContextValue | null>(null);

/** Provee tramos (useReducer): carga local al montar y recarga ante eventos de sync/storage. */
export function TramosProvider({ children }: { children?: ReactNode }) {
  const [state, dispatch] = useReducer(tramosReducer, {
    tramosSan: [],
    tramosAf: [],
    tramosAc: [],
    tramosLl: [],
  } as TramosState);
  const stateRef = useRef(state);
  // Patrón "useLatest": mantener un ref que refleja el último estado para callbacks/efectos que
  // necesitan el valor actual sin listarlo como dependencia.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cargarSanLl = useCallback(() => {
    const { sanIncoming, llIncoming } = loadSanLlTramos();

    const prevSan = stateRef.current.tramosSan;
    const prevSanMap = new Map(prevSan.map((t) => [t._key, t]));
    const newSan =
      sanIncoming.length === 0
        ? []
        : sanIncoming.map((i) => {
            const existing = prevSanMap.get(i._key);
            return existing
              ? {
                  ...i,
                  descripcion: existing.descripcion || i.descripcion,
                  nSalidas: i.nSalidas || existing.nSalidas || 1,
                }
              : i;
          });
    dispatch({ type: 'SET_TRAMOS', net: 'san', payload: newSan });

    const prevLl = stateRef.current.tramosLl;
    const prevLlMap = new Map(prevLl.map((t) => [t._key, t]));
    const newLl =
      llIncoming.length === 0
        ? []
        : llIncoming.map((i) => {
            const ex = prevLlMap.get(i._key);
            return ex
              ? {
                  ...i,
                  descripcion: ex.descripcion || '',
                  desde: ex.desde || '',
                  hasta: ex.hasta || '',
                  caudal: ex.caudal ?? i.caudal,
                  diamDisPulg: ex.diamDisPulg ?? i.diamDisPulg,
                }
              : i;
          });
    dispatch({ type: 'SET_TRAMOS', net: 'll', payload: newLl });
  }, []);

  useEffect(() => {
    cargarSanLl();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(cargarSanLl, 100);
    };
    window.addEventListener(EV_SAN_SYNC, handler);
    window.addEventListener(EV_STORAGE, handler);
    return () => {
      window.removeEventListener(EV_SAN_SYNC, handler);
      window.removeEventListener(EV_STORAGE, handler);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [cargarSanLl]);

  const cargarAfAc = useCallback(() => {
    const { afIncoming, acIncoming } = loadAfAcTramos();

    const prevAf = stateRef.current.tramosAf;
    const prevAfMap = new Map(prevAf.map((t) => [t._key, t]));
    const newAf =
      afIncoming.length === 0
        ? []
        : afIncoming.map((i) => {
            const ex = prevAfMap.get(i._key);
            return ex
              ? { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' }
              : i;
          });
    dispatch({ type: 'SET_TRAMOS', net: 'af', payload: newAf });

    const prevAc = stateRef.current.tramosAc;
    const prevAcMap = new Map(prevAc.map((t) => [t._key, t]));
    const newAc =
      acIncoming.length === 0
        ? []
        : acIncoming.map((i) => {
            const ex = prevAcMap.get(i._key);
            return ex
              ? { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' }
              : i;
          });
    dispatch({ type: 'SET_TRAMOS', net: 'ac', payload: newAc });
  }, []);

  useEffect(() => {
    cargarAfAc();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(cargarAfAc, 100);
    };
    window.addEventListener(EV_HIDRO_SYNC, handler);
    window.addEventListener(EV_STORAGE, handler);
    return () => {
      window.removeEventListener(EV_HIDRO_SYNC, handler);
      window.removeEventListener(EV_STORAGE, handler);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [cargarAfAc]);

  /** Recarga las dos listas desde lo guardado. La llama la pantalla de carga cuando ya
   *  bajó todo de la nube; la promesa es solo para poder esperarla (el cambio es al instante). */
  const recargar = useCallback((): Promise<void> => {
    cargarSanLl();
    cargarAfAc();
    return Promise.resolve();
  }, [cargarSanLl, cargarAfAc]);

  const { tramosSan, tramosAf, tramosAc, tramosLl } = state;

  const updTramoSan = useCallback(
    (id: string, field: string, val: string | number | boolean) =>
      dispatch({ type: 'UPD_TRAMO', net: 'san', id, field, val }),
    [],
  );
  const updTramoAf = useCallback(
    (id: string, field: string, val: string | number | boolean) =>
      dispatch({ type: 'UPD_TRAMO', net: 'af', id, field, val }),
    [],
  );
  const updTramoAc = useCallback(
    (id: string, field: string, val: string | number | boolean) =>
      dispatch({ type: 'UPD_TRAMO', net: 'ac', id, field, val }),
    [],
  );
  const updTramoLL = useCallback(
    (key: string, field: string, val: string | number | boolean) =>
      dispatch({ type: 'UPD_TRAMO', net: 'll', id: key, field, val }),
    [],
  );

  const value = useMemo(
    () => ({
      tramosSan,
      tramosAf,
      tramosAc,
      tramosLl,
      recargar,
      updTramoSan,
      updTramoAf,
      updTramoAc,
      updTramoLL,
    }),
    [
      tramosSan,
      tramosAf,
      tramosAc,
      tramosLl,
      recargar,
      updTramoSan,
      updTramoAf,
      updTramoAc,
      updTramoLL,
    ],
  );

  return <TramosContext.Provider value={value}>{children}</TramosContext.Provider>;
}

/** Lee los tramos por red. Falla fuera de TramosProvider. */
export function useTramos() {
  const ctx = useContext(TramosContext);
  if (!ctx) throw new Error('useTramos must be used within TramosProvider');
  return ctx;
}
