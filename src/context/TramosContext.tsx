import { createContext, useReducer, useRef, useContext, type ReactNode } from "react";
import { useSanLlSync, useHidroSync } from "../hooks/useTramosSync";
import { tramosReducer, type TramosState, type Tramo } from "./tramosReducer";

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

const delTramoSan = (id: string) => dispatch({ type: 'DEL_TRAMO', net: 'san', id });
const updTramoSan = (id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'san', id, field, val });

const delTramoAf = (id: string) => dispatch({ type: 'DEL_TRAMO', net: 'af', id });
const updTramoAf = (id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'af', id, field, val });
const updTramoAfAcc = (id: string, accId: string, val: any) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'af', id, accId, val });

const delTramoAc = (id: string) => dispatch({ type: 'DEL_TRAMO', net: 'ac', id });
const updTramoAc = (id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'ac', id, field, val });
const updTramoAcAcc = (id: string, accId: string, val: any) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'ac', id, accId, val });

const delTramoLL = (key: string) => dispatch({ type: 'DEL_TRAMO', net: 'll', id: key });
const updTramoLL = (key: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'll', id: key, field, val });

return (
<TramosContext.Provider value={{
tramosSan, tramosAf, tramosAc, tramosLl,
delTramoSan, updTramoSan,
delTramoAf, updTramoAf, updTramoAfAcc,
delTramoAc, updTramoAc, updTramoAcAcc,
delTramoLL, updTramoLL,
}}>
{children}
</TramosContext.Provider>
);
}

export function useTramos() {
  const ctx = useContext(TramosContext);
  if (!ctx) throw new Error('useTramos must be used within TramosProvider');
  return ctx;
}
