
import { createContext, useReducer, useRef, useMemo, useCallback, useContext, useEffect, type ReactNode } from "react";
import { readSanDrawingSync, readHydroDrawingSync } from "../utils/drawingSync";
import { diamPulgFromLabel } from "../utils/diamPulgFromLabel";
import { HYDRO_DATA_STORAGE_KEY } from "../constants/storage-keys";
import { loadFromStorage, loadPlanTrazos, savePlanTrazos } from "../services/storageService";
import { pisoLbl, pisoCorto } from "../constants";

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

function buildTramos(
  family: string,
  planes: Record<string, any>,
  hidroData: Record<string, any>,
  aparatos: Record<string, any>,
) {
  const incoming: any[] = [];

  for (const [key, plane] of Object.entries(planes)) {
    if (!key.startsWith(family + '_')) continue;
    const nivel = parseInt(key.slice(family.length + 1));
    const planId = (plane as any).planoId || '';
    const raw = loadPlanTrazos(planId);
    let drawingBajantes: any[] = [];
    let drawingData: any = null;
    if (raw) {
      drawingData = raw;
      if (typeof drawingData === 'string') {
        try { drawingData = JSON.parse(drawingData); } catch { /* ignore */ }
      }
      drawingBajantes = drawingData?.bajantes || [];
    }

    for (const r of ((plane as any).ramales || [])) {
      const rId = r.id;
      let ini = String(r.ini || '');
      let fin = String(r.fin || '');

      if (family === 'af' && drawingBajantes.length > 0) {
        const pts = r.pts || [];
        if (pts.length >= 2) {
          const pStart = pts[0];
          const pEnd = pts[pts.length - 1];
          const floorNum = typeof r.piso === 'number' ? r.piso : parseInt(r.piso || String(nivel));
          const lvlLabel = pisoLbl(floorNum);

          const findConnectedBajante = (pt: number[]) => {
            for (const b of drawingBajantes) {
              const disp = b.desplazamientos?.[lvlLabel] || {};
              const bx = b.x + (disp.dx || 0);
              const by = b.y + (disp.dy || 0);
              const isExplicit = b.recibeDeIds && (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
              const dist = Math.hypot(pt[0] - bx, pt[1] - by);
              if (isExplicit) {
                const otherPt = pt === pStart ? pEnd : pStart;
                const otherDist = Math.hypot(otherPt[0] - bx, otherPt[1] - by);
                if (dist < otherDist) return b;
              } else if (dist < 2.0) {
                return b;
              }
            }
            return null;
          };

          const bStart = findConnectedBajante(pStart);
          const bEnd = findConnectedBajante(pEnd);

          let newIni = r.ini || '';
          let newFin = r.fin || '';

          if (bStart && bEnd) {
            const isStartCont = bStart.tipo === 'contador';
            const isStartMon = bStart.tipo === 'montante';
            const isEndCont = bEnd.tipo === 'contador';
            const isEndMon = bEnd.tipo === 'montante';

            if ((isStartCont && isEndMon) || (isStartMon && isEndCont)) {
              const cont = isStartCont ? bStart : bEnd;
              const mon = isStartMon ? bStart : bEnd;
              newIni = cont.code || cont.id;
              newFin = mon.code || mon.id;
            } else {
              newIni = bStart.code || bStart.id;
              newFin = bEnd.code || bEnd.id;
            }
          } else {
            if (bStart) {
              newIni = bStart.code || bStart.id;
            }
            if (bEnd) {
              newFin = bEnd.code || bEnd.id;
            }
          }

          if (r.ini !== newIni || r.fin !== newFin) {
            r.ini = newIni;
            r.fin = newFin;

            if (drawingData) {
              for (const drawingRamal of (drawingData.ramales || [])) {
                if (drawingRamal.id === r.id) {
                  drawingRamal.ini = newIni;
                  drawingRamal.fin = newFin;
                  break;
                }
              }
              savePlanTrazos(planId, drawingData);
            }
          }
          ini = newIni;
          fin = newFin;
        }
      }

      const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

      const isAC1 = (() => {
        if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
        if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B')) return true;
        return false;
      })();
      const isAC2 = (() => {
        if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
        if (isContador(ini)) return true;
        if (isContador(fin) && (ini.startsWith('M') || ini.startsWith('B'))) return true;
        return false;
      })();

      let apKey = r._aparatosKey || `${family}_${r.id}_${planId}`;
      if (family === 'af' && isAC1) {
        const cntId = isContador(fin) ? fin : (isContador(ini) ? ini : null);
        if (cntId) {
          apKey = `${family}_${cntId}_${planId}`;
        }
      }
      const extra = hidroData[apKey] || {};
      let dznSalidas = r.nSalidas || 1;
      let dzLvert = r.lvert ?? r.dz ?? 0;
      if (drawingData) {
        const dr = (drawingData.ramales || []).find((x: any) => x.id === r.id);
        if (dr) {
          if (!dznSalidas) dznSalidas = dr.nSalidas || 1;
          if (dzLvert === 0 || dzLvert === undefined) dzLvert = parseFloat(dr.lvert ?? dr.dz) || 0;
        }
      }
          incoming.push({
            _key: `${rId}-${planId}`,
            id: rId, label: r.label || r.id, piso: nivel, planId,
            _net: r._net || family,
            tipo: r.tipo || 'ramal',
            esBajante: false,
            fixtures: aparatos[apKey] || {},
            accesorios: extra.accesorios || {},
            Lh: extra.Lh || 0, Lv: (family === 'ac' && (isAC1 || isAC2)) ? 0 : dzLvert,
            nSalidas: dznSalidas,
            recibeDe: [], descripcion: '',
            ini: ini, fin: fin,
            diamDisPulg: diamPulgFromLabel(r.diametro) || r.diamPulg || 0, diametroOriginal: r.diametro || '', material: r.material || '',
            totalL: r.totalL || 0,
            _nivelLabel: pisoLbl(typeof r.piso === 'number' ? r.piso : parseInt(r.piso || String(nivel)))
          });
    }

    if (family === 'af') {
      const contadores = drawingBajantes.filter(b => b.tipo === 'contador' && (b.net === 'af' || !b.net));
      for (const cnt of contadores) {
        const cntId = cnt.code || cnt.id;
        const hasAC1 = incoming.some(r => r.fin === cntId && (r.ini.startsWith('RP') || r.ini === 'RP'));
        if (!hasAC1) {
          const rId = `AC-01-${cntId}`;
          const apKey = `af_${cntId}_${planId}`;
          const extra = hidroData[apKey] || {};
          const pisoCnt = typeof cnt.piso === 'number' ? cnt.piso : parseInt(cnt.pisoBase || String(nivel));
          incoming.push({
            _key: `${rId}-${planId}`,
            id: rId, piso: isNaN(pisoCnt) ? nivel : pisoCnt, planId,
            _net: 'af',
            tipo: 'ramal',
            esBajante: false,
            fixtures: aparatos[apKey] || {},
            accesorios: extra.accesorios || {},
            Lh: extra.Lh || 0, Lv: 0,
            nSalidas: 1,
            recibeDe: [], descripcion: '',
            ini: 'RP', fin: cntId,
            diamDisPulg: extra.dNominal ? diamPulgFromLabel(String(extra.dNominal)) : 0,
            diametroOriginal: extra.dNominal ? String(extra.dNominal) : '',
            material: extra.material || '',
            totalL: 0,
            _nivelLabel: pisoLbl(isNaN(pisoCnt) ? nivel : pisoCnt)
          });
        }
      }
    } else if (family === 'ac') {
      const calentadores = drawingBajantes.filter(b => b.tipo === 'calentador' && (b.net === 'ac' || !b.net));
      for (const cal of calentadores) {
        const calId = cal.code || cal.id;
        const hasAC1 = incoming.some(r => r.fin === calId && r.ini === 'AF');
        if (!hasAC1) {
          const rId = `AC-01-${calId}`;
          const apKey = `ac_${calId}_${planId}`;
          const extra = hidroData[apKey] || {};
          const pisoCal = typeof cal.piso === 'number' ? cal.piso : parseInt(cal.pisoBase || String(nivel));
          incoming.push({
            _key: `${rId}-${planId}`,
            id: rId, piso: isNaN(pisoCal) ? nivel : pisoCal, planId,
            _net: 'ac',
            tipo: 'ramal',
            esBajante: false,
            fixtures: aparatos[apKey] || {},
            accesorios: extra.accesorios || {},
            Lh: extra.Lh || 0, Lv: 0,
            nSalidas: 1,
            recibeDe: [], descripcion: '',
            ini: 'AF', fin: calId,
            diamDisPulg: extra.dNominal ? diamPulgFromLabel(String(extra.dNominal)) : 0,
            diametroOriginal: extra.dNominal ? String(extra.dNominal) : '',
            material: extra.material || '',
            totalL: 0,
            _nivelLabel: pisoLbl(isNaN(pisoCal) ? nivel : pisoCal),
            calCapacidad: cal.capacidad || ''
          });
        }
      }
    }
  }
  return incoming;
}

export function TramosProvider({ children }: { children?: ReactNode }) {
const [state, dispatch] = useReducer(tramosReducer, {
  tramosSan: [],
  tramosAf: [],
  tramosAc: [],
  tramosLl: [],
} as TramosState);
const stateRef = useRef(state);
stateRef.current = state;

useEffect(() => {
  const load = () => {
    const sync = readSanDrawingSync();
    const planes = sync.planes || {};
    const hidroData: Record<string, any> = loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
    const sanIncoming: any[] = [];
    const llIncoming: any[] = [];
    const tribIds = new Set<string>();
    for (const [nivel, plane] of Object.entries(planes)) {
      const planId = (plane as any).planoId || nivel;
      for (const r of ((plane as any).ramales || [])) {
        if (r.tipo === 'tributario') tribIds.add(`${r.id}-${planId}`);
      }
      const piso = parseInt(nivel);
      const fmtNivel = (v: unknown): string => {
        const n = Number(v);
        if (!isNaN(n)) return pisoCorto(n);
        return String(v ?? '');
      };
      const venRamales = ((plane as any).ramales || []).filter((r: any) => r._net === 'vent' || r.net === 'vent');
      const venMap = new Map();
      for (const vr of venRamales) {
        if (vr.descargaEnId) {
          const parts = vr.descargaEnId.includes('|') ? vr.descargaEnId.split('|') : [planId, vr.descargaEnId];
          if (parts[0] === planId) venMap.set(parts[1], { diametro: vr.diametro || '', rId: vr.id, rPlanId: planId });
        }
      }

      for (const r of ((plane as any).ramales || [])) {
        if (r._net === 'vent' || r.net === 'vent') continue;
        const apKey = r._aparatosKey || `${r._net || 'san'}_${r.id}_${planId}`;
        const hd = hidroData[apKey] || {};
        const tramo = {
          _key: `${r.id}-${planId}`,
          id: r.id, piso, planId, _nivelLabel: fmtNivel(r.piso || nivel),
          _net: r._net || r.net || '',
          tipo: r.tipo || 'ramal',
          fixtures: sync.aparatosByTramo?.[apKey] || {},
          recibeDe: [], esBajante: false, descripcion: '',
          ini: r.ini || '', fin: r.fin || '',
          diamDisPulg: r.diamPulg || 0, nSalidas: r.nSalidas || hd.nSalidas || 1,
          totalL: r.totalL || 0,
          nmaning: r.maning ?? 0, sPercent: r.pendiente ?? 0,
          bajR: 7/24, bajLong: 5, bajFDarcy: 0.025, bajDprop: 0, ventDprop: 0,
          ventRamalKey: null,
          label: r.label || r.id,
          diametro: r.diametro || '',
          diamPulg: r.diamPulg || 0,
          accesorioInicio: r.accesorioInicio || '',
          accesorioFin: r.accesorioFin || '',
          diametroInicio: r.diametroInicio || '',
          diametroFin: r.diametroFin || '',
          padreTributarioLabel: r.padre ? ((plane as any).ramales?.find((pr: any) => pr.id === r.padre)?.label || r.padre) : null,
        };
        if (r._net === 'll') {
          llIncoming.push({ ...tramo, desde: r.ini || '', hasta: r.fin || '' });
        } else {
          sanIncoming.push(tramo);
        }
      }
      for (const b of ((plane as any).bajantes || [])) {
        const apKey = b._aparatosKey || `${b._net || 'san'}_${b.id}_${planId}`;
        const hd = hidroData[apKey] || {};

        let ventData = venMap.get(b.id);
        if (!ventData) {
          const cVent = venRamales.find((vr: any) => vr.ini === b.id || vr.fin === b.id || (b.recibeDeIds && b.recibeDeIds.includes(vr.id)));
          if (cVent) ventData = { diametro: cVent.diametro || '', rId: cVent.id, rPlanId: planId };
        }

        const ventRamalDiam = ventData && ventData.diametro ? parseFloat(ventData.diametro) : 0;
        const ventRamalKey = ventData ? `${ventData.rId}-${ventData.rPlanId}` : null;
        const tramo = {
          _key: `${b.id}-${planId}`,
          id: b.id, piso, planId, _nivelLabel: fmtNivel(b.piso || nivel),
          _net: b._net || b.net || '',
          tipo: 'bajante',
          fixtures: sync.aparatosByTramo?.[apKey] || {},
          recibeDe: [], esBajante: true, descripcion: '',
          diamDisPulg: b.diamPulg || 0, nSalidas: b.nSalidas || hd.nSalidas || 1,
          nmaning: b.maning ?? 0, sPercent: 0,
          bajR: b.bajR ?? 7/24, bajLong: b.bajLong ?? 5, bajFDarcy: b.bajFDarcy ?? 0.025, bajDprop: b.diamPulg || 0, ventDprop: b.ventDprop ?? 0, ventRamalDiamPulg: ventRamalDiam,
          ventRamalKey,
          recibeDeIds: b.recibeDeIds || [],
          descargaEnId: b.descargaEnId || null,
          area_m2: b.area_m2 || 0,
          pisoBase: b.pisoBase || '', pisoCima: b.pisoCima || '',
          code: b.code || b.id,
        };
        if (b._net === 'll') {
          llIncoming.push({ ...tramo, desde: b.ini || '', hasta: b.fin || '' });
        } else {
          sanIncoming.push(tramo);
        }
      }
    }
    const prevSan = stateRef.current.tramosSan;
    const newSan = sanIncoming.length === 0 ? [] : sanIncoming.map(i => {
      const existing = prevSan.find(t => t._key === i._key);
      return existing ? { ...i, descripcion: existing.descripcion || i.descripcion, nSalidas: i.nSalidas || existing.nSalidas || 1, fixtures: { ...i.fixtures, ...existing.fixtures } } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'san', payload: newSan });

    const prevLl = stateRef.current.tramosLl;
    const newLl = llIncoming.length === 0 ? [] : llIncoming.map(i => {
      const ex = prevLl.find(t => t._key === i._key);
      return ex ? { ...i, descripcion: ex.descripcion || '', desde: ex.desde || '', hasta: ex.hasta || '' } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'll', payload: newLl });
  };
  load();
  const handler = () => load();
  ['civilflow_san_sync_changed', 'storage'].forEach(e => window.addEventListener(e, handler));
  return () => ['civilflow_san_sync_changed', 'storage'].forEach(e => window.removeEventListener(e, handler));
}, []);

useEffect(() => {
  const load = () => {
    const sync = readHydroDrawingSync();
    const planes = sync.planes || {};
    const hidroData: Record<string, any> = (sync.hidroData as Record<string, any>) || {};
    const aparatos: Record<string, any> = (sync.aparatosByTramo as Record<string, any>) || {};

    const afIncoming = buildTramos('af', planes, hidroData, aparatos);
    const acIncoming = buildTramos('ac', planes, hidroData, aparatos);

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
  const handler = () => load();
  ['civilflow_hidro_sync_changed', 'storage'].forEach(e => window.addEventListener(e, handler));
  return () => ['civilflow_hidro_sync_changed', 'storage'].forEach(e => window.removeEventListener(e, handler));
}, []);

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
