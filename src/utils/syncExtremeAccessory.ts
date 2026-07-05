import { loadFromStorage, saveToStorage } from '../services/storageService';
import { HYDRO_DATA_STORAGE_KEY, TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys';
import type { SyncPlanInput } from './drawingSync';
import { writeHydroDrawingSync } from './drawingSync';

interface LocalDrawingData {
  ts?: number;
  ramales?: Array<{ id?: string; net?: string; accesorioInicio?: string; accesorioFin?: string; diametro?: string; diametroInicio?: string; diametroFin?: string }>;
  [key: string]: unknown;
}

interface HidroAccesorios {
  accesorios?: Record<string, number>;
  [key: string]: unknown;
}

const SYNCABLE_ACC: Record<string, string> = {
  valvCompuerta: 'valvCompuerta',
  valvGlobo: 'valvGlobo',
  valvCheque: 'valvCheque',
  valvAngulo: 'valvAngulo',
  sifon: 'sifon',
};

function isSyncableAcc(acc: string): boolean {
  return Object.prototype.hasOwnProperty.call(SYNCABLE_ACC, acc);
}

function findRamalInPlan(plan: SyncPlanInput, ramalId: string): { planId: string | number; diam: string; net: string; data: LocalDrawingData } | null {
  if (!plan || plan.status !== 'confirmed') return null;
  const key = TRAZOS_PREFIX + plan.id;
  const raw = loadFromStorage<LocalDrawingData | null>(key, null);
  if (!raw) return null;
  const data = raw;
  const ramal = (data.ramales || []).find((r) => r.id === ramalId);
  if (!ramal) return null;
  const diam = ramal.diametroFin || ramal.diametroInicio || ramal.diametro || '';
  const net = ramal.net || 'san';
  return { planId: plan.id, diam, net, data };
}

function bumpHidroAccesorio(_ramalKey: string, acc: string, delta: number, ramalId: string, planId: string | number): void {
  const hidroKey = `${ramalId}_${planId}`;
  const rawHidro = loadFromStorage<Record<string, HidroAccesorios> | null>(HYDRO_DATA_STORAGE_KEY, null) || {};
  const entry = rawHidro[hidroKey] || {};
  const accesorios = { ...(entry.accesorios || {}) };
  const cur = accesorios[acc] || 0;
  const next = cur + delta;
  if (next <= 0) {
    delete accesorios[acc];
  } else {
    accesorios[acc] = next;
  }
  if (Object.keys(accesorios).length === 0) {
    if (hidroKey in rawHidro) {
      const copy = { ...rawHidro };
      delete copy[hidroKey];
      saveToStorage(HYDRO_DATA_STORAGE_KEY, copy);
    }
  } else {
    rawHidro[hidroKey] = { ...entry, accesorios };
    saveToStorage(HYDRO_DATA_STORAGE_KEY, rawHidro);
  }
}

/** Bump aparato count (e.g. 'sif') in APARATOS_BY_TRAMO_KEY */
function bumpAparatoCount(netId: string, ramalId: string, planId: string | number, aparatoId: string, delta: number): void {
  const storeKey = `${netId}_${ramalId}_${planId}`;
  const all = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {}) || {};
  const cur = { ...(all[storeKey] || {}) };
  const val = (cur[aparatoId] || 0) + delta;
  if (val <= 0) {
    delete cur[aparatoId];
  } else {
    cur[aparatoId] = val;
  }
  if (Object.keys(cur).length === 0) {
    delete all[storeKey];
  } else {
    all[storeKey] = cur;
  }
  saveToStorage(APARATOS_BY_TRAMO_KEY, all);
}

export function syncExtremeAccessoryToHidroData(
  ramalId: string,
  _field: 'accesorioInicio' | 'accesorioFin',
  oldVal: string,
  newVal: string,
  plans: SyncPlanInput[]
): void {
  if (oldVal === newVal) return;
  if (!isSyncableAcc(oldVal) && !isSyncableAcc(newVal)) return;

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const found = findRamalInPlan(plan, ramalId);
    if (!found) continue;

    if (isSyncableAcc(oldVal)) {
      bumpHidroAccesorio(`${ramalId}_${found.planId}`, oldVal, -1, ramalId, found.planId);
    }
    if (isSyncableAcc(newVal)) {
      bumpHidroAccesorio(`${ramalId}_${found.planId}`, newVal, +1, ramalId, found.planId);
    }

    // Auto-bump 'sif' aparato when siphon accessory is added/removed
    if (oldVal === 'sifon') {
      bumpAparatoCount(found.net, ramalId, found.planId, 'sif', -1);
    }
    if (newVal === 'sifon') {
      bumpAparatoCount(found.net, ramalId, found.planId, 'sif', +1);
    }

    found.data.ts = Date.now();
    saveToStorage(TRAZOS_PREFIX + found.planId, found.data);
    writeHydroDrawingSync(plans);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
  }
}
