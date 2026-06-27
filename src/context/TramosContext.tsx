import { createContext, useReducer, useRef, useMemo, useCallback, useContext, type ReactNode } from "react";
import { useSanLlSync, useHidroSync } from "../hooks/useTramosSync";

export interface Tramo {
  id: string;
  _key?: string;
  tipo?: string;
  planId?: string;
  piso: number;
  pisoDesde?: number;
  pisoHasta?: number;
  esBajante?: boolean;
  desde?: string;
  hasta?: string;
  descripcion?: string;
  diamDisPulg?: number;
  diametroOriginal?: string;
  nSalidas?: number;
  nmaning?: number;
  sPercent?: number;
  qLps?: number;
  recibeDe?: string[];
  recibeDeIds?: string[];
  descargaEnId?: string | null;
  fixtures: Record<string, number>;
  accesorios?: Record<string, any>;
  ini?: { x: number; y: number } | null;
  fin?: { x: number; y: number } | null;
  totalL?: number;
  Lh?: number;
  Lv?: number;
  deltaZ?: number;
  material?: string;
  bajR?: number;
  bajLong?: number;
  bajFDarcy?: number;
  bajDprop?: number;
  ventDprop?: number;
  area_m2?: number;
  pisoBase?: number;
  pisoCima?: number;
  code?: string;
  label?: string;
  dInt?: number;
  diametro_interno?: number;
  net?: string;
  _net?: string;
  ventRamalKey?: string;
}

export type TramosState = {
  tramosSan: Tramo[];
  tramosAf: Tramo[];
  tramosAc: Tramo[];
  tramosLl: Tramo[];
};

const netKey: Record<string, keyof TramosState> = {
  san: 'tramosSan', af: 'tramosAf', ac: 'tramosAc', ll: 'tramosLl',
};

function idMatch(t: Tramo, id: string): boolean {
  if (t._key) return t._key === id;
  return t.id === id;
}

type TramosAction =
  | { type: 'SET_TRAMOS'; net: string; payload: Tramo[] }
  | { type: 'DEL_TRAMO'; net: string; id: string }
  | { type: 'UPD_TRAMO'; net: string; id: string; field: string; val: any }
  | { type: 'UPD_TRAMO_ACC'; net: string; id: string; accId: string; val: any };

function tramosReducer(state: TramosState, action: TramosAction): TramosState {
  switch (action.type) {
    case 'SET_TRAMOS': {
      const key = netKey[action.net];
      return { ...state, [key]: action.payload };
    }
    case 'DEL_TRAMO': {
      const key = netKey[action.net];
      return { ...state, [key]: state[key].filter(t => !idMatch(t, action.id)) };
    }
    case 'UPD_TRAMO': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map(t =>
          idMatch(t, action.id) ? { ...t, [action.field]: action.val } : t
        ),
      };
    }
    case 'UPD_TRAMO_ACC': {
      const key = netKey[action.net];
      return {
        ...state,
        [key]: state[key].map(t =>
          idMatch(t, action.id) ? { ...t, accesorios: { ...t.accesorios, [action.accId]: action.val } } : t
        ),
      };
    }
    default:
      return state;
  }
}

interface TramosContextValue {
  tramosSan: Tramo[]; tramosAf: Tramo[]; tramosAc: Tramo[]; tramosLl: Tramo[];
  delTramoSan: (id: string) => void;
  updTramoSan: (id: string, field: string, val: any) => void;
  delTramoAf: (id: string) => void;
  updTramoAf: (id: string, field: string, val: any) => void;
  updTramoAfAcc: (id: string, accId: string, val: any) => void;
  delTramoAc: (id: string) => void;
  updTramoAc: (id: string, field: string, val: any) => void;
  updTramoAcAcc: (id: string, accId: string, val: any) => void;
  delTramoLL: (key: string) => void;
  updTramoLL: (key: string, field: string, val: any) => void;
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
stateRef.current = state;

useSanLlSync(dispatch, stateRef);
useHidroSync(dispatch, stateRef);

const { tramosSan, tramosAf, tramosAc, tramosLl } = state;

const delTramoSan = useCallback((id: string) => dispatch({ type: 'DEL_TRAMO', net: 'san', id }), []);
const updTramoSan = useCallback((id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'san', id, field, val }), []);

const delTramoAf = useCallback((id: string) => dispatch({ type: 'DEL_TRAMO', net: 'af', id }), []);
const updTramoAf = useCallback((id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'af', id, field, val }), []);
const updTramoAfAcc = useCallback((id: string, accId: string, val: any) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'af', id, accId, val }), []);

const delTramoAc = useCallback((id: string) => dispatch({ type: 'DEL_TRAMO', net: 'ac', id }), []);
const updTramoAc = useCallback((id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'ac', id, field, val }), []);
const updTramoAcAcc = useCallback((id: string, accId: string, val: any) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'ac', id, accId, val }), []);

const delTramoLL = useCallback((key: string) => dispatch({ type: 'DEL_TRAMO', net: 'll', id: key }), []);
const updTramoLL = useCallback((key: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'll', id: key, field, val }), []);

const value = useMemo(() => ({
  tramosSan, tramosAf, tramosAc, tramosLl,
  delTramoSan, updTramoSan,
  delTramoAf, updTramoAf, updTramoAfAcc,
  delTramoAc, updTramoAc, updTramoAcAcc,
  delTramoLL, updTramoLL,
}), [tramosSan, tramosAf, tramosAc, tramosLl]);

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
