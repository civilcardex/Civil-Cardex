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
  if (!engine.selId) return null;

  const zoom = engine.zoom;

  const bajante = engine.bajantes.find(b => b.id === engine.selId);
  if (bajante) {
    if (!(engine as any)._isGhostSel) {
      const c = engine.toCvs(bajante.x, bajante.y);
      const hitR = (bajante._circ?.r || Math.max(6, 6 * zoom) + 10);
      const hitOnCircle = Math.hypot(x - c.x, y - c.y) <= hitR;
      const hitOnLabel = bajante._labelBox && pointInLabelBox(x, y, bajante._labelBox);
      if (hitOnCircle || hitOnLabel) {
        return { element: bajante, isGhostClick: false, clientX, clientY };
      }
    } else {
      const ghostList = engine.getBajantesFantasma().filter(g => g.id === engine.selId);
      if (ghostList.length > 0 && ghostList[0]._ghost) {
        const gh = ghostList[0]._ghost;
        const hitOnGhost = Math.hypot(x - gh.x, y - gh.y) <= gh.r;
        const hitOnGhostLabel = ghostList[0]._ghostLabelBox && pointInLabelBox(x, y, ghostList[0]._ghostLabelBox);
        if (hitOnGhost || hitOnGhostLabel) {
          return { element: bajante, isGhostClick: true, clientX, clientY };
        }
      }
    }
    return null;
  }

  const ramal = engine.ramales.find(r => r.id === engine.selId);
  if (ramal) {
    let hitOnRamal = false;
    let ramalEndpoint: { idx: number; x: number; y: number } | null = null;

    if (ramal.pts) {
      for (const epIdx of [0, ramal.pts.length - 1]) {
        const ep = engine.toCvs(ramal.pts[epIdx][0], ramal.pts[epIdx][1]);
        if (Math.hypot(x - ep.x, y - ep.y) <= 12) {
          hitOnRamal = true;
          ramalEndpoint = { idx: epIdx, x: ramal.pts[epIdx][0], y: ramal.pts[epIdx][1] };
          break;
        }
      }

      if (!hitOnRamal) {
        for (let i = 0; i < ramal.pts.length - 1; i++) {
          const p1 = engine.toCvs(ramal.pts[i][0], ramal.pts[i][1]);
          const p2 = engine.toCvs(ramal.pts[i + 1][0], ramal.pts[i + 1][1]);
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

    const hitOnLabel = ramal._labelBox && pointInLabelBox(x, y, ramal._labelBox);
    if (hitOnRamal || hitOnLabel) {
      return { element: ramal, isGhostClick: false, ramalEndpoint, clientX, clientY };
    }
    return null;
  }

  const area = engine.areas.find(a => a.id === engine.selId);
  if (area) {
    let hitOnArea = false;
    if (area.pts) {
      const cvsPts = area.pts.map((pt: number[]) => engine.toCvs(pt[0], pt[1]));
      hitOnArea = isPointInPoly(x, y, cvsPts);
    }
    const hitOnLabel = area._labelBox && pointInLabelBox(x, y, area._labelBox);
    if (hitOnArea || hitOnLabel) {
      return { element: area, isGhostClick: false, clientX, clientY };
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