import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX, TRAZOS_PLAN_PREFIX } from '../constants/storage-keys';
import { NETS } from '../lib/PlanoEngine/PlanoState';
import type { LabelBoxCorners } from '../lib/PlanoEngine/PlanoState';

interface LocalLdesvioRamal {
  id: string;
  net: string;
  tipo: 'ramal';
  padre: null;
  pts: number[][];
  totalL: number;
  label: string;
  ini: string;
  fin: string;
  piso: string;
  dz: string;
  uc: number;
  labelX: number;
  labelY: number;
  labelAngle: number;
  material: string;
  diametro: string;
  pendiente: number;
  bloqueado: boolean;
}

// A cross-floor ghost is a pure positional reference marker — it's NOT a real riser, carries no
// recibeDeIds/alimentaIds, and lives in its own storage array (`crossFloorGhosts`), completely
// separate from `bajantes`/`ramales`. This keeps it invisible to every existing hydraulic-calc,
// design-table, and bajante-count code path (all of which only ever read `data.bajantes`), so it
// can never contaminate a total or consume a BAN2/BAN3-style label slot by accident.
export interface CrossFloorGhost {
  id: string;
  net: string;
  code: string;
  x: number;
  y: number;
  dNominal: string;
  direccion: 'sube' | 'baja';
  /**
   * Direction of the SOURCE (upper-floor) parent bajante. The ghost itself points the OPPOSITE
   * way (it's where the parent arrives from in this floor's diagram), but the label rendered on
   * this ghost must read the parent's actual direction so users can see where flow is going on
   * the floor above — not the ghost's synthetic counter-direction.
   */
  parentDireccion?: 'sube' | 'baja';
  piso: string;
  sourcePlanId: string;
  sourceBajanteId: string;
  targetBajanteId?: string;
  // Runtime-only hit box, recomputed every render (same convention as PlanoBajante._circ/_ghost)
  // — rides along in the serialized JSON like those do, harmless extra field.
  _hitCircle?: { x: number; y: number; r: number };
  _crossFloorLabelBox?: LabelBoxCorners;
}

interface LocalGhostDrawingData {
  ts?: number;
  crossFloorGhosts?: CrossFloorGhost[];
  [key: string]: unknown;
}

function loadData(planId: string | number): LocalGhostDrawingData {
  const raw = loadFromStorage<LocalGhostDrawingData | null>(TRAZOS_PREFIX + planId, null);
  return raw || {};
}

function saveData(planId: string | number, data: LocalGhostDrawingData): void {
  data.ts = Date.now();
  saveToStorage(TRAZOS_PREFIX + planId, data);
  saveTrazosToDB(String(planId), data);
}

// Writes (or replaces, if one from the same source already exists) a cross-floor ghost into the
// TARGET floor's own raw storage — the target floor doesn't need to be currently loaded/live.
export function writeCrossFloorGhost(targetPlanId: string | number, ghost: CrossFloorGhost): void {
  const data = loadData(targetPlanId);
  const list = (data.crossFloorGhosts || []).filter(
    (g) => !(g.sourcePlanId === ghost.sourcePlanId && g.sourceBajanteId === ghost.sourceBajanteId),
  );
  list.push(ghost);
  data.crossFloorGhosts = list;
  saveData(targetPlanId, data);
}

// Removes any ghost this specific source bajante previously placed on `targetPlanId` — used when
// re-associating to a different floor (or clearing the association) so a stale ghost doesn't stay
// behind on the floor that's no longer the target.
export function removeCrossFloorGhost(
  targetPlanId: string | number,
  sourcePlanId: string | number,
  sourceBajanteId: string,
): void {
  const data = loadData(targetPlanId);
  const list = (data.crossFloorGhosts || []).filter(
    (g) => !(g.sourcePlanId === String(sourcePlanId) && g.sourceBajanteId === sourceBajanteId),
  );
  if (list.length === (data.crossFloorGhosts || []).length) return;
  data.crossFloorGhosts = list;
  saveData(targetPlanId, data);
}

