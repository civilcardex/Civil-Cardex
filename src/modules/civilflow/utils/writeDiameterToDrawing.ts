import { writeHydroDrawingSync, writeSanDrawingSync } from './drawingSync';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX, HYDRO_FAMILIES, SAN_FAMILIES } from '../constants/storage-keys';
import type { SyncPlanInput, RawElement } from './drawingSync';
import { diamPulgFromLabel } from './diamPulgFromLabel';
import { maxDiametroLabel } from '../lib/PlanoEngine/PlanoEngineDrawing';

interface LocalDrawingData {
  ts?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

// diametroInicio/diametroFin are stored as the FULL option value from the diameter dropdown,
// e.g. `1-1/2" — 42.7 mm` — everywhere else that reads them (ExtremeAccessoryEditor.tsx,
// DrawingElementContextMenu.tsx) strips down to the inch part before the `"` first. Without
// that, diamPulgFromLabel's own em-dash handling kicks in and reads the *mm* figure after the
// dash as if it were inches (42.7 instead of 1.5) — a wildly inflated number that made every
// real check against it either impossibly strict or a false negative depending on which side
// of the comparison it landed on. This was why the validation never visibly fired: `newIn` (a
// real inch value) was being compared against `accMax` computed from millimeters.
const inchPartOf = (d: string): string => {
  const q = d.indexOf('"');
  return q > 0 ? d.slice(0, q) : d;
};

// Largest inch-equivalent diameter of any extreme accessory on this ramal (accesorioInicio /
// accesorioFin). Mid-ramal accMed* markers don't carry their own diameter so they can't
// constrain the ramal. Returns 0 if no accessory with a diameter is attached.
function maxAccessoryDiam(ramal: {
  accesorioInicio?: string;
  accesorioFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
}): number {
  let max = 0;
  if (ramal.accesorioInicio && ramal.diametroInicio) {
    max = Math.max(max, diamPulgFromLabel(inchPartOf(ramal.diametroInicio)));
  }
  if (ramal.accesorioFin && ramal.diametroFin) {
    max = Math.max(max, diamPulgFromLabel(inchPartOf(ramal.diametroFin)));
  }
  return max;
}

export function findContadorBajante(
  plans: SyncPlanInput[],
  net: string,
): { planId: string | number; bajante: RawElement } | null {
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

// Result type so the design-table caller (GasDesign, WaterNetworkDesign, etc.) can show the
// in-app AlertDialog instead of a silent rejection when the change violates a constraint.
export interface WriteDiametroResult {
  ok: boolean;
  reason?: 'accessory-larger';
  accessoryDiam?: string;
  attemptedDiam?: string;
}

export function writeDiametroToDrawing(
  ramalKey: string,
  net: string,
  newDiamLabel: string,
  plans: SyncPlanInput[],
): WriteDiametroResult {
  if (!ramalKey || !net || !plans) return { ok: false };
  const isHydro = HYDRO_FAMILIES.has(net);
  const isSan = SAN_FAMILIES.has(net);

  const parts = ramalKey.split('-');
  const ramalId = parts[0];
  const planId = parts[1];

  // Validation: a ramal's diameter cannot drop below the largest diameter of any accessory
  // attached to it. Mirror of the inverse check in ExtremeAccessoryEditor.tsx:110-117 — without
  // this, design-table pages can shrink a pipe under a wider accessory without anyone noticing
  // until render-time oddness (the wider-fitting accessory ends up drawn around a thinner pipe).
  let blockedReason: WriteDiametroResult | null = null;

  for (const plan of plans) {
    if (!plan || plan.status !== 'confirmed') continue;
    if (planId && String(plan.id) !== String(planId)) continue;
    const key = TRAZOS_PREFIX + plan.id;
    const raw = loadFromStorage<LocalDrawingData | null>(key, null);
    if (!raw) continue;
    const data = raw;
    let changed = false;

    for (const r of data.ramales || []) {
      if (r.id === ramalId && r.net === net) {
        if (newDiamLabel) {
          const newIn = diamPulgFromLabel(newDiamLabel.replace(/-/g, ' '));
          const accMax = maxAccessoryDiam(r as unknown as Parameters<typeof maxAccessoryDiam>[0]);
          if (newIn > 0 && accMax > 0 && newIn < accMax) {
            const accDiam =
              (r as unknown as { diametroInicio?: string; diametroFin?: string }).diametroInicio ||
              (r as unknown as { diametroInicio?: string; diametroFin?: string }).diametroFin ||
              '';
            blockedReason = {
              ok: false,
              reason: 'accessory-larger',
              accessoryDiam: accDiam,
              attemptedDiam: newDiamLabel,
            };
            continue;
          }
        }
        r.diametro = newDiamLabel;
        changed = true;
        // Propagate to any downstream ramal auto-created by a tee-split merge FROM this one —
        // mirror of the canvas walk in DrawingElementContextMenu.tsx:1949-1969. The child's
        // diametro is only computed at creation time, so editing a parent from a design-table
        // page must re-resolve it or the merged ramal keeps its stale diameter in storage.
        for (const child of data.ramales || []) {
          if (!child.mergesFrom || !child.mergesFrom.includes(r.id)) continue;
          const [pid1, pid2] = child.mergesFrom;
          const d1 =
            pid1 === r.id
              ? newDiamLabel
              : (data.ramales || []).find((p) => p.id === pid1)?.diametro || '';
          const d2 =
            pid2 === r.id
              ? newDiamLabel
              : (data.ramales || []).find((p) => p.id === pid2)?.diametro || '';
          const newChildDiam = maxDiametroLabel(d1, d2);
          if (newChildDiam && newChildDiam !== child.diametro) {
            child.diametro = newChildDiam;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      data.ts = Date.now();
      saveToStorage(key, data);
      saveTrazosToDB(String(plan.id), data);
    }
  }

  if (blockedReason) return blockedReason;

  if (isHydro) writeHydroDrawingSync(plans);
  if (isSan) writeSanDrawingSync(plans);
  return { ok: true };
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

export function writeBajantePropToDrawing(
  bajanteKey: string,
  net: string,
  prop: string,
  val: unknown,
  plans: SyncPlanInput[],
) {
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

    for (const b of data.bajantes || []) {
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
