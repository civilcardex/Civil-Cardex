import type { IPlanoEngineCore, PlanoElement } from './PlanoState';
import { pointInLabelBox, pointInPoly } from './HitTester';

export interface ContextMenuHitResult {
  element: PlanoElement;
  isGhostClick: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
  /** Click landed on the ramal's body (not near an existing vertex). segmentIdx/x/y describe
   *  where a new vertex would need to be inserted (between pts[segmentIdx] and pts[segmentIdx+1])
   *  if the user assigns a mid-ramal accessory there. */
  midRamalHit?: { segmentIdx: number; x: number; y: number } | null;
  clientX: number;
  clientY: number;
}

export function hitTestRightClick(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  clientX: number,
  clientY: number
): ContextMenuHitResult | null {
  const zoom = engine.zoom;

  // Check ghost bajantes first (top priority), unless overlapping a real bajante without displacement
  const fg = engine.getBajantesFantasma();
  for (const b of fg) {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      // If ghost is not displaced from its parent (same position), skip ghost detection
      // so the parent bajante can be right-clicked normally
      const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const isDisplaced = disp && (Math.abs(disp.dx) > 0.5 || Math.abs(disp.dy) > 0.5);
      if (!isDisplaced) continue;
      if (d <= b._ghost.r) {
        return { element: b, isGhostClick: true, clientX, clientY };
      }
      if (b._ghostLabelBox && pointInLabelBox(x, y, b._ghostLabelBox)) {
        return { element: b, isGhostClick: true, clientX, clientY };
      }
    }
  }

  // Check Contador (box + arrow) BEFORE ramales — both must be clickable without interference
  for (const b of engine.bajantes) {
    if (b.tipo === 'contador') {
      const c = engine.toCvs(b.x, b.y);
      const hitR = Math.max(22 * zoom, 10 * zoom + 8);
      // Box area
      if (Math.hypot(x - c.x, y - c.y) <= hitR) {
        return { element: b, isGhostClick: false, clientX, clientY };
      }
      // Arrow area below the box
      const arrowLeft = c.x - 50 * zoom;
      const arrowRight = c.x + 50 * zoom;
      const arrowTop = c.y + 10 * zoom;
      const arrowBottom = c.y + 10 * zoom + 50 * zoom;
      if (x >= arrowLeft && x <= arrowRight && y >= arrowTop && y <= arrowBottom) {
        return { element: b, isGhostClick: false, clientX, clientY };
      }
    }
  }

  // Check real bajantes (circle or label) BEFORE ramales so bajante wins when overlapping
  for (const b of engine.bajantes) {
    const c = engine.toCvs(b.x, b.y);
    const hitR = b._circ?.r || Math.max(8 * zoom, 10 * zoom);
    const hitOnCircle = Math.hypot(x - c.x, y - c.y) <= hitR;
    const hitOnLabel = b._labelBox && pointInLabelBox(x, y, b._labelBox);
    if (hitOnCircle || hitOnLabel) {
      return { element: b, isGhostClick: false, clientX, clientY };
    }
  }

  // Check ramales
  for (const r of engine.ramales) {
    let hitOnRamal = false;
    let ramalEndpoint: { idx: number; x: number; y: number } | null = null;
    let midRamalHit: { segmentIdx: number; x: number; y: number } | null = null;

    if (r.pts) {
      // Check existing mid-ramal accessory vertices first (12px radius). The segment check below
      // only reports a midRamalHit for 0.05 < t < 0.95 (to avoid colliding with endpoint hits),
      // which means a click landing right on an existing accMed vertex would otherwise never be
      // detected at all — this made editing/removing an existing mid-ramal accessory impossible.
      if (r.accMed) {
        for (const key of Object.keys(r.accMed)) {
          const m = key.match(/^accMed(\d+)$/);
          if (!m) continue;
          const idx = parseInt(m[1], 10);
          if (idx <= 0 || idx >= r.pts.length - 1) continue;
          const ep = engine.toCvs(r.pts[idx][0], r.pts[idx][1]);
          if (Math.hypot(x - ep.x, y - ep.y) <= 12) {
            hitOnRamal = true;
            midRamalHit = { segmentIdx: idx - 1, x: r.pts[idx][0], y: r.pts[idx][1] };
            break;
          }
        }
      }

      // Check endpoints first (12px radius)
      if (!hitOnRamal) {
        for (const epIdx of [0, r.pts.length - 1]) {
          const ep = engine.toCvs(r.pts[epIdx][0], r.pts[epIdx][1]);
          if (Math.hypot(x - ep.x, y - ep.y) <= 12) {
            hitOnRamal = true;
            ramalEndpoint = { idx: epIdx, x: r.pts[epIdx][0], y: r.pts[epIdx][1] };
            break;
          }
        }
      }

      // Check segments (12px distance from line)
      if (!hitOnRamal) {
        for (let i = 0; i < r.pts.length - 1; i++) {
          const p1 = engine.toCvs(r.pts[i][0], r.pts[i][1]);
          const p2 = engine.toCvs(r.pts[i + 1][0], r.pts[i + 1][1]);
          const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
          let t = l2 === 0 ? 0 : ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          const projX = p1.x + t * (p2.x - p1.x);
          const projY = p1.y + t * (p2.y - p1.y);
          if (Math.hypot(x - projX, y - projY) <= 12) {
            hitOnRamal = true;
            // Only offer a mid-ramal insertion point when it's not effectively on top of
            // one of the segment's own endpoints (those are covered by ramalEndpoint / an
            // adjacent segment's own check).
            if (t > 0.05 && t < 0.95) {
              const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1];
              midRamalHit = { segmentIdx: i, x: ax + t * (bx - ax), y: ay + t * (by - ay) };
            }
            break;
          }
        }
      }
    }

    const hitOnLabel = r._labelBox && pointInLabelBox(x, y, r._labelBox);
    if (hitOnRamal || hitOnLabel) {
      return { element: r, isGhostClick: false, ramalEndpoint, midRamalHit, clientX, clientY };
    }
  }

  // Check areas
  for (const a of engine.areas) {
    let hitOnArea = false;
    if (a.pts) {
      const cvsPts = a.pts.map((pt: number[]) => engine.toCvs(pt[0], pt[1]));
      hitOnArea = pointInPoly(x, y, cvsPts);
    }
    const hitOnLabel = a._labelBox && pointInLabelBox(x, y, a._labelBox);
    if (hitOnArea || hitOnLabel) {
      return { element: a, isGhostClick: false, clientX, clientY };
    }
  }

  return null;
}


export function hitTestBajanteLabelForDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number
): { id: string; offX: number; offY: number } | null {
  const selEl = engine.bajantes.find(b => b.id === engine.selId);
  if (selEl) {
    if (selEl._labelBox && pointInLabelBox(x, y, selEl._labelBox)) {
      const lPos = engine.toCvs(selEl.labelX ?? selEl.x, selEl.labelY ?? (selEl.y + 20));
      return { id: selEl.id, offX: x - lPos.x, offY: y - lPos.y };
    }
    if (selEl.labelX != null && selEl.labelY != null) {
      const lPos = engine.toCvs(selEl.labelX, selEl.labelY);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 40) {
        return { id: selEl.id, offX: x - lPos.x, offY: y - lPos.y };
      }
    }
    if (selEl.tipo === 'contador' || selEl.tipo === 'calentador') {
      const lx = selEl.labelX ?? (selEl.x - 25);
      const ly = selEl.labelY ?? selEl.y;
      const lPos = engine.toCvs(lx, ly);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 60) {
        return { id: selEl.id, offX: x - lPos.x, offY: y - lPos.y };
      }
    }
  }
  return null;
}