// Scans ALL floors' localStorage and removes any cross-floor ghost referencing the given source
// bajante. Called when a bajante is deleted — stale ghosts on other floors must be cleaned up.
export function removeCrossFloorGhostsBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
): void {
  const sp = String(sourcePlanId);
  // localStorage keys are prefixed with 'civilflow_' by saveToStorage, so the TRAZOS_PREFIX
  // ('trazos_') becomes 'civilflow_trazos_' (== TRAZOS_PLAN_PREFIX) in actual storage. Iterate
  // by full prefixed key to locate every floor's trace data and strip matching ghosts.
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const targetPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (targetPlanId === sp) continue; // same floor, skip
    try {
      const data: LocalGhostDrawingData = JSON.parse(localStorage.getItem(k) || '{}');
      if (!data.crossFloorGhosts?.length) continue;
      const before = data.crossFloorGhosts.length;
      data.crossFloorGhosts = data.crossFloorGhosts.filter(
        (g) => !(g.sourcePlanId === sp && g.sourceBajanteId === sourceBajanteId),
      );
      if (data.crossFloorGhosts.length === before) continue;
      saveData(targetPlanId, data);
    } catch {
      continue;
    }
  }
}

// Removes a bajante/montante entirely from a (possibly not currently loaded) floor's own storage
// — used to cascade-delete the OTHER end of a cross-floor association when one side is deleted.
export function deleteBajanteFromStorage(planId: string | number, bajanteId: string): void {
  const data = loadData(planId) as LocalGhostDrawingData & { bajantes?: { id: string }[] };
  if (!data.bajantes?.length) return;
  const before = data.bajantes.length;
  data.bajantes = data.bajantes.filter((b) => b.id !== bajanteId);
  if (data.bajantes.length === before) return;
  saveData(planId, data);
}

// Deterministic id for a source bajante's Ldesvio connector — one per source, always overwritable
// by re-running create with the same sourceBajanteId, and directly removable by id without having
// to search/guess which sequential ramal number it got. Also deliberately NOT of the form
// `${netPrefix}\d+` (see PlanoPersistence.ts's counting regex on load), so it never consumes a
// real ramal number slot.
export function ldesvioIdFor(sourceBajanteId: string): string {
  return `LD_${sourceBajanteId}`;
}

// The Ldesvio's `id` is a stable, deterministic key (for lookup/cleanup) — its `label` (what's
// actually printed on the drawing) must instead read like any other ramal's, e.g. "R12", or it
// prints the raw internal id ("LD_BAN1...") on the plan. Mirrors the same scan `PlanoPersistence.ts`
// does on load: highest existing `${prefix}N` for this net, +1 — but only among REAL ramales (never
// another Ldesvio, which never matches that pattern to begin with, so no special exclusion needed).
export function nextRamalLabel(net: string, existingRamales: { id?: string }[]): string {
  const netDef = NETS.find((n) => n.id === net);
  const prefix = netDef?.lbl || 'R';
  let maxN = 0;
  for (const r of existingRamales) {
    const m = r.id?.match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `${prefix}${maxN + 1}`;
}

export function buildLdesvioRamal(
  id: string,
  label: string,
  net: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  diametro: string,
  pisoNivel: number,
  scaleM: number,
  bloqueado: boolean = true,
): LocalLdesvioRamal {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distPx = Math.hypot(dx, dy);
  let lblAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (lblAngle > 90) lblAngle -= 180;
  if (lblAngle < -90) lblAngle += 180;
  const perpX = -dy / (distPx || 1);
  const perpY = dx / (distPx || 1);
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts: [
      [x1, y1],
      [x2, y2],
    ],
    totalL: +((distPx / 96) * 2.54 * scaleM).toFixed(3),
    label,
    ini: '',
    fin: '',
    piso: String(pisoNivel),
    dz: '',
    uc: 0,
    labelX: (x1 + x2) / 2 + perpX * 25,
    labelY: (y1 + y2) / 2 + perpY * 25,
    labelAngle: Math.round(lblAngle),
    material: '',
    diametro: diametro || '',
    pendiente: 2,
    bloqueado,
  };
}

// Creates (or replaces, if one from the same source already exists) the "Ldesvio" connector ramal
// on the SOURCE bajante's OWN floor — the visual counterpart to the ghost written on the target
// floor: the ghost shows where the pipe arrives, this ramal shows the (possibly diagonal) offset it
// travels before it does, on the floor the offset actually belongs to. Writes directly to that
// floor's storage — appropriate when that floor is NOT the currently loaded one (the caller must
// push to the live engine.ramales itself instead, when it is, so autosave doesn't clobber this).
export function createCrossFloorLdesvioRamal(
  planId: string | number,
  sourceBajanteId: string,
  net: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  diametro: string,
  pisoNivel: number,
): void {
  const data = loadData(planId) as LocalGhostDrawingData & {
    ramales?: LocalLdesvioRamal[];
    scaleM?: number;
  };
  const id = ldesvioIdFor(sourceBajanteId);
  const existing = (data.ramales || []).find((r) => r.id === id);
  const label = existing?.label || nextRamalLabel(net, data.ramales || []);
  const ramal = buildLdesvioRamal(
    id,
    label,
    net,
    x1,
    y1,
    x2,
    y2,
    diametro,
    pisoNivel,
    data.scaleM || 0.5,
    existing ? existing.bloqueado : true,
  );
  data.ramales = [...(data.ramales || []).filter((r) => r.id !== id), ramal];
  saveData(planId, data);
}

