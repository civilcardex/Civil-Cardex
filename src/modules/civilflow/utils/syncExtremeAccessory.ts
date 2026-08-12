import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  HYDRO_DATA_STORAGE_KEY,
  TRAZOS_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  GAS_ACC_KEY,
} from '../constants/storage-keys';
import type { SyncPlanInput } from './drawingSync';
import { writeHydroDrawingSync } from './drawingSync';

interface LocalDrawingData {
  ts?: number;
  ramales?: Array<{
    id?: string;
    net?: string;
    accesorioInicio?: string;
    accesorioFin?: string;
    diametro?: string;
    diametroInicio?: string;
    diametroFin?: string;
  }>;
  [key: string]: unknown;
}

interface HidroAccesorios {
  accesorios?: Record<string, number>;
  [key: string]: unknown;
}

function isSyncableAcc(acc: string): boolean {
  return !!acc;
}

function findRamalInPlan(
  plan: SyncPlanInput,
  ramalId: string,
): { planId: string | number; diam: string; net: string; data: LocalDrawingData } | null {
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

function bumpGasAccesorio(ramalId: string, acc: string, delta: number): void {
  const rawGas =
    loadFromStorage<Record<string, Record<string, number>> | null>(GAS_ACC_KEY, null) || {};
  const entry = rawGas[ramalId] || {};
  const accesorios = { ...entry };
  const cur = accesorios[acc] || 0;
  const next = cur + delta;
  if (next <= 0) {
    delete accesorios[acc];
  } else {
    accesorios[acc] = next;
  }
  if (Object.keys(accesorios).length === 0) {
    if (ramalId in rawGas) {
      const copy = { ...rawGas };
      delete copy[ramalId];
      saveToStorage(GAS_ACC_KEY, copy);
    }
  } else {
    rawGas[ramalId] = accesorios;
    saveToStorage(GAS_ACC_KEY, rawGas);
  }
}

export function bumpHidroAccesorio(
  netId: string,
  acc: string,
  delta: number,
  ramalId: string,
  planId: string | number,
): void {
  const hidroKey = `${netId}_${ramalId}_${planId}`;
  const rawHidro =
    loadFromStorage<Record<string, HidroAccesorios> | null>(HYDRO_DATA_STORAGE_KEY, null) || {};
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

/** Incrementa el conteo de aparato (p. ej. 'sif') en APARATOS_BY_TRAMO_KEY */
function bumpAparatoCount(
  netId: string,
  ramalId: string,
  planId: string | number,
  aparatoId: string,
  delta: number,
): void {
  const storeKey = `${netId}_${ramalId}_${planId}`;
  const all =
    loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {}) || {};
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

export function syncExtremeAparatoToCounts(
  ramalId: string,
  oldApp: string,
  newApp: string,
  plans: SyncPlanInput[],
): void {
  if ((oldApp || '') === (newApp || '')) return;
  let touched = false;
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const found = findRamalInPlan(plan, ramalId);
    if (!found) continue;
    if (oldApp) bumpAparatoCount(found.net, ramalId, found.planId, oldApp, -1);
    if (newApp) bumpAparatoCount(found.net, ramalId, found.planId, newApp, +1);
    touched = true;
  }
  if (touched) {
    try {
      window.dispatchEvent(new CustomEvent('aparatos-clear'));
    } catch {
      /* ignore */
    }
  }
}

export function moveAparatoCount(
  netId: string,
  fromId: string,
  toId: string,
  planId: string | number,
  appId: string,
): void {
  bumpAparatoCount(netId, fromId, planId, appId, -1);
  bumpAparatoCount(netId, toId, planId, appId, +1);
  try {
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
  } catch {
    /* ignore */
  }
}

/** Mueve el registro COMPLETO de aparatos (todas las UC) de un ramal a otro en un solo
 *  load/save, sumando sobre lo que el destino ya tuviera. Usado al invertir la dirección de
 *  flujo de un ramal conectado: el usuario elige a qué ramal de la conexión se le cargan las
 *  unidades de consumo del ramal invertido. */
export function moveAllAparatoCounts(
  netId: string,
  fromId: string,
  toId: string,
  planId: string | number,
): void {
  const fromKey = `${netId}_${fromId}_${planId}`;
  const toKey = `${netId}_${toId}_${planId}`;
  const all =
    loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {}) || {};
  const src = all[fromKey];
  if (!src || Object.keys(src).length === 0) return;
  const dst = { ...(all[toKey] || {}) };
  for (const [appId, n] of Object.entries(src)) {
    dst[appId] = (dst[appId] || 0) + n;
  }
  const copy = { ...all };
  delete copy[fromKey];
  copy[toKey] = dst;
  saveToStorage(APARATOS_BY_TRAMO_KEY, copy);
  try {
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
  } catch {
    /* ignore */
  }
}

export function syncExtremeAccessoryToHidroData(
  ramalId: string,
  _field: 'accesorioInicio' | 'accesorioFin',
  oldVal: string,
  newVal: string,
  plans: SyncPlanInput[],
): void {
  if (oldVal === newVal) return;

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const found = findRamalInPlan(plan, ramalId);
    if (!found) continue;

    const isGas = found.net === 'gas';

    if (isSyncableAcc(oldVal)) {
      if (isGas) {
        bumpGasAccesorio(ramalId, oldVal, -1);
      } else {
        bumpHidroAccesorio(found.net, oldVal, -1, ramalId, found.planId);
      }
    }
    if (isSyncableAcc(newVal)) {
      if (isGas) {
        bumpGasAccesorio(ramalId, newVal, +1);
      } else {
        bumpHidroAccesorio(found.net, newVal, +1, ramalId, found.planId);
      }
    }

    // Auto-incrementar aparato 'sif' cuando se añade/quita el accesorio sifón
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
