import { matManning } from '../constants';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { devError } from '../../../utils/devError';
import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  HYDRO_SYNC_KEY,
  SAN_SYNC_KEY,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
} from '../constants/storage-keys';
import { diamPulgFromLabel } from './diamPulgFromLabel';

export interface RawElement {
  id: string;
  net: string;
  tipo: string;
  padre?: string | null;
  totalL?: number;
  ini?: string;
  fin?: string;
  diametro?: string;
  pendiente?: number;
  material?: string;
  dz?: string;
  lvert?: string;
  piso?: string;
  pts?: number[][];
  nSalidas?: number;
  descargaEnId?: string | null;
  code?: string;
  dNominal?: string;
  hVert?: number;
  recibeDeIds?: string[];
  mergesFrom?: [string, string];
  alimentaIds?: string[];
  area_m2?: number;
  pisoBase?: string;
  pisoCima?: string;
  nptBase?: number;
  nptCima?: number;
  bajR?: number;
  bajDprop?: unknown;
  ventDprop?: unknown;
  bajLong?: unknown;
  bajFDarcy?: unknown;
  label?: string;
  acoDiam?: string;
  accesorioInicio?: string;
  accesorioFin?: string;
  aparatoInicio?: string;
  aparatoFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  accMed?: Record<string, string>;
  caudal?: number;
  bilateralCrossings?: number[][];
  [key: string]: unknown;
}

export interface DrawingData {
  planes?: Record<string, unknown>;
  aparatosByTramo?: Record<string, unknown>;
  hidroData?: Record<string, unknown>;
  updatedAt?: number;
  id?: string | number;
  nivel?: string | number | null;
  name?: string;
  npt?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

export interface SyncPlanInput {
  id: string | number;
  name?: string;
  nivel?: string | number | null;
  npt?: number;
  status?: string;
}

interface TraceData {
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

interface HidroDataEntry { accesorios: Record<string, number>; Lh: number; nSalidas: number }

interface RamalSyncObj {
  id: string; label: string; tipo: string; padre: string | null; totalL: number;
  ini: string; fin: string; diametro: string; diamPulg: number;
  pendiente: number; material: string; maning: number | null;
  piso: string; _aparatosKey: string; _net: string;
  nSalidas: number; descargaEnId: string | null;
  aparatoInicio: string; aparatoFin: string;
  caudal?: number; accMed?: Record<string, string>;
}

interface SyncDataResult {
  planes: Record<string, unknown>;
  aparatosByTramo?: Record<string, unknown>;
  hidroData?: Record<string, unknown>;
  updatedAt: number;
}

function collectAparatos(out: SyncDataResult) {
  const rawAparatos = loadFromStorage<Record<string, unknown>>(APARATOS_BY_TRAMO_KEY, {});
  out.aparatosByTramo = {};
  for (const [key, counts] of Object.entries(rawAparatos)) {
    if (!counts || typeof counts !== 'object') continue;
    out.aparatosByTramo[key] = counts;
  }
}

function inferNivelFromDrawing(data: TraceData): string {
  const all = [...(data.ramales || []), ...(data.bajantes || [])];
  for (const el of all) {
    if (el.piso) return el.piso;
  }
  return '0';
}

function buildPrefixedSyncData(plans: SyncPlanInput[], families: Set<string>): SyncDataResult {
  const out: SyncDataResult = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  const rawHidro = loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {}) || {};
  let rawHidroChanged = false;

  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw;
    if (typeof data === 'string') {
      try { data = JSON.parse(data) as TraceData; } catch { continue; }
    }
    const nivel = String(plan.nivel ?? inferNivelFromDrawing(data));

