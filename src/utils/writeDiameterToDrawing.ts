import { writeHydroDrawingSync, writeSanDrawingSync } from './drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY, HYDRO_FAMILIES, SAN_FAMILIES } from '../constants/storage-keys';

export function findContadorBajante(plans: any[], net: string): { planId: string | number; bajante: any } | null {
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage(key, null);
    if (!raw) continue;
    const data = raw as Record<string, any>;
    const bajante = (data.bajantes || []).find((b: any) => b.tipo === 'contador' && b.net === net);
    if (bajante) return { planId: plan.id, bajante };
  }
  return null;
}

export function readAcoDiamFromDrawing(plans: any[], net: string): string | null {
  const found = findContadorBajante(plans, net);
  return found?.bajante?.acoDiam || null;
}

export function readContadorDiamFromDrawing(plans: any[], net: string): string | null {
  const found = findContadorBajante(plans, net);
  return found?.bajante?.dNominal || null;
}

export function readCnt1Accesorios(plans: any[], net: string): Record<string, number> {
  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    const hidroKey = `${net}_CNT1_${plan.id}`;
    const hidroRaw = loadFromStorage(HYDRO_DATA_STORAGE_KEY, null) as Record<string, any> | null;
    if (hidroRaw && hidroRaw[hidroKey]) {
      return hidroRaw[hidroKey].accesorios || {};
    }
  }
  return {};
}

export function deleteRamalFromDrawing(ramalKey: string, net: string, plans: any[]) {
  if (!ramalKey || !net || !plans) return;
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];

  const apKey = `${net}_${ramalId}_${planId}`;

  const rawAparatos = loadFromStorage(APARATOS_BY_TRAMO_KEY, null) as Record<string, any> | null;
  if (rawAparatos && apKey in rawAparatos) {
    const copy = { ...rawAparatos };
    delete copy[apKey];
    saveToStorage(APARATOS_BY_TRAMO_KEY, copy);
  }

  const rawHidro = loadFromStorage(HYDRO_DATA_STORAGE_KEY, null) as Record<string, any> | null;
  if (rawHidro && apKey in rawHidro) {
    const copy = { ...rawHidro };
    delete copy[apKey];
    saveToStorage(HYDRO_DATA_STORAGE_KEY, copy);
  }

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage(key, null);
    if (!raw) continue;
    const data = raw as Record<string, any>;
    const before = (data.ramales || []).length;
    data.ramales = (data.ramales || []).filter((r: any) => !(r.id === ramalId && r.net === net));
    if ((data.ramales || []).length < before) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);
}

export function writeDiametroToDrawing(ramalKey: string, net: string, newDiamLabel: string, plans: any[]) {
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
    const raw = loadFromStorage(key, null);
    if (!raw) continue;
    const data = raw as Record<string, any>;
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

export function writeContadorDiamToDrawing(val: string, plans: any[], net: string): void {
  if (!plans) return;
  const found = findContadorBajante(plans, net);
  if (!found) return;
  const key = TRAZOS_PREFIX + found.planId;
  const raw = loadFromStorage(key, null);
  if (!raw) return;
  const data = raw as Record<string, any>;

  // Write to bajante's dNominal
  const baj = (data.bajantes || []).find((b: any) => b.id === found.bajante.id);
  if (baj) {
    baj.dNominal = val;
  }

  data.ts = Date.now();
  saveToStorage(key, data);
  saveTrazosToDB(String(found.planId), data);
  if (HYDRO_FAMILIES.has(net)) writeHydroDrawingSync(plans);
  if (SAN_FAMILIES.has(net)) writeSanDrawingSync(plans);
}

export function writeAcoDiamToDrawing(val: string, plans: any[], net: string): void {
  if (!plans) return;
  const found = findContadorBajante(plans, net);
  if (!found) return;
  const key = TRAZOS_PREFIX + found.planId;
  const raw = loadFromStorage(key, null);
  if (!raw) return;
  const data = raw as Record<string, any>;
  const baj = (data.bajantes || []).find((b: any) => b.id === found.bajante.id);
  if (baj) {
    baj.acoDiam = val;
    data.ts = Date.now();
    saveToStorage(key, data);
    saveTrazosToDB(String(found.planId), data);
    if (HYDRO_FAMILIES.has(net)) writeHydroDrawingSync(plans);
    if (SAN_FAMILIES.has(net)) writeSanDrawingSync(plans);
  }
}

export function writeBajantePropToDrawing(bajanteKey: string, net: string, prop: string, val: any, plans: any[]) {
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
    const raw = loadFromStorage(key, null);
    if (!raw) continue;
    const data = raw as Record<string, any>;
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
