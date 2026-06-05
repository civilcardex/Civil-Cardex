import { useState, useEffect, createContext, useContext } from "react";
import { UD_BASE_INIT, MATS_DEFAULT, APS_DEFAULT, PROFS_DEFAULT, CRIT0, APARATOS_DEF } from "../components/constants";
import { readSanDrawingSync } from "../utils/sanDrawingSync";
import { readHidroDrawingSync, HIDRO_DATA_STORAGE_KEY } from "../utils/hidroDrawingSync";

const SanitarioContext = createContext(null);
let _llKey = 0;
function nextLlKey() { return `_ll_${++_llKey}`; }

function safeParse(raw, fb) { try { return JSON.parse(raw); } catch (_) { return fb; } }

const APS_STORAGE_KEY = 'civilflow_aps_v4';
function loadAps() {
  const raw = safeParse(localStorage.getItem(APS_STORAGE_KEY), null);
  if (raw && Array.isArray(raw)) return raw;
  return APS_DEFAULT.map(a => ({...a}));
}

export function SanitarioProvider({ children }) {
const [udBase, setUdBase] = useState([...UD_BASE_INIT]);

const [tramosSan, setTramosSan] = useState([]);

const [tramosAf, setTramosAf] = useState([]);
const [tramosAc, setTramosAc] = useState([]);

const [pisos, setPisos] = useState([]);

const [proy, setProy] = useState({
nombre:'', dir:'',
mun:'', dep:'',
uso:'', empresa:'',
p_red:'', dot:'',
    mat_af:'PVC-PR', mat_ac:'PVC-PR', mat_rci:'Acero SCH 40',
mat_san:'PVC sanitario', mat_ll:'PVC sanitario',
mat_ven:'PVC sanitario', mat_gas:'PE al PE',
altitud:'959', p_atm:'90.32',
poblFija:6, poblFlot:10, areaPiscina:40.12, areaVerdes:50,
C_escorrentia:0.95, pendienteSan:0.02,
});

const [tramosLl, setTramosLl] = useState([
{_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
{_key:nextLlKey(),id:'',piso:0,esBajante:true,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
{_key:nextLlKey(),id:'',piso:0,esBajante:false,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0},
]);

const [bajantesLl, setBajantesLl] = useState([
{id:'BLL-1',bajante:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,R:'',manning:0,diamPropuesto:0},
{id:'BLL-2',bajante:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,R:'',manning:0,diamPropuesto:0},
]);

const [canalesLl, setCanalesLl] = useState([
{id:'CLL-1',sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,bl:0},
{id:'CLL-2',sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,bl:0},
]);

const [mats, setMats] = useState(
  Object.fromEntries(
    Object.entries(MATS_DEFAULT).map(([k, v]) => [k, v.map(item => ({...item}))])
  )
);

const [aps, setAps] = useState(loadAps);

useEffect(() => {
  try { localStorage.setItem(APS_STORAGE_KEY, JSON.stringify(aps)); } catch (_) {}
}, [aps]);

const [profs, setProfs] = useState(PROFS_DEFAULT.map(p => ({...p})));

const [crits, setCrits] = useState(CRIT0.map(c => ({...c})));

// SANITARIA + LLUVIA sync
  useEffect(() => {
    function loadFromSync() {
      const sync = readSanDrawingSync();
      const planes = sync.planes || {};
      const hidroData = safeParse(localStorage.getItem(HIDRO_DATA_STORAGE_KEY), {}) || {};
      const sanIncoming = [];
      const llIncoming = [];
      const tribIds = new Set();
      for (const [nivel, plane] of Object.entries(planes)) {
        for (const r of (plane.ramales || [])) {
          if (r.tipo === 'tributario') tribIds.add(r.id);
        }
        const piso = parseInt(nivel);
        for (const r of (plane.ramales || [])) {
          if (r.tipo === 'tributario') continue;
          const apKey = r._aparatosKey || r.id;
          const hd = hidroData[apKey] || {};
          const tramo = {
            id: r.id, piso,
            fixtures: sync.aparatosByTramo?.[apKey] || {},
            recibeDe: [], esBajante: false, descripcion: '',
            ini: r.ini || '', fin: r.fin || '',
            diamDisPulg: r.diamPulg || 0, nSalidas: hd.nSalidas || 0,
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
        for (const b of (plane.bajantes || [])) {
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

    function buildTramos(family) {
      const incoming = [];
      for (const [key, plane] of Object.entries(planes)) {
        if (!key.startsWith(family + '_')) continue;
        const nivel = parseInt(key.slice(family.length + 1));
        for (const r of (plane.ramales || [])) {
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
          });
        }
      }
      return incoming;
    }

      const afIncoming = buildTramos('af');
      const acIncoming = buildTramos('ac');
      const hidroTribIds = new Set();
      for (const [key, plane] of Object.entries(planes)) {
        for (const r of (plane.ramales || [])) {
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

const addCanalLL = () => setCanalesLl(p => [...p, {
id:`CLL-${p.length+1}`,sector:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,manning:0,pendiente:0,b:0,h:0,bl:0,
}]);
const delCanalLL = (id) => setCanalesLl(p => p.filter(t => t.id !== id));
const updCanalLL = (id, field, val) => setCanalesLl(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

const addBajanteLL = () => setBajantesLl(p => [...p, {
id:`BLL-${p.length+1}`,bajante:'',areaParcial:0,areaAcumulada:0,intensidad:0,coeficienteC:0,R:'',manning:0,diamPropuesto:0,
}]);
const delBajanteLL = (id) => setBajantesLl(p => p.filter(t => t.id !== id));
const updBajanteLL = (id, field, val) => setBajantesLl(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

const addTramoSan = () => setTramosSan(p => [...p, {
id:`T-${p.length+1}`,piso:1,pisoDesde:1,pisoHasta:1,fixtures:{},recibeDe:[],esBajante:false,descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0,bajR:(7/24),bajLong:3,bajFDarcy:0.025,bajDprop:0,ventDprop:0,
}]);
const delTramoSan = (id) => setTramosSan(p => p.filter(t => t.id !== id));
const updTramoSan = (id, field, val) => setTramosSan(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));
const updTramoSanFix = (id, fix, val) => setTramosSan(p => p.map(t => t.id === id ? { ...t, fixtures: { ...t.fixtures, [fix]: val } } : t));

const delTramoAf = (id) => setTramosAf(p => p.filter(t => t.id !== id));
const updTramoAf = (id, field, val) => setTramosAf(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));
const updTramoAfFix = (id, fix, val) => setTramosAf(p => p.map(t => t.id === id ? { ...t, fixtures: { ...t.fixtures, [fix]: val } } : t));
const updTramoAfAcc = (id, accId, val) => setTramosAf(p => p.map(t => t.id === id ? { ...t, accesorios: { ...t.accesorios, [accId]: val } } : t));
const updTramoAfHidro = (id, field, val) => setTramosAf(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

const delTramoAc = (id) => setTramosAc(p => p.filter(t => t.id !== id));
const updTramoAc = (id, field, val) => setTramosAc(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));
const updTramoAcFix = (id, fix, val) => setTramosAc(p => p.map(t => t.id === id ? { ...t, fixtures: { ...t.fixtures, [fix]: val } } : t));
const updTramoAcAcc = (id, accId, val) => setTramosAc(p => p.map(t => t.id === id ? { ...t, accesorios: { ...t.accesorios, [accId]: val } } : t));
const updTramoAcHidro = (id, field, val) => setTramosAc(p => p.map(t => t.id === id ? { ...t, [field]: val } : t));

const addTramoLL = () => setTramosLl(p => [...p, {
_key:nextLlKey(),id:'',piso:0,esBajante:false,desde:'',hasta:'',descripcion:'',diamDisPulg:0,nSalidas:0,nmaning:0,sPercent:0,
}]);
const delTramoLL = (key) => setTramosLl(p => p.filter(t => t._key !== key));
const updTramoLL = (key, field, val) => setTramosLl(p => p.map(t => t._key === key ? { ...t, [field]: val } : t));

const setP = (k, v) => setProy(p => ({ ...p, [k]: v }));

return (
<SanitarioContext.Provider value={{
tramosSan, tramosAf, tramosAc, tramosLl, udBase, pisos, proy,
mats, aps, profs, crits,
addTramoSan, delTramoSan, updTramoSan, updTramoSanFix,
delTramoAf, updTramoAf, updTramoAfFix, updTramoAfAcc, updTramoAfHidro,
delTramoAc, updTramoAc, updTramoAcFix, updTramoAcAcc, updTramoAcHidro,
addTramoLL, delTramoLL, updTramoLL,
bajantesLl, addBajanteLL, delBajanteLL, updBajanteLL,
canalesLl, addCanalLL, delCanalLL, updCanalLL,
setUdBase, setPisos, setProy, setP,
setMats, setAps, setProfs, setCrits,
}}>
{children}
</SanitarioContext.Provider>
);
}

export function useSanitario() {
  const ctx = useContext(SanitarioContext);
  if (!ctx) throw new Error("useSanitario debe usarse dentro de <SanitarioProvider>");
  return ctx;
}