    for (const family of families) {
      const ramales: unknown[] = [];
      for (const r of (data.ramales || [])) {
        if (r.net === family) {
          const rKey = family + '_' + r.id + '_' + plan.id;

          // Auto-sync teeBilateral count to rawHidro
          const numBilateral = (r.bilateralCrossings || []).length;
          const entry = rawHidro[rKey] || { accesorios: {}, Lh: 0, nSalidas: 0 };
          const accs = { ...(entry.accesorios || {}) };

          if (numBilateral > 0) {
            if (accs.teeBilateral !== numBilateral) {
              accs.teeBilateral = numBilateral;
              rawHidro[rKey] = { ...entry, accesorios: accs };
              rawHidroChanged = true;
            }
          } else {
            if (accs.teeBilateral !== undefined) {
              delete accs.teeBilateral;
              if (Object.keys(accs).length === 0) {
                delete rawHidro[rKey];
              } else {
                rawHidro[rKey] = { ...entry, accesorios: accs };
              }
              rawHidroChanged = true;
            }
          }

          ramales.push({
            id: r.id, label: r.label || r.id, tipo: r.tipo,
            padre: r.padre || null, totalL: r.totalL || 0,
            ini: r.ini || '', fin: r.fin || '',
            diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
            pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
            material: r.material || '', maning: matManning(r.material || ''),
            dz: parseFloat(r.dz ?? r.lvert ?? '0') || 0,
            piso: r.piso || nivel,
            _aparatosKey: rKey,
            _net: r.net || family,
            pts: r.pts || [],
            lvert: parseFloat(r.lvert ?? r.dz ?? '0') || 0,
            nSalidas: r.nSalidas || 0,
            descargaEnId: r.descargaEnId || null,
            accesorioInicio: r.accesorioInicio || '',
            accesorioFin: r.accesorioFin || '',
            diametroInicio: r.diametroInicio || '',
            diametroFin: r.diametroFin || '',
            aparatoInicio: r.aparatoInicio || '',
            aparatoFin: r.aparatoFin || '',
          });
        }
      }
      const planoKey = family + '_' + nivel;
      if (ramales.length === 0) continue;
      out.planes[planoKey] = {
        planoId: plan.id,
        planoName: plan.name || '',
        nivel,
        npt: plan.npt ?? parseInt(nivel),
        ramales,
        bajantes: []
      };
    }
  }

  collectAparatos(out);

  if (rawHidroChanged) {
    saveToStorage(HYDRO_DATA_STORAGE_KEY, rawHidro);
  }

  out.hidroData = {};
  for (const [key, val] of Object.entries(rawHidro)) {
    out.hidroData[key] = val;
  }

  return out;
}

function buildNonPrefixedSyncData(plans: SyncPlanInput[], families: Set<string>): SyncDataResult {
  const out: SyncDataResult = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw;
    if (typeof data === 'string') {
      try { data = JSON.parse(data) as TraceData; } catch { continue; }
    }
    const nivel = String(plan.nivel ?? inferNivelFromDrawing(data));

    const ramales: unknown[] = [];
    const bajantes: unknown[] = [];
    for (const r of (data.ramales || [])) {
      if (families.has(r.net)) {
        const rKey = r.net + '_' + r.id + '_' + plan.id;
        const ramalObj: RamalSyncObj = {
          id: r.id, label: r.label || r.id, tipo: r.tipo,
          padre: r.padre || null, totalL: r.totalL || 0,
          ini: r.ini || '', fin: r.fin || '',
          diametro: r.diametro || '', diamPulg: diamPulgFromLabel(r.diametro),
          pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
          material: r.material || '', maning: matManning(r.material || ''),
          piso: r.piso || nivel,
          _aparatosKey: rKey, _net: r.net,
          nSalidas: r.nSalidas || 0,
          descargaEnId: r.descargaEnId || null,
          aparatoInicio: r.aparatoInicio || '',
          aparatoFin: r.aparatoFin || '',
        };
        if (r.caudal !== undefined) ramalObj.caudal = r.caudal;
        if (r.accMed) ramalObj.accMed = r.accMed;
        ramales.push(ramalObj);
      }
    }
    for (const b of (data.bajantes || [])) {
      if (families.has(b.net)) {
        const bKey = b.net + '_' + b.id + '_' + plan.id;
        bajantes.push({
          id: b.id, code: b.code || b.id, tipo: b.tipo || 'bajante',
          dNominal: b.dNominal || '', diamPulg: diamPulgFromLabel(b.dNominal),
          hVert: b.hVert || 0, material: b.material || '',
          maning: matManning(b.material || ''), _aparatosKey: bKey, _net: b.net,
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
          aparato: b.aparato || '',
        });
      }
    }
    if (ramales.length === 0 && bajantes.length === 0) continue;
    out.planes[nivel] = { planoId: plan.id, planoName: plan.name || '', nivel: String(plan.nivel || ''), npt: plan.npt || 0, ramales, bajantes };
  }

  collectAparatos(out);

  return out;
}

