import { writeHydroDrawingSync, writeSanDrawingSync } from './drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY, HYDRO_FAMILIES, SAN_FAMILIES } from '../constants/storage-keys';
import type { SyncPlanInput, RawElement } from './drawingSync';

interface LocalDrawingData {
  ts?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

export function findContadorBajante(plans: SyncPlanInput[], net: string): { planId: string | number; bajante: RawElement } | null {
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    const bajante = (data.bajantes || []).find((b) => b.tipo === 'contador' && b.net === net);
    if (bajante) return { planId: plan.id, bajante };
  }
  return null;
}

export function readAcoDiamFromDrawing(plans: SyncPlanInput[], net: string): string | null {
  const found = findContadorBajante(plans, net);
  return found?.bajante?.acoDiam || null;
}

export function readContadorDiamFromDrawing(plans: SyncPlanInput[], net: string): string | null {
  const found = findContadorBajante(plans, net);
  return found?.bajante?.dNominal || null;
}

export function readCnt1Accesorios(plans: SyncPlanInput[], net: string): Record<string, number> {
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const hidroKey = `${net}_CNT1_${plan.id}`;
    const hidroRaw = loadFromStorage<Record<string, { accesorios?: Record<string, number> }> | null>(HYDRO_DATA_STORAGE_KEY, null);
    if (hidroRaw && hidroRaw[hidroKey]) {
      return hidroRaw[hidroKey].accesorios || {};
    }
  }
  return {};
}

export function deleteRamalFromDrawing(ramalKey: string, net: string, plans: SyncPlanInput[]) {
  if (!ramalKey || !net || !plans) return;
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];

  const apKey = `${net}_${ramalId}_${planId}`;

  const rawAparatos = loadFromStorage<Record<string, unknown> | null>(APARATOS_BY_TRAMO_KEY, null);
  if (rawAparatos && apKey in rawAparatos) {
    const copy = { ...rawAparatos };
    delete copy[apKey];
    saveToStorage(APARATOS_BY_TRAMO_KEY, copy);
  }

  const rawHidro = loadFromStorage<Record<string, unknown> | null>(HYDRO_DATA_STORAGE_KEY, null);
  if (rawHidro && apKey in rawHidro) {
    const copy = { ...rawHidro };
    delete copy[apKey];
    saveToStorage(HYDRO_DATA_STORAGE_KEY, copy);
  }

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    const before = (data.ramales || []).length;
    data.ramales = (data.ramales || []).filter((r) => !(r.id === ramalId && r.net === net));
    if ((data.ramales || []).length < before) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);
}

export function writeDiametroToDrawing(ramalKey: string, net: string, newDiamLabel: string, plans: SyncPlanInput[]) {
  if (!ramalKey || !net || !plans) return;
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;

    for (const r of (data.ramales || [])) {
      if (r.id === ramalId && r.net === net) {
        r.diametro = newDiamLabel;
        changed = true;
      }
    }

    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);
}

export function writeContadorDiamToDrawing(val: string, plans: SyncPlanInput[], net: string): void {
  if (!plans) return;
  const found = findContadorBajante(plans, net);
  if (!found) return;
  const key = TRAZOS_PREFIX + found.planId;
  const raw = loadFromStorage<LocalDrawingData | null>(key, null);
  if (!raw) return;
  const data = raw;

  const baj = (data.bajantes || []).find((b) => b.id === found.bajante.id);
  if (baj) {
    baj.dNominal = val;
  }

  data.ts = Date.now();
  saveToStorage(key, data);
  saveTrazosToDB(String(found.planId), data);
  if (HYDRO_FAMILIES.has(net)) writeHydroDrawingSync(plans);
  if (SAN_FAMILIES.has(net)) writeSanDrawingSync(plans);
}

export function writeAcoDiamToDrawing(val: string, plans: SyncPlanInput[], net: string): void {
  if (!plans) return;
  const found = findContadorBajante(plans, net);
  if (!found) return;
  const key = TRAZOS_PREFIX + found.planId;
  const raw = loadFromStorage<LocalDrawingData | null>(key, null);
  if (!raw) return;
  const data = raw;
  const baj = (data.bajantes || []).find((b) => b.id === found.bajante.id);
  if (baj) {
    baj.acoDiam = val;
    data.ts = Date.now();
    saveToStorage(key, data);
    saveTrazosToDB(String(found.planId), data);
    if (HYDRO_FAMILIES.has(net)) writeHydroDrawingSync(plans);
    if (SAN_FAMILIES.has(net)) writeSanDrawingSync(plans);
  }
}

export function writeBajantePropToDrawing(bajanteKey: string, net: string, prop: string, val: unknown, plans: SyncPlanInput[]) {
  if (!bajanteKey || !net || !plans) return;
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const parts = bajanteKey.split('-');
  const bajanteId = parts[0];
  const planId = parts[1];

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;

    for (const b of (data.bajantes || [])) {
      if (b.id === bajanteId && b.net === net) {
        b[prop] = val;
        changed = true;
      }
    }

    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);
}
