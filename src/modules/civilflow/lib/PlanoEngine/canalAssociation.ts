import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';

/**
 * Selection hit-test distance for a bajante-array element at canvas point (x, y) — Infinity if
 * the point misses it. Canal uses its own rectangle (inflated 110%, `_canalBox` is canvas-space,
 * set by renderCanalGlyph) instead of the shared `_circ` — the circle every other bajante-array
 * type uses is sized to the rectangle's DIAGONAL, so for a canal it was a wildly oversized click
 * target (up to ~40% bigger than the rectangle on a square canal, worse the more elongated it
 * is), reaching well past the rectangle's own edges. Every other type keeps the existing circle.
 */
export function bajanteHitDistance(b: PlanoBajante, x: number, y: number): number {
  if (b.tipo === 'canal') {
    const box = b._canalBox;
    if (!box) return Infinity;
    const scale = 1.1;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const hw = (box.w * scale) / 2;
    const hh = (box.h * scale) / 2;
    if (x < cx - hw || x > cx + hw || y < cy - hh || y > cy + hh) return Infinity;
    // A canal can be much larger than the ~50px cap callers use for "closest point symbol"
    // comparisons (distance-to-center would exceed that on a long canal even dead center-click
    // near an end) — containment alone already picks it out, so report a small constant instead
    // of the true center distance.
    return 1;
  }
  if (!b._circ) return Infinity;
  const d = Math.hypot(x - b._circ.x, y - b._circ.y);
  return d < b._circ.r ? d : Infinity;
}

/** Plane-space rect for a canal (b.x/b.y is the top-left corner; base/altura are cm, converted
 * to plane px the same way _tryCanalResizeHit in handleMouseDown.ts already does). */
function canalRect(engine: IPlanoEngineCore, canal: PlanoBajante) {
  const w = engine.cmToPlanePx(canal.base || 0);
  const h = engine.cmToPlanePx(canal.altura || 0);
  return { x0: canal.x, y0: canal.y, x1: canal.x + w, y1: canal.y + h };
}

function pointInCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): boolean {
  const r = canalRect(engine, canal);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/**
 * Resolves which canal (if any) a rainwater ("ll") bajante at (x, y) belongs to — preferring
 * its already-associated canal (`preferId`) so a drag stays anchored to the same canal even if
 * it happens to overlap another one, and only falling back to "whichever ll canal contains this
 * point" when there's no existing association or that canal no longer contains the point.
 */
export function resolveCanalForPoint(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  preferId?: string | null,
): PlanoBajante | null {
  if (preferId) {
    const preferred = engine.bajantes.find((c) => c.id === preferId && c.tipo === 'canal');
    if (preferred && pointInCanal(engine, preferred, x, y)) return preferred;
  }
  return (
    engine.bajantes.find(
      (c) => c.tipo === 'canal' && c.net === 'll' && pointInCanal(engine, c, x, y),
    ) || null
  );
}

/** Clamps (x, y) to stay within the given canal's rectangle. */
export function clampToCanal(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
  x: number,
  y: number,
): { x: number; y: number } {
  const r = canalRect(engine, canal);
  return {
    x: Math.min(Math.max(x, r.x0), r.x1),
    y: Math.min(Math.max(y, r.y0), r.y1),
  };
}

/**
 * Resolves + clamps a rainwater bajante's candidate position in one call, and returns the
 * canal id it should now be associated with (or null if it landed outside every canal, in
 * which case it detaches). Used at bajante creation and during drag.
 */
export function resolveAndClampToCanal(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  preferId?: string | null,
): { x: number; y: number; canalId: string | null } {
  const canal = resolveCanalForPoint(engine, x, y, preferId);
  if (!canal) return { x, y, canalId: null };
  const clamped = clampToCanal(engine, canal, x, y);
  return { ...clamped, canalId: canal.id };
}

/** Canal flow-arrow zones: one per associated bajante, split at the midpoints between
 * consecutive bajantes along the canal's longer axis. Each zone contributes one arrow per
 * boundary that isn't already the bajante's own position — 1 arrow if the bajante sits at the
 * canal's own end, 2 if it's mid-body (matches: "si un bajante se hace en medio del cuerpo,
 * se deben hacer dos flechas, siempre entrando al bajante, sin dividir el canal"). */
export interface CanalFlowArrow {
  /** Plane-space start point of the arrow (tail). */
  x0: number;
  y0: number;
  /** Plane-space end point of the arrow (head — always at the bajante). */
  x1: number;
  y1: number;
}

export function computeCanalFlowArrows(
  engine: IPlanoEngineCore,
  canal: PlanoBajante,
): CanalFlowArrow[] {
  const w = engine.cmToPlanePx(canal.base || 0);
  const h = engine.cmToPlanePx(canal.altura || 0);
  // Flow runs along whichever dimension is longer — a drainage channel is drawn elongated;
  // the shorter dimension is its cross-section width, not a flow direction.
  const horizontal = w >= h;
  const axisLen = horizontal ? w : h;
  if (axisLen <= 0) return [];
  const midCross = horizontal ? canal.y + h / 2 : canal.x + w / 2;

  const assoc = engine.bajantes.filter(
    (b) => b.tipo !== 'canal' && b.net === 'll' && b.canalId === canal.id,
  );
  if (assoc.length === 0) return [];

  const toAxisPos = (b: PlanoBajante) =>
    horizontal ? (b.x - canal.x) / axisLen : (b.y - canal.y) / axisLen;
  const toPlanePoint = (t: number): { x: number; y: number } =>
    horizontal
      ? { x: canal.x + t * axisLen, y: midCross }
      : { x: midCross, y: canal.y + t * axisLen };

  const sorted = assoc
    .map((b) => ({ b, t: Math.min(1, Math.max(0, toAxisPos(b))) }))
    .sort((a, c) => a.t - c.t);

  const arrows: CanalFlowArrow[] = [];
  const EPS = 0.02;
  sorted.forEach((entry, i) => {
    const leftBoundary = i === 0 ? 0 : (sorted[i - 1].t + entry.t) / 2;
    const rightBoundary = i === sorted.length - 1 ? 1 : (entry.t + sorted[i + 1].t) / 2;
    const head = toPlanePoint(entry.t);
    if (entry.t - leftBoundary > EPS) {
      const tail = toPlanePoint(leftBoundary);
      arrows.push({ x0: tail.x, y0: tail.y, x1: head.x, y1: head.y });
    }
    if (rightBoundary - entry.t > EPS) {
      const tail = toPlanePoint(rightBoundary);
      arrows.push({ x0: tail.x, y0: tail.y, x1: head.x, y1: head.y });
    }
  });
  return arrows;
}
