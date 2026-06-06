import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { readSanDrawingSync } from "../utils/sanitaryDrawingSync";
import { readHidroDrawingSync, HIDRO_DATA_STORAGE_KEY } from "../utils/hydroDrawingSync";
import { safeParse } from "../utils/parseUtils";

const TramosContext = createContext<any>(null);
let _llKey = 0;
function nextLlKey() { return `_ll_${++_llKey}`; }

export function TramosProvider({ children }: { children: ReactNode }) {
const [tramosSan, setTramosSan] = useState<any[]>([]);

const [tramosAf, setTramosAf] = useState<any[]>([]);
const [tramosAc, setTramosAc] = useState<any[]>([]);

const [tramosLl, setTramosLl] = useState<any[]>([
{_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
{_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
{_key:nextLlKey(),id:'',piso:0,esBajante:false,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
]);

// SANITARIA + LLUVIA sync
  useEffect(() => {
    function loadFromSync() {
      const sync = readSanDrawingSync();
      const planes = sync.planes || {};
      const hidroData = safeParse(localStorage.getItem(HIDRO_DATA_STORAGE_KEY), {}) || {};
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
      setTramosSan(prev => {
        if (sanIncoming.length === 0) return [];
        const keep = prev.filter(t => !sanIncoming.some(i => i.id === t.id) && !tribIds.has(t.id));
        const merged = sanIncoming.map(i => {
          const existing = prev.find(t => t.id === i.id);
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
      });
      setTramosLl(prev => {
        if (llIncoming.length === 0) return [];
        const drawingIds = new Set([...llIncoming.map(i => i.id), ...tribIds]);
        const keep = prev.filter(t => !drawingIds.has(t.id));
        const merged = llIncoming.map(i => {
          const ex = prev.find(t => t.id === i.id);
          if (ex) return { ...i, descripcion: ex.descripcion || '', desde: ex.desde || '', hasta: ex.hasta || '' };
          return i;
        });
        return [...keep, ...merged];
      });
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
      const sync = readHidroDrawingSync();
      const planes = sync.planes || {};
      const hidroData = sync.hidroData || {};
      const aparatos = sync.aparatosByTramo || {};

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

      setTramosAf(prev => {
        if (afIncoming.length === 0) return [];
        const keep = prev.filter(t => !afIncoming.some(i => i.id === t.id) && !hidroTribIds.has(t.id));
        const merged = afIncoming.map(i => {
          const ex = prev.find(t => t.id === i.id);
          if (ex) return { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' };
          return i;
        });
        return [...keep, ...merged];
      });
      setTramosAc(prev => {
        if (acIncoming.length === 0) return [];
        const keep = prev.filter(t => !acIncoming.some(i => i.id === t.id) && !hidroTribIds.has(t.id));
        const merged = acIncoming.map(i => {
          const ex = prev.find(t => t.id === i.id);
          if (ex) return { ...i, recibeDe: ex.recibeDe || [], descripcion: ex.descripcion || '' };
          return i;
        });
        return [...keep, ...merged];
      });
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

const addTramoSan = () => setTramosSan(p => [...p, {
id:`T-${p.length+1}`,piso:1,pisoDesde:1,pisoHasta:1,fixtures:{},recibeDe:[],esBajante:false,descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0,bajR:(7/24),bajLong:3,bajFDarcy:0.025,bajDprop:0,ventDprop:0,
}]);
const delTramoSan = (id: string) => setTramosSan(p => p.filter(t => t.id !== id));
const updTramoSan = (id: string, field: string, val: any) => setTramosSan(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));
const updTramoSanFix = (id: string, fix: string, val: any) => setTramosSan(p => p.map(t => t.id === id ? { ...t, fixtures: { ...t.fixtures, [fix]: val } } : t));

const delTramoAf = (id: string) => setTramosAf(p => p.filter(t => t.id !== id));
const updTramoAf = (id: string, field: string, val: any) => setTramosAf(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));
const updTramoAfFix = (id: string, fix: string, val: any) => setTramosAf(p => p.map(t => t.id === id ? { ...t, fixtures: { ...t.fixtures, [fix]: val } } : t));
const updTramoAfAcc = (id: string, accId: string, val: any) => setTramosAf(p => p.map(t => t.id === id ? { ...t, accesorios: { ...t.accesorios, [accId]: val } } : t));
const updTramoAfHidro = (id: string, field: string, val: any) => setTramosAf(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

const delTramoAc = (id: string) => setTramosAc(p => p.filter(t => t.id !== id));
const updTramoAc = (id: string, field: string, val: any) => setTramosAc(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));
const updTramoAcFix = (id: string, fix: string, val: any) => setTramosAc(p => p.map(t => t.id === id ? { ...t, fixtures: { ...t.fixtures, [fix]: val } } : t));
const updTramoAcAcc = (id: string, accId: string, val: any) => setTramosAc(p => p.map(t => t.id === id ? { ...t, accesorios: { ...t.accesorios, [accId]: val } } : t));
const updTramoAcHidro = (id: string, field: string, val: any) => setTramosAc(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

const addTramoLL = () => setTramosLl(p => [...p, {
_key:nextLlKey(),id:'',piso:0,esBajante:false,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0,
}]);
const delTramoLL = (key: string) => setTramosLl(p => p.filter(t => t._key !== key));
const updTramoLL = (key: string, field: string, val: any) => setTramosLl(p => p.map(t => t._key === key ? { ...t, [field]: val } : t));

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