function performGarbageCollection(plans: SyncPlanInput[]) {
  if (!Array.isArray(plans)) return;
  const validKeys = new Set<string>();
  const validGasRamales = new Set<string>();

  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;

    let data = raw;
    if (typeof data === 'string') {
      try { data = JSON.parse(data) as TraceData; } catch { continue; }
    }

    for (const r of (data.ramales || [])) {
      if (r && r.id && r.net) {
        const key = `${r.net}_${r.id}_${plan.id}`;
        validKeys.add(key);
        if (r.net === 'gas') {
          validGasRamales.add(r.id);
        }
      }
    }

    for (const b of (data.bajantes || [])) {
      if (b && b.id && b.net) {
        validKeys.add(`${b.net}_${b.id}_${plan.id}`);
        if (b.tipo === 'contador') {
          validKeys.add(`af_${b.id}_${plan.id}`);
        } else if (b.tipo === 'calentador') {
          validKeys.add(`ac_${b.id}_${plan.id}`);
        }
      }
    }
  }

  // 1. Clean APARATOS_BY_TRAMO_KEY
  const rawAparatos = loadFromStorage<Record<string, unknown>>(APARATOS_BY_TRAMO_KEY, {});
  let aparatosChanged = false;
  for (const key of Object.keys(rawAparatos)) {
    if (!validKeys.has(key)) {
      delete rawAparatos[key];
      aparatosChanged = true;
    }
  }
  if (aparatosChanged) {
    saveToStorage(APARATOS_BY_TRAMO_KEY, rawAparatos);
  }

  // 2. Clean HYDRO_DATA_STORAGE_KEY
  const rawHidro = loadFromStorage<Record<string, unknown>>(HYDRO_DATA_STORAGE_KEY, {});
  let hidroChanged = false;
  for (const key of Object.keys(rawHidro)) {
    if (!validKeys.has(key)) {
      delete rawHidro[key];
      hidroChanged = true;
    }
  }
  if (hidroChanged) {
    saveToStorage(HYDRO_DATA_STORAGE_KEY, rawHidro);
  }

  // 3. Clean GAS_ACC_KEY
  const rawGas = loadFromStorage<Record<string, unknown>>(GAS_ACC_KEY, {});
  let gasChanged = false;
  for (const ramalId of Object.keys(rawGas)) {
    if (!validGasRamales.has(ramalId)) {
      delete rawGas[ramalId];
      gasChanged = true;
    }
  }
  if (gasChanged) {
    saveToStorage(GAS_ACC_KEY, rawGas);
  }
}

function buildSyncData(plans: SyncPlanInput[], families: Set<string>, prefix: string, _storageKey: string): SyncDataResult {
  try {
    performGarbageCollection(plans);
  } catch (e) {
    devError('Garbage collection error:', e);
  }

  return prefix
    ? buildPrefixedSyncData(plans, families)
    : buildNonPrefixedSyncData(plans, families);
}

export function writeHydroDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, HYDRO_FAMILIES, 'h', HYDRO_SYNC_KEY);
    saveToStorage(HYDRO_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    devError('writeHydroDrawingSync error:', e);
    return null;
  }
}

export function readHydroDrawingSync() {
  return loadFromStorage(HYDRO_SYNC_KEY, { planes: {}, aparatosByTramo: {}, hidroData: {}, updatedAt: 0 }) as {
    planes: Record<string, unknown>;
    aparatosByTramo: Record<string, unknown>;
    hidroData: Record<string, unknown>;
    updatedAt: number;
  };
}

export function writeSanDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, SAN_FAMILIES, '', SAN_SYNC_KEY);
    saveToStorage(SAN_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    devError('writeSanDrawingSync error:', e);
    return null;
  }
}

export function readSanDrawingSync() {
  return loadFromStorage(SAN_SYNC_KEY, { planes: {}, aparatosByTramo: {}, updatedAt: 0 }) as {
    planes: Record<string, unknown>;
    aparatosByTramo: Record<string, unknown>;
    updatedAt: number;
  };
}