// Removes the deterministic Ldesvio connector for the given source bajante from `planId`'s own
// storage — used when clearing/re-pointing an association so the old detour ramal doesn't linger.
export function removeCrossFloorLdesvioRamal(
  planId: string | number,
  sourceBajanteId: string,
): void {
  const data = loadData(planId) as LocalGhostDrawingData & { ramales?: LocalLdesvioRamal[] };
  const id = ldesvioIdFor(sourceBajanteId);
  const before = (data.ramales || []).length;
  data.ramales = (data.ramales || []).filter((r) => r.id !== id);
  if (data.ramales.length === before) return;
  saveData(planId, data);
}

// Updates the FAR endpoint (pts[1], the target's position) of a source bajante's Ldesvio connector,
// wherever that connector's own floor is — called after the TARGET bajante (not the source) moves,
// since the connector lives on the source's floor and can't be reached through the live engine when
// that's a different, currently-unloaded plan.
export function updateCrossFloorLdesvioFarEndpoint(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  x: number,
  y: number,
): void {
  const data = loadData(sourcePlanId) as LocalGhostDrawingData & {
    ramales?: LocalLdesvioRamal[];
    scaleM?: number;
  };
  const id = ldesvioIdFor(sourceBajanteId);
  const idx = (data.ramales || []).findIndex((r) => r.id === id);
  if (idx === -1) return;
  const r = data.ramales![idx];
  const [x1, y1] = r.pts[0];
  if (Math.abs(r.pts[1][0] - x) < 0.01 && Math.abs(r.pts[1][1] - y) < 0.01) return;
  data.ramales![idx] = buildLdesvioRamal(
    id,
    r.label || id,
    r.net,
    x1,
    y1,
    x,
    y,
    r.diametro,
    Number(r.piso) || 0,
    data.scaleM || 0.5,
    r.bloqueado,
  );
  saveData(sourcePlanId, data);
}

interface StoredDesplazamientoBajante {
  id: string;
  x?: number;
  y?: number;
  desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
}

// Re-anchors the "displaced circle" marker (desplazamientos) on the SOURCE floor's bajante after
// the TARGET bajante (on a different, possibly not-loaded floor) moves: the marker must sit at the
// target's projected position, so dx/dy change by exactly the target's movement delta. Sweeps the
// desplazamiento entry by its Ldesvio connector id (unique per source bajante), same key-lookup
// strategy as removeBajanteDesplazamientoFromStorage — without this, the dashed ring on the source
// floor stayed stuck at the position it had when the association was created and visually "lost"
// the connection once the target was dragged elsewhere.
export function updateCrossFloorDesplazamientoBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  targetX: number,
  targetY: number,
): void {
  const data = loadData(sourcePlanId) as LocalGhostDrawingData & {
    bajantes?: StoredDesplazamientoBajante[];
  };
  if (!data.bajantes?.length) return;
  const b = data.bajantes.find((x) => x.id === sourceBajanteId);
  if (!b?.desplazamientos) return;
  const ldId = ldesvioIdFor(sourceBajanteId);
  let changed = false;
  const desp = { ...b.desplazamientos };
  for (const lvlKey of Object.keys(desp)) {
    if (desp[lvlKey]?.Ldesvio === ldId) {
      desp[lvlKey] = {
        ...desp[lvlKey],
        dx: targetX - (b.x ?? 0),
        dy: targetY - (b.y ?? 0),
      };
      changed = true;
    }
  }
  if (!changed) return;
  b.desplazamientos = desp;
  saveData(sourcePlanId, data);
}

// Updates just the diameter of an existing cross-floor ghost, wherever it currently lives.
export function updateCrossFloorGhostDiameter(
  hostPlanId: string | number,
  ghostId: string,
  dNominal: string,
): void {
  const data = loadData(hostPlanId);
  const list = data.crossFloorGhosts || [];
  const idx = list.findIndex((g) => g.id === ghostId);
  if (idx === -1) return;
  list[idx] = { ...list[idx], dNominal };
  data.crossFloorGhosts = list;
  saveData(hostPlanId, data);
}

