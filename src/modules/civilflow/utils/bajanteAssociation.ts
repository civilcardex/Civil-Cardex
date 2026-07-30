import { writeBajantePropToDrawing } from './writeDiameterToDrawing';
import type { SyncPlanInput } from './drawingSync';
import {
  writeCrossFloorGhost,
  removeCrossFloorGhost,
  createCrossFloorLdesvioRamal,
  removeCrossFloorLdesvioRamal,
  buildLdesvioRamal,
  ldesvioIdFor,
  nextRamalLabel,
  type CrossFloorGhost,
} from './associateBajanteAcrossFloors';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { pisoCorto, pisoLbl } from '../constants';
import type PlanoEngine from '../lib/PlanoEngine/PlanoEngine';

interface StoredBajanteDesp {
  id: string;
  desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
}

// Same "displaced ghost of itself" bookkeeping applyBajanteAssociation/clearBajanteAssociation do
// on the LIVE engine when the source's own floor happens to be loaded — mirrored here for when it
// ISN'T (the "Origen" flow always associates from a floor other than the one the origin bajante
// actually lives on), by patching that floor's storage directly.
// Removes whichever desplazamientos level-key this bajante's Ldesvio connector was tagged into —
// keyed by the Ldesvio id (unique per source) rather than a level label, since the label can't
// always be reconstructed from the caller's own (possibly different) currently-loaded floor.
function removeBajanteDesplazamientoFromStorage(planId: string, bajanteId: string): void {
  const key = TRAZOS_PREFIX + planId;
  const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(key, null);
  if (!raw?.bajantes) return;
  const b = raw.bajantes.find((x) => x.id === bajanteId);
  if (!b?.desplazamientos) return;
  const ldId = ldesvioIdFor(bajanteId);
  let changed = false;
  const desp = { ...b.desplazamientos };
  for (const lvlKey of Object.keys(desp)) {
    if (desp[lvlKey]?.Ldesvio === ldId) {
      delete desp[lvlKey];
      changed = true;
    }
  }
  if (!changed) return;
  b.desplazamientos = desp;
  saveToStorage(key, raw);
  saveTrazosToDB(planId, raw);
}

function setBajanteDesplazamientoInStorage(
  planId: string,
  bajanteId: string,
  lvl: string,
  disp: { dx: number; dy: number; Ldesvio?: string } | null,
): void {
  const key = TRAZOS_PREFIX + planId;
  const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(key, null);
  if (!raw?.bajantes) return;
  const b = raw.bajantes.find((x) => x.id === bajanteId);
  if (!b) return;
  const desp = { ...(b.desplazamientos || {}) };
  if (disp) desp[lvl] = disp;
  else delete desp[lvl];
  b.desplazamientos = desp;
  saveToStorage(key, raw);
  saveTrazosToDB(planId, raw);
}

// One bajante/montante endpoint of a cross-floor association — enough to write both directions'
// pointers, the ghost, and (when misaligned) the Ldesvio detour ramal, regardless of which of the
// two floors happens to be the one currently loaded live.
export interface AssocEndpoint {
  planId: string;
  id: string;
  x: number;
  y: number;
  net: string;
  dNominal: string;
  code: string;
  /** plan.nivel — the floor's ordinal index, used for piso labels and elevation comparison. */
  nivelN: number;
  npt: number;
}

function isAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

export function areEndpointsAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  return isAligned(a, b);
}

// Removes everything belonging to a previously-established link where `sourcePlanId`/
// `sourceBajanteId` was the descargaEnId-holding side of `oldLinkValue` ("targetPlanId|targetId"):
// its ghost (on the old target's floor), its Ldesvio (on the source's own floor), and the old
// target's reverse origenId pointer. Called before applying a NEW link, or when clearing one.
export function clearBajanteAssociation(
  eng: PlanoEngine,
  sourcePlanId: string,
  sourceBajanteId: string,
  sourceNet: string,
  oldLinkValue: string,
  plans: SyncPlanInput[],
): void {
  const [targetPlanId, targetBajanteId] = oldLinkValue.split('|');
  if (!targetPlanId || !targetBajanteId) return;
  const loadedPlanId = String(eng._loadedPlanId ?? '');

  removeCrossFloorGhost(targetPlanId, sourcePlanId, sourceBajanteId);
  removeCrossFloorLdesvioRamal(sourcePlanId, sourceBajanteId);
  writeBajantePropToDrawing(
    `${targetBajanteId}-${targetPlanId}`,
    sourceNet,
    'origenId',
    null,
    plans,
  );

  if (loadedPlanId === targetPlanId) {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) => !(g.sourcePlanId === sourcePlanId && g.sourceBajanteId === sourceBajanteId),
    );
    const t = eng.bajantes.find((b) => b.id === targetBajanteId);
    if (t) eng.updateElementById(t.id, { origenId: null });
  }
  if (loadedPlanId === sourcePlanId) {
    const ldId = ldesvioIdFor(sourceBajanteId);
    eng.ramales = eng.ramales.filter((r) => r.id !== ldId);
    const srcBaj = eng.bajantes.find((b) => b.id === sourceBajanteId);
    const lvl = eng.nivelActual?.label ?? '';
    if (srcBaj?.desplazamientos?.[lvl]) {
      const desp = { ...srcBaj.desplazamientos };
      delete desp[lvl];
      eng.updateElementById(sourceBajanteId, { desplazamientos: desp });
    }
  } else {
    // Mirrors the storage-only write path in applyBajanteAssociation's `else` branch — the
    // source's own floor may not be loaded here either (clearing an "Origen" link from below).
    // The level label can't be reconstructed from `eng.nivelActual` (that's the CURRENT floor,
    // not the source's), so this sweeps every level key by parsed piso number instead.
    removeBajanteDesplazamientoFromStorage(sourcePlanId, sourceBajanteId);
  }
}

