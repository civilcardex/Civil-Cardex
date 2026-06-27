import { useEffect, type MutableRefObject } from "react";
import { readSanDrawingSync, readHydroDrawingSync } from "../utils/drawingSync";
import { diamPulgFromLabel } from "../utils/diamPulgFromLabel";
import { HYDRO_DATA_STORAGE_KEY, TRAZOS_PREFIX } from "../constants/storage-keys";
import { loadFromStorage, saveToStorage } from "../services/storageService";
import type { TramosState } from "../context/TramosContext";
import { pisoLbl, pisoCorto } from "../constants";

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
) {
  useSyncEvents(['civilflow_san_sync_changed', 'storage'], () => {
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
      const piso = (plane as any).npt ?? parseInt(nivel);
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
          diamDisPulg: r.diamPulg || 0, nSalidas: r.nSalidas || hd.nSalidas || 0,
          totalL: r.totalL || 0,
          nmaning: r.maning ?? 0, sPercent: r.pendiente ?? 0,
          bajR: 7/24, bajLong: 5, bajFDarcy: 0.025, bajDprop: 0, ventDprop: 0,
          ventRamalKey: null,
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
          diamDisPulg: b.diamPulg || 0, nSalidas: b.nSalidas || hd.nSalidas || 0,
          nmaning: b.maning ?? 0, sPercent: 0,
          bajR: b.bajR ?? 7/24, bajLong: b.bajLong ?? 5, bajFDarcy: b.bajFDarcy ?? 0.025, bajDprop: b.diamPulg || 0, ventDprop: b.ventDprop || 0, ventRamalDiamPulg: ventRamalDiam,
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
      return existing ? { ...i, descripcion: existing.descripcion || i.descripcion, nSalidas: i.nSalidas || existing.nSalidas || 0, fixtures: { ...i.fixtures, ...existing.fixtures } } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'san', payload: newSan });

    const prevLl = stateRef.current.tramosLl;
    const newLl = llIncoming.length === 0 ? [] : llIncoming.map(i => {
      const ex = prevLl.find(t => t._key === i._key);
      return ex ? { ...i, descripcion: ex.descripcion || '', desde: ex.desde || '', hasta: ex.hasta || '' } : i;
    });
    dispatch({ type: 'SET_TRAMOS', net: 'll', payload: newLl });
  });
}

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
    const raw = loadFromStorage(TRAZOS_PREFIX + planId, null);
    let drawingBajantes: any[] = [];
    let drawingData: any = null;
    if (raw) {
      drawingData = raw;
      if (typeof drawingData === 'string') {
        try { drawingData = JSON.parse(drawingData); } catch (_) {}
      }
      drawingBajantes = drawingData?.bajantes || [];
    }

    for (const r of ((plane as any).ramales || [])) {
      let rId = r.id;
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

            // Persist automatically to drawings storage
            if (drawingData) {
              for (const drawingRamal of (drawingData.ramales || [])) {
                if (drawingRamal.id === r.id) {
                  drawingRamal.ini = newIni;
                  drawingRamal.fin = newFin;
                  break;
                }
              }
              saveToStorage(TRAZOS_PREFIX + planId, drawingData);
            }
          }
          ini = newIni;
          fin = newFin;
        }
      }

      const isAC1 = (() => {
        if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
        if (fin.startsWith('CNT') && !ini.startsWith('CNT') && !ini.startsWith('M') && !ini.startsWith('B')) return true;
        return false;
      })();
      const isAC2 = (() => {
        if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
        if (ini.startsWith('CNT')) return true;
        if (fin.startsWith('CNT') && (ini.startsWith('M') || ini.startsWith('B'))) return true;
        return false;
      })();

      let apKey = r._aparatosKey || `${family}_${r.id}_${planId}`;
      if (family === 'af' && isAC1) {
        const cntId = fin.startsWith('CNT') ? fin : (ini.startsWith('CNT') ? ini : null);
        if (cntId) {
          apKey = `${family}_${cntId}_${planId}`;
        }
      }
      const extra = hidroData[apKey] || {};
      // Read nSalidas and dz directly from drawing data as authoritative source
      let dznSalidas = r.nSalidas || 0;
      let dzLvert = r.lvert ?? r.dz ?? 0;
      if (drawingData) {
        const dr = (drawingData.ramales || []).find((x: any) => x.id === r.id);
        if (dr) {
          if (!dznSalidas) dznSalidas = dr.nSalidas || 0;
          if (dzLvert === 0 || dzLvert === undefined) dzLvert = parseFloat(dr.lvert ?? dr.dz) || 0;
        }
      }
      incoming.push({
        _key: `${rId}-${planId}`,
        id: rId, piso: nivel, planId,
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
            nSalidas: 0,
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
    }
  }
  return incoming;
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
  });
}