// Sweeps ALL floors' localStorage for cross-floor ghosts whose `sourceBajanteId` matches the given
// parent and updates a single field on each. Called when the parent bajante's diameter or
// direction is changed — without this the mirror ghost on the target floor keeps reading the
// stale value.
export function updateCrossFloorGhostFieldBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  field: 'dNominal' | 'parentDireccion',
  value: string,
): void {
  const sp = String(sourcePlanId);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const targetPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (targetPlanId === sp) continue; // same floor, skip — parent bajante updated there directly
    try {
      const data: LocalGhostDrawingData = JSON.parse(localStorage.getItem(k) || '{}');
      if (!data.crossFloorGhosts?.length) continue;
      let dirty = false;
      for (let j = 0; j < data.crossFloorGhosts.length; j++) {
        const g = data.crossFloorGhosts[j];
        if (g.sourcePlanId === sp && g.sourceBajanteId === sourceBajanteId) {
          const current = (g as unknown as Record<string, unknown>)[field];
          if (current !== value) {
            data.crossFloorGhosts[j] = { ...g, [field]: value };
            dirty = true;
          }
        }
      }
      if (dirty) saveData(targetPlanId, data);
    } catch {
      continue;
    }
  }
}

// Sweeps ALL floors' localStorage for a cross-floor ghost whose `sourceBajanteId` matches the
// given SOURCE bajante and updates its x/y — called after that bajante finishes being dragged on
// its own floor, so a ghost mirroring it on another floor (created via either the "Destino" or
// "Origen" selector — both ultimately key off descargaEnId/sourceBajanteId the same way) doesn't
// stay stuck at its position from creation time.
export function updateCrossFloorGhostPositionBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  x: number,
  y: number,
): void {
  const sp = String(sourcePlanId);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const targetPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (targetPlanId === sp) continue;
    try {
      const data: LocalGhostDrawingData = JSON.parse(localStorage.getItem(k) || '{}');
      if (!data.crossFloorGhosts?.length) continue;
      let dirty = false;
      for (let j = 0; j < data.crossFloorGhosts.length; j++) {
        const g = data.crossFloorGhosts[j];
        if (
          g.sourcePlanId === sp &&
          g.sourceBajanteId === sourceBajanteId &&
          (g.x !== x || g.y !== y)
        ) {
          data.crossFloorGhosts[j] = { ...g, x, y };
          dirty = true;
        }
      }
      if (dirty) saveData(targetPlanId, data);
    } catch {
      continue;
    }
  }
}

// Back-compat alias kept so any external call sites still resolve. New code should use
// updateCrossFloorGhostFieldBySource directly with `field: 'dNominal'`.
export function updateCrossFloorGhostDiameterBySource(
  sourcePlanId: string | number,
  sourceBajanteId: string,
  dNominal: string,
): void {
  updateCrossFloorGhostFieldBySource(sourcePlanId, sourceBajanteId, 'dNominal', dNominal);
}

