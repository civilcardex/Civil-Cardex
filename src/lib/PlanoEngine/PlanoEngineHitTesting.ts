import type { IPlanoEngineCore } from './PlanoEngineTypes';
import { pointInLabelBox } from './HitTester';

export interface ContextMenuHitResult {
  element: unknown;
  isGhostClick: boolean;
  ramalEndpoint?: { idx: number; x: number; y: number } | null;
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

  // Check ghost bajantes first (top priority)
  const fg = engine.getBajantesFantasma() as any[];
  for (const b of fg) {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
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

  // Check ramales — segments should win over bajante circles
  for (const r of engine.ramales) {
    let hitOnRamal = false;
    let ramalEndpoint: { idx: number; x: number; y: number } | null = null;

    if (r.pts) {
      // Check endpoints first (12px radius)
      for (const epIdx of [0, r.pts.length - 1]) {
        const ep = engine.toCvs(r.pts[epIdx][0], r.pts[epIdx][1]);
        if (Math.hypot(x - ep.x, y - ep.y) <= 12) {
          hitOnRamal = true;
          ramalEndpoint = { idx: epIdx, x: r.pts[epIdx][0], y: r.pts[epIdx][1] };
          break;
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
            break;
          }
        }
      }
    }

    const hitOnLabel = r._labelBox && pointInLabelBox(x, y, r._labelBox);
    if (hitOnRamal || hitOnLabel) {
      return { element: r, isGhostClick: false, ramalEndpoint, clientX, clientY };
    }
  }

  // Check real bajantes (circle or label) - only if ramal didn't win
  for (const b of engine.bajantes) {
    const c = engine.toCvs(b.x, b.y);
    const hitR = b._circ?.r || Math.max(50 * zoom, 10 * zoom + 14);
    const hitOnCircle = Math.hypot(x - c.x, y - c.y) <= hitR;
    const hitOnLabel = b._labelBox && pointInLabelBox(x, y, b._labelBox);
    if (hitOnCircle || hitOnLabel) {
      const isArrowZone = b.tipo === 'contador' && y > c.y + hitR * 0.3;
      return { element: b, isGhostClick: isArrowZone, clientX, clientY };
    }
  }

  // Check areas
  for (const a of engine.areas) {
    let hitOnArea = false;
    if (a.pts) {
      const cvsPts = a.pts.map((pt: number[]) => engine.toCvs(pt[0], pt[1]));
      hitOnArea = isPointInPoly(x, y, cvsPts);
    }
    const hitOnLabel = a._labelBox && pointInLabelBox(x, y, a._labelBox);
    if (hitOnArea || hitOnLabel) {
      return { element: a, isGhostClick: false, clientX, clientY };
    }
  }

  return null;
}

function isPointInPoly(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function hitTestBajanteLabelForDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number
): { id: string; offX: number; offY: number } | null {
  const selEl = engine.bajantes.find(b => b.id === engine.selId);
  if (selEl && selEl._labelBox && pointInLabelBox(x, y, selEl._labelBox)) {
    const lPos = engine.toCvs(selEl.labelX ?? selEl.x, selEl.labelY ?? (selEl.y + 20));
    return { id: selEl.id, offX: x - lPos.x, offY: y - lPos.y };
  }
  return null;
}

export type ToolType = 'sel' | 'line' | 'dim' | 'text' | 'baj' | 'mon' | 'pan' | 'area' | 'erase' | 'segdel' | 'delm' | 'red_pub' | 'cont';

export function getToolFromKey(key: string): ToolType | null {
  const map: Record<string, ToolType> = {
    's': 'sel',
    'l': 'line',
    'd': 'dim',
    't': 'text',
    'b': 'baj',
    'm': 'mon',
    'a': 'area',
    'e': 'erase',
    'x': 'delm',
    'k': 'segdel',
  };
  return map[key] ?? null;
}

export function isPanningTool(tool: ToolType): boolean {
  return tool === 'pan';
}

export function isMiddleButton(e: MouseEvent, tool: ToolType): boolean {
  return e.button === 1 || tool === 'pan';
}

export function isRightButton(e: MouseEvent): boolean {
  return e.button === 2;
}

export function shouldStartPanning(e: MouseEvent, tool: ToolType): boolean {
  return isMiddleButton(e, tool);
}

export function getHitRadius(zoom: number): number {
  return Math.max(6, 6 * zoom) + 10;
}