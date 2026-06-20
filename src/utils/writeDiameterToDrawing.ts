import { writeHydroDrawingSync, writeSanDrawingSync } from './drawingSync';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY, HYDRO_DATA_STORAGE_KEY, HYDRO_FAMILIES, SAN_FAMILIES } from '../constants/storage-keys';

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
      saveToStorage(key, data);
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
      saveToStorage(key, data);
    }
  }

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);
}