// A bajante's id/code gets rewritten whenever _renumberBajantes runs (networkRenumber.ts) — e.g.
// after ANY bajante on the same net/floor is deleted, closing the numbering gap. Every
// cross-floor cross-reference is keyed off that id (the Ldesvio ramal's own id is `LD_<id>`, the
// mirror ghost's `sourceBajanteId`/`targetBajanteId`, and the other side's `descargaEnId`/
// `origenId` pointer, format `${planId}|${id}`) — none of that gets updated by the plain rename,
// so a renumbered bajante that had an active cross-floor association silently orphans its own
// Ldesvio/ghost forever: every later lookup (including disassociating) computes the key from the
// bajante's CURRENT id and simply never finds the stale one anymore, so it's never cleaned up.
// Called once per changed id, right after the rename, from _renumberBajantes.
export function renameBajanteAcrossFloorReferences(
  thisPlanId: string,
  oldId: string,
  newId: string,
): void {
  if (oldId === newId) return;
  const oldLd = ldesvioIdFor(oldId);
  const newLd = ldesvioIdFor(newId);
  const oldPointer = `${thisPlanId}|${oldId}`;
  const newPointer = `${thisPlanId}|${newId}`;

  // This floor's own storage: the Ldesvio ramal (if this bajante is a cross-floor source), the
  // matching desplazamientos self-reference, and any ramal endpoint (ini/fin) still holding the
  // old code.
  const own = loadData(thisPlanId) as LocalGhostDrawingData & {
    ramales?: (LocalLdesvioRamal & { ini?: string; fin?: string })[];
    bajantes?: StoredDesplazamientoBajante[];
  };
  let ownDirty = false;
  for (const r of own.ramales || []) {
    if (r.id === oldLd) {
      r.id = newLd;
      ownDirty = true;
    }
    if (r.ini === oldId) {
      r.ini = newId;
      ownDirty = true;
    }
    if (r.fin === oldId) {
      r.fin = newId;
      ownDirty = true;
    }
  }
  for (const b of own.bajantes || []) {
    if (!b.desplazamientos) continue;
    for (const lvlKey of Object.keys(b.desplazamientos)) {
      if (b.desplazamientos[lvlKey]?.Ldesvio === oldLd) {
        b.desplazamientos[lvlKey] = { ...b.desplazamientos[lvlKey], Ldesvio: newLd };
        ownDirty = true;
      }
    }
  }
  if (ownDirty) saveData(thisPlanId, own);

  // Every other floor's storage: the mirror ghost this bajante wrote (as source) — id and
  // sourceBajanteId — and any descargaEnId/origenId pointer aimed at `${thisPlanId}|${oldId}`
  // (covers this bajante as either the discharge target of some other floor's source, or the
  // origin another floor's target points back at).
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const otherPlanId = k.slice(TRAZOS_PLAN_PREFIX.length);
    if (otherPlanId === thisPlanId) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw) as LocalGhostDrawingData & {
        bajantes?: { descargaEnId?: string | null; origenId?: string | null }[];
      };
      let dirty = false;
      for (const g of data.crossFloorGhosts || []) {
        if (g.sourcePlanId === thisPlanId && g.sourceBajanteId === oldId) {
          g.sourceBajanteId = newId;
          g.id = `XFG_${newId}_${thisPlanId}`;
          dirty = true;
        }
        if (g.targetBajanteId === oldId) {
          g.targetBajanteId = newId;
          dirty = true;
        }
      }
      for (const b of data.bajantes || []) {
        if (b.descargaEnId === oldPointer) {
          b.descargaEnId = newPointer;
          dirty = true;
        }
        if (b.origenId === oldPointer) {
          b.origenId = newPointer;
          dirty = true;
        }
      }
      if (dirty) saveData(otherPlanId, data);
    } catch {
      continue;
    }
  }
}

// Fills in any missing parentDireccion/dNominal on the given ghosts by looking up the source
// bajante's current values in its floor's localStorage. Legacy ghosts written before those
// fields existed (and ghosts whose parent was edited on the source floor but the mirror never
// re-loaded) need this back-fill so the target-floor label shows accurate, up-to-date values.
export function enrichCrossFloorGhosts(ghosts: CrossFloorGhost[]): CrossFloorGhost[] {
  if (!ghosts.length) return ghosts;
  const cache: Record<string, LocalGhostDrawingData> = {};
  const loadPlan = (planId: string): LocalGhostDrawingData => {
    if (cache[planId]) return cache[planId];
    try {
      const raw = JSON.parse(localStorage.getItem('civilflow_' + 'trazos_' + planId) || '{}');
      cache[planId] = raw;
      return raw;
    } catch {
      cache[planId] = {};
      return cache[planId];
    }
  };
  let changed = false;
  const out: CrossFloorGhost[] = [];
  for (const g of ghosts) {
    let next: CrossFloorGhost = g;
    const needsDir = !g.parentDireccion && (g.sourcePlanId || '').length > 0;
    const needsDiam = !g.dNominal && (g.sourcePlanId || '').length > 0;
    if (needsDir || needsDiam) {
      const data = loadPlan(g.sourcePlanId) as LocalGhostDrawingData & {
        bajantes?: { id?: string; direccion?: string; dNominal?: string }[];
      };
      const b = (data.bajantes || []).find((bb) => bb.id === g.sourceBajanteId);
      if (b) {
        const patch: Partial<CrossFloorGhost> = {};
        if (needsDir && (b.direccion === 'sube' || b.direccion === 'baja')) {
          patch.parentDireccion = b.direccion;
        }
        if (needsDiam && typeof b.dNominal === 'string') {
          patch.dNominal = b.dNominal;
        }
        if (Object.keys(patch).length) {
          next = { ...g, ...patch };
          changed = true;
        }
      }
    }
    out.push(next);
  }
  return changed ? out : ghosts;
}
