import { useEffect, createContext, useContext, useReducer, useRef, type ReactNode } from "react";
import { readSanDrawingSync, readHydroDrawingSync } from "../utils/drawingSync";
import { HYDRO_DATA_STORAGE_KEY } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import { tramosReducer, type TramosState } from "./tramosReducer";

interface TramosContextValue {
  tramosSan: any[]; tramosAf: any[]; tramosAc: any[]; tramosLl: any[];
  addTramoSan: () => void; delTramoSan: (id: string) => void;
  updTramoSan: (id: string, field: string, val: any) => void;
  updTramoSanFix: (id: string, fix: string, val: any) => void;
  delTramoAf: (id: string) => void;
  updTramoAf: (id: string, field: string, val: any) => void;
  updTramoAfFix: (id: string, fix: string, val: any) => void;
  updTramoAfAcc: (id: string, accId: string, val: any) => void;
  updTramoAfHidro: (id: string, field: string, val: any) => void;
  delTramoAc: (id: string) => void;
  updTramoAc: (id: string, field: string, val: any) => void;
  updTramoAcFix: (id: string, fix: string, val: any) => void;
  updTramoAcAcc: (id: string, accId: string, val: any) => void;
  updTramoAcHidro: (id: string, field: string, val: any) => void;
  addTramoLL: () => void; delTramoLL: (key: string) => void;
  updTramoLL: (key: string, field: string, val: any) => void;
}

const TramosContext = createContext<TramosContextValue | null>(null);
let _llKey = 0;
function nextLlKey() { return `_ll_${++_llKey}`; }

