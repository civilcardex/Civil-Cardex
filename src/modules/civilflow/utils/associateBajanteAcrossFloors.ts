import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX } from '../constants/storage-keys';

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
  sourcePlanId: string;
  sourceBajanteId: string;
  // Runtime-only hit box, recomputed every render (same convention as PlanoBajante._circ/_ghost)
  // — rides along in the serialized JSON like those do, harmless extra field.
  _hitCircle?: { x: number; y: number; r: number };
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
