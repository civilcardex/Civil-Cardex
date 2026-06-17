import { createContext, useContext, useReducer, useRef, type ReactNode } from "react";
import { useSanLlSync, useHidroSync } from "../hooks/useTramosSync";
import { tramosReducer, type TramosState, type Tramo } from "./tramosReducer";

interface TramosContextValue {
  tramosSan: Tramo[]; tramosAf: Tramo[]; tramosAc: Tramo[]; tramosLl: Tramo[];
  addTramoSan: () => void; delTramoSan: (id: string) => void;
  updTramoSan: (id: string, field: string, val: any) => void;
  updTramoSanFix: (id: string, fix: string, val: any) => void;
  delTramoAf: (id: string) => void;
  updTramoAf: (id: string, field: string, val: any) => void;
  updTramoAfFix: (id: string, fix: string, val: any) => void;
  updTramoAfAcc: (id: string, accId: string, val: any) => void;
  delTramoAc: (id: string) => void;
  updTramoAc: (id: string, field: string, val: any) => void;
  updTramoAcFix: (id: string, fix: string, val: any) => void;
  updTramoAcAcc: (id: string, accId: string, val: any) => void;
  addTramoLL: () => void; delTramoLL: (key: string) => void;
  updTramoLL: (key: string, field: string, val: any) => void;
}

const TramosContext = createContext<TramosContextValue | null>(null);
let _llKey = 0;
function nextLlKey() { return `_ll_${++_llKey}`; }

export function TramosProvider({ children }: { children?: ReactNode }) {
const [state, dispatch] = useReducer(tramosReducer, {
  tramosSan: [],
  tramosAf: [],
  tramosAc: [],
  tramosLl: [
    {_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0,fixtures:{}},
    {_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0,fixtures:{}},
    {_key:nextLlKey(),id:'',piso:0,esBajante:false,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0,fixtures:{}},
  ],
} as TramosState);
const stateRef = useRef(state);
stateRef.current = state;

useSanLlSync(dispatch, stateRef, nextLlKey);
useHidroSync(dispatch, stateRef);

const { tramosSan, tramosAf, tramosAc, tramosLl } = state;

const addTramoSan = () => dispatch({ type: 'ADD_SAN', newId: `T-${tramosSan.length + 1}` });
const delTramoSan = (id: string) => dispatch({ type: 'DEL_TRAMO', net: 'san', id });
const updTramoSan = (id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'san', id, field, val });
const updTramoSanFix = (id: string, fix: string, val: any) => dispatch({ type: 'UPD_TRAMO_FIX', net: 'san', id, fix, val });

const delTramoAf = (id: string) => dispatch({ type: 'DEL_TRAMO', net: 'af', id });
const updTramoAf = (id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'af', id, field, val });
const updTramoAfFix = (id: string, fix: string, val: any) => dispatch({ type: 'UPD_TRAMO_FIX', net: 'af', id, fix, val });
const updTramoAfAcc = (id: string, accId: string, val: any) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'af', id, accId, val });

const delTramoAc = (id: string) => dispatch({ type: 'DEL_TRAMO', net: 'ac', id });
const updTramoAc = (id: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'ac', id, field, val });
const updTramoAcFix = (id: string, fix: string, val: any) => dispatch({ type: 'UPD_TRAMO_FIX', net: 'ac', id, fix, val });
const updTramoAcAcc = (id: string, accId: string, val: any) => dispatch({ type: 'UPD_TRAMO_ACC', net: 'ac', id, accId, val });

const addTramoLL = () => dispatch({ type: 'ADD_LL', newKey: nextLlKey() });
const delTramoLL = (key: string) => dispatch({ type: 'DEL_TRAMO', net: 'll', id: key });
const updTramoLL = (key: string, field: string, val: any) => dispatch({ type: 'UPD_TRAMO', net: 'll', id: key, field, val });

return (
<TramosContext.Provider value={{
tramosSan, tramosAf, tramosAc, tramosLl,
addTramoSan, delTramoSan, updTramoSan, updTramoSanFix,
delTramoAf, updTramoAf, updTramoAfFix, updTramoAfAcc,
delTramoAc, updTramoAc, updTramoAcFix, updTramoAcAcc,
addTramoLL, delTramoLL, updTramoLL,
}}>
{children}
</TramosContext.Provider>
);
}

export function useTramos() {
  const ctx = useContext(TramosContext);
  if (!ctx) throw new Error("useTramos must be used within <TramosProvider>");
  return ctx;
}
