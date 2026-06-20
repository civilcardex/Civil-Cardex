import { useEffect, type MutableRefObject } from "react";
import { readSanDrawingSync, readHydroDrawingSync } from "../utils/drawingSync";
import { HYDRO_DATA_STORAGE_KEY } from "../constants/storage-keys";
import { loadFromStorage } from "../services/storageService";
import type { TramosState } from "../context/tramosReducer";

function useSyncEvents(events: string[], load: () => void) {
  useEffect(() => {
    load();
    const handler = () => load();
    events.forEach(e => window.addEventListener(e, handler));
    return () => events.forEach(e => window.removeEventListener(e, handler));
  }, []);
}

export function useSanLlSync(
  dispatch: (a: any) => void,
  stateRef: MutableRefObject<TramosState>,
  _nextLlKey: () => string,
) {
  useSyncEvents(['civilflow_san_sync_changed', 'storage'], () => {
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
      const planId = (plane as any).planoId || nivel;
      for (const r of ((plane as any).ramales || [])) {
        const apKey = r._aparatosKey || r.id;
        const hd = hidroData[apKey] || {};
        const tramo = {
          _key: `${r.id}-${planId}`,
          id: r.id, piso, planId,
          tipo: r.tipo || 'ramal',
          fixtures: sync.aparatosByTramo?.[apKey] || {},
          recibeDe: [], esBajante: false, descripcion: '',
          ini: r.ini || '', fin: r.fin || '',
          diamDisPulg: r.diamPulg || 0, nSalidas: hd.nSalidas || 0,
          totalL: r.totalL || 0,
          nmaning: r.maning ?? 0, sPercent: r.pendiente ?? 0,
          bajR: 7/24, bajLong: 3, bajFDarcy: 0.025, bajDprop: 0, ventDprop: 0,
        };
        if (r._net === 'll') {
          llIncoming.push({ _key: tramo._key, ...tramo, desde: '', hasta: '' });
        } else {
          sanIncoming.push(tramo);
        }
      }
      for (const b of ((plane as any).bajantes || [])) {
        const apKey = b._aparatosKey || b.id;
        const hd = hidroData[apKey] || {};
        const tramo = {
          _key: `${b.id}-${planId}`,
          id: b.id, piso, planId,
          tipo: 'bajante',
          fixtures: sync.aparatosByTramo?.[apKey] || {},
          recibeDe: [], esBajante: true, descripcion: '',
          diamDisPulg: b.diamPulg || 0, nSalidas: hd.nSalidas || 0,
          nmaning: b.maning ?? 0, sPercent: 0,
          bajR: b.bajR ?? 7/24, bajLong: b.bajLong ?? 3, bajFDarcy: b.bajFDarcy ?? 0.025, bajDprop: b.bajDprop ?? 0, ventDprop: b.ventDprop ?? 0,
          recibeDeIds: b.recibeDeIds || [],
          descargaEnId: b.descargaEnId || null,
          area_m2: b.area_m2 || 0,
          pisoBase: b.pisoBase || '', pisoCima: b.pisoCima || '',
          code: b.code || b.id,
        };
        if (b._net === 'll') {
          llIncoming.push({ _key: tramo._key, ...tramo, desde: '', hasta: '' });
        } else {
          sanIncoming.push(tramo);
        }
      }
    }
    const prevSan = stateRef.current.tramosSan;
    const newSan = sanIncoming.length === 0 ? [] : sanIncoming.map(i => {
      const existing = prevSan.find(t => t._key === i._key);
      return existing ? { ...i, descripcion: existing.descripcion || i.descripcion, nSalidas: existing.nSalidas ?? i.nSalidas, fixtures: { ...i.fixtures, ...existing.fixtures } } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'san', payload: newSan });

    const prevLl = stateRef.current.tramosLl;
    if (llIncoming.length === 0) { dispatch({ type: 'SET_TRAMOS', net: 'll', payload: [] }); return; }
    const drawingIds = new Set([...llIncoming.map(i => i.id), ...tribIds]);
    const keep = prevLl.filter(t => !drawingIds.has(t.id));
    const merged = llIncoming.map(i => {
      const ex = prevLl.find(t => t.id === i.id);
      return ex ? { ...i, descripcion: ex.descripcion || '', desde: ex.desde || '', hasta: ex.hasta || '' } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'll', payload: [...keep, ...merged] });
  });
}

export function useHidroSync(
  dispatch: (a: any) => void,
  stateRef: MutableRefObject<TramosState>,
) {
  useSyncEvents(['civilflow_hidro_sync_changed', 'storage'], () => {
    const sync = readHydroDrawingSync();
    const planes = sync.planes || {};
    const hidroData: Record<string, any> = (sync.hidroData as Record<string, any>) || {};
    const aparatos: Record<string, any> = (sync.aparatosByTramo as Record<string, any>) || {};

    function buildTramos(family: string) {
      const incoming: any[] = [];
      for (const [key, plane] of Object.entries(planes)) {
        if (!key.startsWith(family + '_')) continue;
        const nivel = parseInt(key.slice(family.length + 1));
        const planId = (plane as any).planoId || '';
        for (const r of ((plane as any).ramales || [])) {
          const apKey = r._aparatosKey || `${family}_${r.id}`;
          const extra = hidroData[apKey] || {};
          incoming.push({
            _key: `${r.id}-${planId}`,
            id: r.id, piso: nivel, planId,
            tipo: r.tipo || 'ramal',
            esBajante: false,
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
  });
}