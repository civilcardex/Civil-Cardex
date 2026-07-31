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

export type { Tramo, TramosState };

/** Tramo state management API — provides tramo lists for each network (san, af, ac, ll) and per-network field updaters. */
interface TramosContextValue {
  tramosSan: Tramo[];
  tramosAf: Tramo[];
  tramosAc: Tramo[];
  tramosLl: Tramo[];
  updTramoSan: (id: string, field: string, val: string | number | boolean) => void;
  updTramoAf: (id: string, field: string, val: string | number | boolean) => void;
  updTramoAc: (id: string, field: string, val: string | number | boolean) => void;
  updTramoLL: (key: string, field: string, val: string | number | boolean) => void;
}

const TramosContext = createContext<TramosContextValue | null>(null);

/** Wraps children with useReducer-based tramo state, loading san/ll and af/ac tramos from localStorage on mount. Reacts to `civilflow_*_sync_changed` and `storage` events to reload dirty data. */
export function TramosProvider({ children }: { children?: ReactNode }) {
  const [state, dispatch] = useReducer(tramosReducer, {
    tramosSan: [],
    tramosAf: [],
    tramosAc: [],
    tramosLl: [],
  } as TramosState);
  const stateRef = useRef(state);
  // "useLatest" pattern: keep a ref mirroring the latest state for callbacks/effects that
  // need the current value without listing it as a dependency.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const load = () => {
      const { sanIncoming, llIncoming } = loadSanLlTramos();

      const prevSan = stateRef.current.tramosSan;
      const newSan =
        sanIncoming.length === 0
          ? []
          : sanIncoming.map((i) => {
              const existing = prevSan.find((t) => t._key === i._key);
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
      const newLl =
        llIncoming.length === 0
          ? []
          : llIncoming.map((i) => {
              const ex = prevLl.find((t) => t._key === i._key);
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
    };
    load();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      timeoutId = setTimeout(load, 0);
    };
    window.addEventListener('civilflow_san_sync_changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('civilflow_san_sync_changed', handler);
      window.removeEventListener('storage', handler);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const load = () => {
      const { afIncoming, acIncoming } = loadAfAcTramos();

      const prevAf = stateRef.current.tramosAf;
      const newAf =
        afIncoming.length === 0
          ? []
          : afIncoming.map((i) => {
              const ex = prevAf.find((t) => t._key === i._key);
              return ex
                ? { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' }
                : i;
            });
      dispatch({ type: 'SET_TRAMOS', net: 'af', payload: newAf });

      const prevAc = stateRef.current.tramosAc;
      const newAc =
        acIncoming.length === 0
          ? []
          : acIncoming.map((i) => {
              const ex = prevAc.find((t) => t._key === i._key);
              return ex
                ? { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' }
                : i;
            });
      dispatch({ type: 'SET_TRAMOS', net: 'ac', payload: newAc });
    };
    load();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      timeoutId = setTimeout(load, 0);
    };
    window.addEventListener('civilflow_hidro_sync_changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('civilflow_hidro_sync_changed', handler);
      window.removeEventListener('storage', handler);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

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
      updTramoSan,
      updTramoAf,
      updTramoAc,
      updTramoLL,
    }),
    [tramosSan, tramosAf, tramosAc, tramosLl, updTramoSan, updTramoAf, updTramoAc, updTramoLL],
  );

  return <TramosContext.Provider value={value}>{children}</TramosContext.Provider>;
}

/** Consumer hook for TramosContext — returns {tramosSan, tramosAf, tramosAc, tramosLl, updTramoSan, updTramoAf, updTramoAc, updTramoLL}. Throws if used outside TramosProvider. */
export function useTramos() {
  const ctx = useContext(TramosContext);
  if (!ctx) throw new Error('useTramos must be used within TramosProvider');
  return ctx;
}
