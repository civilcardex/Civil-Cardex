import { matManning } from '../constants';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  HYDRO_SYNC_KEY,
  SAN_SYNC_KEY,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
} from '../constants/storage-keys';
import { diamPulgFromLabel } from './diamPulgFromLabel';

type DrawingData = Record<string, any>;

function collectAparatos(out: DrawingData) {
  const rawAparatos = loadFromStorage(APARATOS_BY_TRAMO_KEY, {});
  out.aparatosByTramo = {};
  for (const [key, counts] of Object.entries(rawAparatos)) {
    if (!counts || typeof counts !== 'object') continue;
    const filtered: Record<string, number> = {};
    for (const [apId, n] of Object.entries(counts)) {
      const v = Number(n) || 0;
      if (v > 0) filtered[apId] = v;
    }
    if (Object.keys(filtered).length > 0) out.aparatosByTramo[key] = filtered;
  }
}

function inferNivelFromDrawing(data: DrawingData): number {
  if (!data) return 0;
  for (const r of (data.ramales || [])) {
    if (r.piso != null) {
      const n = parseInt(r.piso);
      if (!isNaN(n)) return n;
    }
  }
  for (const b of (data.bajantes || [])) {
    if (b.pisoBase != null) {
      const n = parseInt(b.pisoBase);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

function buildPrefixedSyncData(plans: DrawingData[], families: Set<string>) {
  const out: DrawingData = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  for (const plan of plans) {
    if (!plan) continue;
    const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw as DrawingData;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { continue; }
    }
    const nivel = plan.nivel ?? inferNivelFromDrawing(data);

    for (const family of families) {
      const ramales: any[] = [];
      for (const r of (data.ramales || [])) {
        if (r.net === family) {
          const rKey = family + '_' + r.id + '_' + plan.id;
          ramales.push({
            id: r.id, label: r.label || r.id, tipo: r.tipo,
            padre: r.padre || null, totalL: r.totalL || 0,
            ini: r.ini || '', fin: r.fin || '',
            diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
            pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
            material: r.material || '', maning: matManning(r.material),
            dz: parseFloat(r.dz ?? r.lvert) || 0,
            piso: r.piso || nivel,
            _aparatosKey: rKey,
            _net: r.net || family,
            pts: r.pts || [],
            lvert: parseFloat(r.lvert ?? r.dz) || 0,
            nSalidas: r.nSalidas || 0,
            descargaEnId: r.descargaEnId || null,
          });
        }
      }
      const planoKey = family + '_' + nivel;
      if (ramales.length === 0) continue;
      out.planes[planoKey] = { planoId: plan.id, planoName: plan.name, nivel, npt: plan.npt ?? parseInt(nivel), ramales, bajantes: [] };
    }
  }

  collectAparatos(out);

  const rawHidro = loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
  out.hidroData = {};
  for (const [key, val] of Object.entries(rawHidro)) {
    out.hidroData[key] = val;
  }

  return out;
}

function buildNonPrefixedSyncData(plans: DrawingData[], families: Set<string>) {
  const out: DrawingData = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  for (const plan of plans) {
    if (!plan) continue;
    const raw = loadFromStorage(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw as DrawingData;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { continue; }
    }
    const nivel = plan.nivel ?? inferNivelFromDrawing(data);

    const ramales: any[] = [];
    const bajantes: any[] = [];
    for (const r of (data.ramales || [])) {
      if (families.has(r.net)) {
        const rKey = r.net + '_' + r.id + '_' + plan.id;
        ramales.push({
          id: r.id, label: r.label || r.id, tipo: r.tipo,
          padre: r.padre || null, totalL: r.totalL || 0,
          ini: r.ini || '', fin: r.fin || '',
          diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
          pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
          material: r.material || '', maning: matManning(r.material),
          piso: r.piso || nivel,
          _aparatosKey: rKey, _net: r.net,
          nSalidas: r.nSalidas || 0,
          descargaEnId: r.descargaEnId || null,
        });
      }
    }
    for (const b of (data.bajantes || [])) {
      if (families.has(b.net)) {
        const bKey = b.net + '_' + b.id + '_' + plan.id;
        bajantes.push({
          id: b.id, code: b.code || b.id, tipo: b.tipo || 'bajante',
          dNominal: b.dNominal || '', diamPulg: diamPulgFromLabel(b.dNominal),
          hVert: b.hVert || 0, material: b.material || '',
          maning: matManning(b.material), _aparatosKey: bKey, _net: b.net,
          recibeDeIds: b.recibeDeIds || [],
          descargaEnId: b.descargaEnId || null,
          area_m2: b.area_m2 || 0,
          pisoBase: b.pisoBase || '', pisoCima: b.pisoCima || '',
          nSalidas: b.nSalidas || 0,
          bajR: b.bajR ?? 7/24,
          bajDprop: b.bajDprop,
          ventDprop: b.ventDprop,
          bajLong: b.bajLong,
          bajFDarcy: b.bajFDarcy,
        });
      }
    }
    if (ramales.length === 0 && bajantes.length === 0) continue;
    out.planes[nivel] = { planoId: plan.id, planoName: plan.name, nivel: plan.nivel, npt: plan.npt, ramales, bajantes };
  }

  collectAparatos(out);

  return out;
}

function buildSyncData(plans: DrawingData[], families: Set<string>, prefix: string, _storageKey: string) {
  return prefix
    ? buildPrefixedSyncData(plans, families)
    : buildNonPrefixedSyncData(plans, families);
}

export function writeHydroDrawingSync(plans: DrawingData[]) {
  try {
    const data = buildSyncData(plans, HYDRO_FAMILIES, 'h', HYDRO_SYNC_KEY);
    saveToStorage(HYDRO_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    if (import.meta.env.DEV) console.error('writeHydroDrawingSync error:', e);
    return null;
  }
}

export function readHydroDrawingSync() {
  return loadFromStorage(HYDRO_SYNC_KEY, { planes: {}, aparatosByTramo: {}, hidroData: {}, updatedAt: 0 }) as {
    planes: Record<string, any>;
    aparatosByTramo: Record<string, any>;
    hidroData: Record<string, any>;
    updatedAt: number;
  };
}

export function writeSanDrawingSync(plans: DrawingData[]) {
  try {
    const data = buildSyncData(plans, SAN_FAMILIES, '', SAN_SYNC_KEY);
    saveToStorage(SAN_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    if (import.meta.env.DEV) console.error('writeSanDrawingSync error:', e);
    return null;
  }
}

export function readSanDrawingSync() {
  return loadFromStorage(SAN_SYNC_KEY, { planes: {}, aparatosByTramo: {}, updatedAt: 0 }) as {
    planes: Record<string, any>;
    aparatosByTramo: Record<string, any>;
    updatedAt: number;
  };
}

export { HYDRO_SYNC_KEY, SAN_SYNC_KEY, APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys';

export { HYDRO_DATA_STORAGE_KEY } from '../constants/storage-keys';