export function TramosProvider({ children }: { children?: ReactNode }) {
const [state, dispatch] = useReducer(tramosReducer, {
  tramosSan: [] as any[],
  tramosAf: [] as any[],
  tramosAc: [] as any[],
  tramosLl: [
    {_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
    {_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
    {_key:nextLlKey(),id:'',piso:0,esBajante:false,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
  ] as any[],
} as TramosState);
const stateRef = useRef(state);
stateRef.current = state;

const { tramosSan, tramosAf, tramosAc, tramosLl } = state;

// SANITARIA + LLUVIA sync
  useEffect(() => {
    function loadFromSync() {
      const sync = readSanDrawingSync();
      const planes = sync.planes || {};
      const hidroData: Record<string, any> = loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
      const sanIncoming: any[] = [];
      const llIncoming: any[] = [];
      const tribIds = new Set<string>();
      for (const [nivel, plane] of Object.entries(planes)) {
        for (const r of ((plane as any).ramales || [])) {
          if (r.tipo === 'tributario') tribIds.add(r.id);
        }
        const piso = parseInt(nivel);
        for (const r of ((plane as any).ramales || [])) {
          if (r.tipo === 'tributario') continue;
          const apKey = r._aparatosKey || r.id;
          const hd = hidroData[apKey] || {};
          const tramo = {
            id: r.id, piso,
            fixtures: sync.aparatosByTramo?.[apKey] || {},
            recibeDe: [], esBajante: false, descripcion: '',
            ini: r.ini || '', fin: r.fin || '',
            diamDisPulg: r.diamPulg || 0, nSalidas: hd.nSalidas || 0,
            totalL: r.totalL || 0,
            nmaning: r.maning ?? 0, sPercent: r.pendiente ?? 0,
            bajR: 7/24, bajLong: 3, bajFDarcy: 0.025, bajDprop: 0, ventDprop: 0,
          };
          if (r._net === 'll') {
            llIncoming.push({
              _key: nextLlKey(), ...tramo,
              desde: '', hasta: '',
            });
          } else {
            sanIncoming.push(tramo);
          }
        }
        for (const b of ((plane as any).bajantes || [])) {
          const apKey = b._aparatosKey || b.id;
          const hd = hidroData[apKey] || {};
          const tramo = {
            id: b.id, piso,
            fixtures: sync.aparatosByTramo?.[apKey] || {},
            recibeDe: [], esBajante: true, descripcion: '',
            diamDisPulg: b.diamPulg || 0, nSalidas: hd.nSalidas || 0,
            nmaning: b.maning ?? 0, sPercent: 0,
            bajR: 7/24, bajLong: 3, bajFDarcy: 0.025, bajDprop: 0, ventDprop: 0,
            recibeDeIds: b.recibeDeIds || [],
            area_m2: b.area_m2 || 0,
            pisoBase: b.pisoBase || '', pisoCima: b.pisoCima || '',
            code: b.code || b.id,
          };
          if (b._net === 'll') {
            llIncoming.push({
              _key: nextLlKey(), ...tramo,
              desde: '', hasta: '',
            });
          } else {
            sanIncoming.push(tramo);
          }
        }
      }
      const prevSan = stateRef.current.tramosSan;
      const newSan = (() => {
        if (sanIncoming.length === 0) return [];
        const keep = prevSan.filter(t => !sanIncoming.some(i => i.id === t.id) && !tribIds.has(t.id));
        const merged = sanIncoming.map(i => {
          const existing = prevSan.find(t => t.id === i.id);
          if (existing) {
            return {
              ...i,
              descripcion: existing.descripcion || i.descripcion,
              nSalidas: existing.nSalidas ?? i.nSalidas,
              fixtures: { ...i.fixtures, ...existing.fixtures },
            };
          }
          return i;
        });
        return [...keep, ...merged];
      })();
      dispatch({ type: 'SET_SAN', payload: newSan });

      const prevLl = stateRef.current.tramosLl;
      const newLl = (() => {
        if (llIncoming.length === 0) return [];
        const drawingIds = new Set([...llIncoming.map(i => i.id), ...tribIds]);
        const keep = prevLl.filter(t => !drawingIds.has(t.id));
        const merged = llIncoming.map(i => {
          const ex = prevLl.find(t => t.id === i.id);
          if (ex) return { ...i, descripcion: ex.descripcion || '', desde: ex.desde || '', hasta: ex.hasta || '' };
          return i;
        });
        return [...keep, ...merged];
      })();
      dispatch({ type: 'SET_LL', payload: newLl });
    }
    loadFromSync();
    const handler = () => loadFromSync();
    window.addEventListener('civilflow_san_sync_changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('civilflow_san_sync_changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // AF/AC sync
  useEffect(() => {
    function loadHidro() {
      const sync = readHydroDrawingSync();
      const planes = sync.planes || {};
      const hidroData: Record<string, any> = (sync.hidroData as Record<string, any>) || {};
      const aparatos: Record<string, any> = (sync.aparatosByTramo as Record<string, any>) || {};

    function buildTramos(family: string) {
      const incoming: any[] = [];
      for (const [key, plane] of Object.entries(planes)) {
        if (!key.startsWith(family + '_')) continue;
        const nivel = parseInt(key.slice(family.length + 1));
        for (const r of ((plane as any).ramales || [])) {
          if (r.tipo === 'tributario') continue;
          const apKey = r._aparatosKey || `${family}_${r.id}`;
          const extra = hidroData[apKey] || {};
          incoming.push({
            id: r.id, piso: nivel,
            fixtures: aparatos[apKey] || {},
            accesorios: extra.accesorios || {},
            Lh: extra.Lh || 0, Lv: r.dz || extra.Lv || 0,
            nSalidas: extra.nSalidas || 0,
            recibeDe: [], descripcion: '',
            ini: r.ini || '', fin: r.fin || '',
            diamDisPulg: r.diamPulg || 0, material: r.material || '',
            totalL: r.totalL || 0,
          });
        }
      }
      return incoming;
    }

      const afIncoming = buildTramos('af');
      const acIncoming = buildTramos('ac');
      const hidroTribIds = new Set<string>();
      for (const [, plane] of Object.entries(planes)) {
        for (const r of ((plane as any).ramales || [])) {
          if (r.tipo === 'tributario') hidroTribIds.add(r.id);
        }
      }

      const prevAf = stateRef.current.tramosAf;
      const newAf = (() => {
        if (afIncoming.length === 0) return [];
        const keep = prevAf.filter(t => !afIncoming.some(i => i.id === t.id) && !hidroTribIds.has(t.id));
        const merged = afIncoming.map(i => {
          const ex = prevAf.find(t => t.id === i.id);
          if (ex) return { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' };
          return i;
        });
        return [...keep, ...merged];
      })();
      dispatch({ type: 'SET_AF', payload: newAf });

      const prevAc = stateRef.current.tramosAc;
      const newAc = (() => {
        if (acIncoming.length === 0) return [];
        const keep = prevAc.filter(t => !acIncoming.some(i => i.id === t.id) && !hidroTribIds.has(t.id));
        const merged = acIncoming.map(i => {
          const ex = prevAc.find(t => t.id === i.id);
          if (ex) return { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' };
          return i;
        });
        return [...keep, ...merged];
      })();
      dispatch({ type: 'SET_AC', payload: newAc });
    }

    loadHidro();
    const handler = () => loadHidro();
    window.addEventListener('civilflow_hidro_sync_changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('civilflow_hidro_sync_changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

const addTramoSan = () => dispatch({ type: 'ADD_SAN', newId: `T-${tramosSan.length + 1}` });
const delTramoSan = (id: string) => dispatch({ type: 'DEL_SAN', id });
const updTramoSan = (id: string, field: string, val: any) => dispatch({ type: 'UPD_SAN', id, field, val });
const updTramoSanFix = (id: string, fix: string, val: any) => dispatch({ type: 'UPD_SAN_FIX', id, fix, val });

const delTramoAf = (id: string) => dispatch({ type: 'DEL_AF', id });
const updTramoAf = (id: string, field: string, val: any) => dispatch({ type: 'UPD_AF', id, field, val });
const updTramoAfFix = (id: string, fix: string, val: any) => dispatch({ type: 'UPD_AF_FIX', id, fix, val });
const updTramoAfAcc = (id: string, accId: string, val: any) => dispatch({ type: 'UPD_AF_ACC', id, accId, val });
const updTramoAfHidro = (id: string, field: string, val: any) => dispatch({ type: 'UPD_AF', id, field, val });

const delTramoAc = (id: string) => dispatch({ type: 'DEL_AC', id });
const updTramoAc = (id: string, field: string, val: any) => dispatch({ type: 'UPD_AC', id, field, val });
const updTramoAcFix = (id: string, fix: string, val: any) => dispatch({ type: 'UPD_AC_FIX', id, fix, val });
const updTramoAcAcc = (id: string, accId: string, val: any) => dispatch({ type: 'UPD_AC_ACC', id, accId, val });
const updTramoAcHidro = (id: string, field: string, val: any) => dispatch({ type: 'UPD_AC', id, field, val });

const addTramoLL = () => dispatch({ type: 'ADD_LL', newKey: nextLlKey() });
const delTramoLL = (key: string) => dispatch({ type: 'DEL_LL', key });
const updTramoLL = (key: string, field: string, val: any) => dispatch({ type: 'UPD_LL', key, field, val });

return (
<TramosContext.Provider value={{
tramosSan, tramosAf, tramosAc, tramosLl,
addTramoSan, delTramoSan, updTramoSan, updTramoSanFix,
delTramoAf, updTramoAf, updTramoAfFix, updTramoAfAcc, updTramoAfHidro,
delTramoAc, updTramoAc, updTramoAcFix, updTramoAcAcc, updTramoAcHidro,
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