// Establishes source -> target: writes BOTH pointers (source.descargaEnId, target.origenId),
// always creates the ghost (on target's floor, at source's position — a permanent visual
// confirmation the link exists, not just something that appears when misaligned), and creates the
// Ldesvio detour ramal (on source's floor) only when the two aren't already aligned.
export function applyBajanteAssociation(
  eng: PlanoEngine,
  source: AssocEndpoint,
  target: AssocEndpoint,
  plans: SyncPlanInput[],
): { aligned: boolean } {
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const linkValue = `${target.planId}|${target.id}`;
  const reverseValue = `${source.planId}|${source.id}`;
  const targetIsBelow = target.npt < source.npt;
  const sourceDireccion: 'sube' | 'baja' = targetIsBelow ? 'baja' : 'sube';
  const ghostDireccion: 'sube' | 'baja' = targetIsBelow ? 'sube' : 'baja';
  const aligned = isAligned(source, target);

  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'descargaEnId',
    linkValue,
    plans,
  );
  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'direccion',
    sourceDireccion,
    plans,
  );
  writeBajantePropToDrawing(
    `${target.id}-${target.planId}`,
    target.net,
    'origenId',
    reverseValue,
    plans,
  );
  if (loadedPlanId === source.planId) {
    eng.updateElementById(source.id, { descargaEnId: linkValue, direccion: sourceDireccion });
  }
  if (loadedPlanId === target.planId) {
    eng.updateElementById(target.id, { origenId: reverseValue });
  }

  const ghost: CrossFloorGhost = {
    id: `XFG_${source.id}_${source.planId}`,
    net: source.net,
    code: source.code || source.id,
    x: source.x,
    y: source.y,
    dNominal: source.dNominal || '',
    direccion: ghostDireccion,
    parentDireccion: sourceDireccion,
    piso: pisoCorto(source.nivelN),
    sourcePlanId: source.planId,
    sourceBajanteId: source.id,
    targetBajanteId: target.id,
  };
  writeCrossFloorGhost(target.planId, ghost);
  if (loadedPlanId === target.planId) {
    eng.crossFloorGhosts = [
      ...eng.crossFloorGhosts.filter(
        (g) => !(g.sourcePlanId === source.planId && g.sourceBajanteId === source.id),
      ),
      ghost,
    ];
  }

  if (!aligned) {
    createCrossFloorLdesvioRamal(
      source.planId,
      source.id,
      source.net,
      source.x,
      source.y,
      target.x,
      target.y,
      source.dNominal || '',
      source.nivelN,
    );
    if (loadedPlanId === source.planId) {
      const ldId = ldesvioIdFor(source.id);
      const existing = eng.ramales.find((r) => r.id === ldId);
      const label = existing?.label || nextRamalLabel(source.net, eng.ramales);
      const ramal = buildLdesvioRamal(
        ldId,
        label,
        source.net,
        source.x,
        source.y,
        target.x,
        target.y,
        source.dNominal || '',
        source.nivelN,
        eng.scaleM || 0.5,
      );
      eng.ramales = [...eng.ramales.filter((r) => r.id !== ldId), ramal as never];

      // Also drive the OLDER same-floor "desplazamiento" ghost (getBajantesFantasma/renderGhosts)
      // — a displaced circle of the source bajante ITSELF, at the target's projected position, on
      // the source's own floor. Pre-existing feature the original Destino handler always drove
      // alongside the cross-floor ghost; dropped by mistake in the association rewrite.
      const lvl = eng.nivelActual?.label ?? '';
      if (lvl) {
        const srcBaj = eng.bajantes.find((b) => b.id === source.id);
        if (srcBaj) {
          const desp = { ...(srcBaj.desplazamientos || {}) };
          desp[lvl] = { dx: target.x - source.x, dy: target.y - source.y, Ldesvio: ldId };
          eng.updateElementById(source.id, { desplazamientos: desp });
        }
      }
    } else {
      // Source's own floor isn't loaded (e.g. associating via "Origen" from below) — same
      // bookkeeping, written straight to that floor's storage instead of the live engine.
      setBajanteDesplazamientoInStorage(source.planId, source.id, pisoLbl(source.nivelN), {
        dx: target.x - source.x,
        dy: target.y - source.y,
        Ldesvio: ldesvioIdFor(source.id),
      });
    }
  }

  eng.render();
  eng._markDirty();
  return { aligned };
}
