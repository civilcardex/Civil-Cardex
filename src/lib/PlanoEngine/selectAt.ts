import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoEngineTypes';
import { NETS } from './PlanoState';
import { pointInPoly, pointInLabelBox, distanceToRamal } from './HitTester';
import { checkActiveNet } from './checkActiveNet';

export function selectAt(engine: IPlanoEngineCore, cx: number, cy: number, isMultiSelectModifier: boolean = false): void {
  engine._isGhostSel = false;
  
  const applySelection = (id: string | null, obj: any | null, isGhost: boolean = false) => {
    engine._isGhostSel = isGhost;
    if (isMultiSelectModifier) {
      if (engine.selId && !engine.multiSel.includes(engine.selId)) {
        engine.multiSel.push(engine.selId);
      }
      engine.selId = null;
      if (id) {
        if (engine.multiSel.includes(id)) {
          engine.multiSel = engine.multiSel.filter(mid => mid !== id);
        } else {
          engine.multiSel.push(id);
        }
      }
      engine._emitSelect(null);
    } else {
      engine.selId = id;
      engine.multiSel = [];
      engine._emitSelect(obj);
    }
    engine.render();
  };

  let foundTxt: PlanoTextAnnotation | null = null;
  engine.textAnnots.forEach((t: any) => {
    if (t._box) {
      const b = t._box;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) foundTxt = t;
    }
  });
  if (foundTxt) return applySelection((foundTxt as any).id, foundTxt);

  let foundBaj: PlanoBajante | null = null, minBD = 50;
  let foundBajIsGhost = false;
  engine.bajantes.forEach((b: any) => {
    if (b._labelBox && pointInLabelBox(cx, cy, b._labelBox)) {
      const d = Math.hypot(cx - b._labelBox.cx, cy - b._labelBox.cy);
      if (d < minBD) { minBD = d; foundBaj = b; foundBajIsGhost = false; }
    }
    if (b._circ) {
      const d = Math.hypot(cx - b._circ.x, cy - b._circ.y);
      if (d < b._circ.r && d < minBD) { minBD = d; foundBaj = b; foundBajIsGhost = false; }
    }
  });
  const fg = engine.getBajantesFantasma() as any[];
  fg.forEach(b => {
    if (b._ghost) {
      const d = Math.hypot(cx - b._ghost.x, cy - b._ghost.y);
      if (d < b._ghost.r && d < minBD) { minBD = d; foundBaj = b as any; foundBajIsGhost = true; }
    }
  });
  const checkAndSwitchNet = (obj: any): boolean => {
    if (!obj || !obj.net) return true;
    if (obj.net !== engine.activeNet) {
      if (!checkActiveNet(engine, obj.net)) {
        const netObj = NETS.find((n: any) => n.id === obj.net);
        const netName = netObj ? netObj.name : obj.net;
        engine.triggerAlert('Red inactiva', `Debe activar la red de ${netName} en la información general`);
        return false;
      } else {
        engine.setActiveNet(obj.net);
      }
    }
    return true;
  };

  if (foundBaj) {
    if (!checkAndSwitchNet(foundBaj)) return;
    return applySelection((foundBaj as any).id, foundBaj, foundBajIsGhost);
  }

  let found: PlanoRamal | null = null, minD = 20;
  engine.ramales.forEach((r: any) => {
    if (r._labelBox && pointInLabelBox(cx, cy, r._labelBox)) {
      const d = Math.hypot(cx - r._labelBox.cx, cy - r._labelBox.cy);
      if (d < minD) { minD = d; found = r; }
    }
    let d = distanceToRamal(cx, cy, r.pts, (x, y) => engine.toCvs(x, y), engine.mm2cvs(3));
    if (r.pts && r.pts.length > 0) {
      const pc1 = engine.toCvs(r.pts[0][0], r.pts[0][1]);
      const pc2 = engine.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
      if (Math.hypot(cx - pc1.x, cy - pc1.y) < 15 || Math.hypot(cx - pc2.x, cy - pc2.y) < 15) {
        d -= 5;
      }
    }
    if (d < minD) { minD = d; found = r; }
  });

  let foundAreaLabel: PlanoArea | null = null;
  engine.areas.forEach((a: any) => {
    if (a._labelBox && pointInLabelBox(cx, cy, a._labelBox)) {
      foundAreaLabel = a;
    }
  });
  if (foundAreaLabel) {
    if (!checkAndSwitchNet(foundAreaLabel)) return;
    return applySelection((foundAreaLabel as any).id, foundAreaLabel);
  }

  let foundArea: PlanoArea | null = null;
  engine.areas.forEach((a: any) => {
    if (pointInPoly(cx, cy, a.pts.map((pt: number[]) => engine.toCvs(pt[0], pt[1])))) {
      foundArea = a;
    }
  });
  if (foundArea) {
    if (!checkAndSwitchNet(foundArea)) return;
    return applySelection((foundArea as any).id, foundArea);
  }

  if (found) {
    if (!checkAndSwitchNet(found)) return;
  }

  applySelection(found ? (found as any).id : null, found);
}
