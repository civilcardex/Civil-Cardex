
import { createContext, useReducer, useRef, useMemo, useCallback, useContext, useEffect, type ReactNode } from "react";
import { tramosReducer, type Tramo, type TramosState } from "./tramosReducer";
import { loadSanLlTramos, loadAfAcTramos } from "../utils/buildTramos";

export type { Tramo, TramosState };

interface TramosContextValue {
  tramosSan: Tramo[]; tramosAf: Tramo[]; tramosAc: Tramo[]; tramosLl: Tramo[];
  delTramoSan: (id: string) => void;
  updTramoSan: (id: string, field: string, val: string | number | boolean) => void;
  delTramoAf: (id: string) => void;
  updTramoAf: (id: string, field: string, val: string | number | boolean) => void;
  updTramoAfAcc: (id: string, accId: string, val: number) => void;
  delTramoAc: (id: string) => void;
  updTramoAc: (id: string, field: string, val: string | number | boolean) => void;
  updTramoAcAcc: (id: string, accId: string, val: number) => void;
  delTramoLL: (key: string) => void;
  updTramoLL: (key: string, field: string, val: string | number | boolean) => void;
}

const TramosContext = createContext<TramosContextValue | null>(null);

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
// eslint-disable-next-line react-hooks/refs
stateRef.current = state;

useEffect(() => {
  const load = () => {
    const { sanIncoming, llIncoming } = loadSanLlTramos();

    const prevSan = stateRef.current.tramosSan;
    const newSan = sanIncoming.length === 0 ? [] : sanIncoming.map(i => {
      const existing = prevSan.find(t => t._key === i._key);
      return existing ? { ...i, descripcion: existing.descripcion || i.descripcion, nSalidas: i.nSalidas || existing.nSalidas || 1, fixtures: { ...i.fixtures, ...existing.fixtures } } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'san', payload: newSan });

const prevLl = stateRef.current.tramosLl;
    const newLl = llIncoming.length === 0 ? [] : llIncoming.map(i => {
      const ex = prevLl.find(t => t._key === i._key);
      return ex ? { ...i, descripcion: ex.descripcion || '', desde: ex.desde || '', hasta: ex.hasta || '', caudal: ex.caudal ?? i.caudal, diamDisPulg: ex.diamDisPulg ?? i.diamDisPulg } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'll', payload: newLl });
  };
  load();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const handler = () => { timeoutId = setTimeout(load, 0); };
  ['civilflow_san_sync_changed', 'storage'].forEach(e => window.addEventListener(e, handler));
  return () => {
    ['civilflow_san_sync_changed', 'storage'].forEach(e => window.removeEventListener(e, handler));
    if (timeoutId !== null) clearTimeout(timeoutId);
  };
}, []);

useEffect(() => {
  const load = () => {
    const { afIncoming, acIncoming } = loadAfAcTramos();

    const prevAf = stateRef.current.tramosAf;
    const newAf = afIncoming.length === 0 ? [] : afIncoming.map(i => {
      const ex = prevAf.find(t => t._key === i._key);
      return ex ? { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'af', payload: newAf });

    const prevAc = stateRef.current.tramosAc;
    const newAc = acIncoming.length === 0 ? [] : acIncoming.map(i => {
      const ex = prevAc.find(t => t._key === i._key);
      return ex ? { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'ac', payload: newAc });
  };
  load();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const handler = () => { timeoutId = setTimeout(load, 0); };
  ['civilflow_hidro_sync_changed', 'storage'].forEach(e => window.addEventListener(e, handler));
  return () => {
    ['civilflow_hidro_sync_changed', 'storage'].forEach(e => window.removeEventListener(e, handler));
    if (timeoutId !== null) clearTimeout(timeoutId);
  };
}, []);

const { tramosSan, tramosAf, tramosAc, tramosLl } = state;

const delTramoSan = useCallback((id: string) => dispatch({ type: 'DEL_TRAMO', net: 'san', id }), []);
const updTramoSan = useCallback((id: string, field: string, val: string | number | boolean) => dispatch({ type: 'UPD_TRAMO', net: 'san', id, field, val }), []);

const delTramoAf = useCallback((id: string) => dispatch({ type: 'DEL_TRAMO', net: 'af', id }), []);
const updTramoAf = useCallback((id: string, field: string, val: string | number | boolean) => dispatch({ type: 'UPD_TRAMO', net: 'af', id, field, val }), []);
const updTramoAfAcc = useCallback((id: string, accId: string, val: number) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'af', id, accId, val }), []);

const delTramoAc = useCallback((id: string) => dispatch({ type: 'DEL_TRAMO', net: 'ac', id }), []);
const updTramoAc = useCallback((id: string, field: string, val: string | number | boolean) => dispatch({ type: 'UPD_TRAMO', net: 'ac', id, field, val }), []);
const updTramoAcAcc = useCallback((id: string, accId: string, val: number) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'ac', id, accId, val }), []);

const delTramoLL = useCallback((key: string) => dispatch({ type: 'DEL_TRAMO', net: 'll', id: key }), []);
const updTramoLL = useCallback((key: string, field: string, val: string | number | boolean) => dispatch({ type: 'UPD_TRAMO', net: 'll', id: key, field, val }), []);

const value = useMemo(() => ({
  tramosSan, tramosAf, tramosAc, tramosLl,
  delTramoSan, updTramoSan,
  delTramoAf, updTramoAf, updTramoAfAcc,
  delTramoAc, updTramoAc, updTramoAcAcc,
  delTramoLL, updTramoLL,
}), [
  tramosSan, tramosAf, tramosAc, tramosLl,
  delTramoSan, updTramoSan,
  delTramoAf, updTramoAf, updTramoAfAcc,
  delTramoAc, updTramoAc, updTramoAcAcc,
  delTramoLL, updTramoLL,
]);

return (
<TramosContext.Provider value={value}>
{children}
</TramosContext.Provider>
);
}

export function useTramos() {
  const ctx = useContext(TramosContext);
  if (!ctx) throw new Error('useTramos must be used within TramosProvider');
  return ctx;
}
