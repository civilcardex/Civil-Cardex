import type { IPlanoEngineCore } from './PlanoState';
import { NETS } from './PlanoState';
import { pointInLabelBox, pointToSegmentDist, distanceToRamal } from './HitTester';
import { getSelected } from './PlanoEngineSelection';
import { selectAt } from './selectAt';
import { checkActiveNet } from './checkActiveNet';

export function handleSelectDown(engine: IPlanoEngineCore, x: number, y: number, isMultiSelectModifier: boolean = false): void {
  const wasGhostSel = engine._isGhostSel;
  engine._isGhostSel = false;
  const sel = getSelected(engine);

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    for (const b of engine.bajantes) {
      if (b._labelBox && pointInLabelBox(x, y, b._labelBox)) {
        if (b.id !== sel?.id) {
          engine.selId = b.id;
          engine._emitSelect(b);
          engine.render();
        }
        const lPos = engine.toCvs(b.labelX ?? b.x, b.labelY ?? (b.y + 20));
        engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
        return;
      }
      if (b._circ && !(b as any).isFantasma && Math.hypot(x - b._circ.x, y - b._circ.y) < b._circ.r) {
        if (b.id !== sel?.id) {
          engine.selId = b.id;
          engine._emitSelect(b);
          engine.render();
        }
        if (!(b as any).isFantasma) {
          engine.bajDrag = { id: b.id, offX: x - b._circ.x, offY: y - b._circ.y };
        }
        return;
      }
      if (b.labelX != null && b.labelY != null) {
        const lPos = engine.toCvs(b.labelX, b.labelY);
        if (Math.hypot(x - lPos.x, y - lPos.y) < 20) {
          if (b.id !== sel?.id) {
            engine.selId = b.id;
            engine._emitSelect(b);
            engine.render();
          }
          engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
          return;
        }
      }
    }
  }

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    let bestRamal = null;
    let bestPtIdx = -1;
    let minPtDist = 15;
    for (const r of engine.ramales) {
      if (engine._hiddenNets.has(r.net)) continue;
      if (r.pts && r.pts.length >= 2) {
        for (const i of [0, r.pts.length - 1]) {
          const pc = engine.toCvs(r.pts[i][0], r.pts[i][1]);
          const d = Math.hypot(x - pc.x, y - pc.y);
          if (d < minPtDist) {
            const epP = r.pts[i];
            const bajAtEp = engine.bajantes.find((b: any) =>
              Math.abs(b.x - epP[0]) < 0.1 && Math.abs(b.y - epP[1]) < 0.1
            );
            if (bajAtEp) continue;
            minPtDist = d;
            bestRamal = r;
            bestPtIdx = i;
          }
        }
      }
    }
    if (bestRamal) {
      if (bestRamal.net !== engine.activeNet) {
        if (!checkActiveNet(engine, bestRamal.net)) {
          const netObj = NETS.find((n: any) => n.id === bestRamal.net);
          const netName = netObj ? netObj.name : bestRamal.net;
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netName} en la información general`);
          return;
        } else {
          engine.setActiveNet(bestRamal.net);
        }
      }
      engine.selId = bestRamal.id;
      engine.multiSel = [];
      engine._emitSelect(bestRamal);
      
      let slideConstraint = undefined;
      if (bestRamal.net !== 'vent') {
        const pt = bestRamal.pts[bestPtIdx];
        for (const other of engine.ramales) {
          if (other.id === bestRamal.id) continue;
          for (let si = 0; si < other.pts.length - 1; si++) {
            const [ax, ay] = other.pts[si], [bx, by] = other.pts[si+1];
            const sDx = bx - ax, sDy = by - ay;
            const sLen = Math.hypot(sDx, sDy);
            if (sLen < 0.001) continue;
            const cross = Math.abs(sDx * (ay - pt[1]) - sDy * (ax - pt[0])) / sLen;
            if (cross < 0.05) {
              slideConstraint = { otherId: other.id, segmentIdx: si };
              break;
            }
          }
          if (slideConstraint) break;
        }
      }

      engine.ptDrag = { id: bestRamal.id, ptIdx: bestPtIdx, slideConstraint };
      engine.render();
      return;
    }
  }

  if (engine.multiSel.length > 0 && engine.tool === 'sel') {
    for (const id of engine.multiSel) {
      let hit = false;
      const re = engine.ramales.find(r => r.id === id);
      if (re && re.pts) {
        for (let i = 0; i < re.pts.length; i++) {
          const pc = engine.toCvs(re.pts[i][0], re.pts[i][1]);
          if (Math.hypot(x - pc.x, y - pc.y) < 12) { hit = true; break; }
        }
        if (!hit) {
          for (let i = 0; i < re.pts.length - 1; i++) {
            const p1 = engine.toCvs(re.pts[i][0], re.pts[i][1]);
            const p2 = engine.toCvs(re.pts[i+1][0], re.pts[i+1][1]);
            if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 8) { hit = true; break; }
          }
        }
        if (!hit) {
          const d = distanceToRamal(x, y, re.pts, (px, py) => engine.toCvs(px, py), engine.mm2cvs(4));
          if (d < 12) hit = true;
        }
        if (!hit && re._labelBox && pointInLabelBox(x, y, re._labelBox)) hit = true;
      }
      const be = engine.bajantes.find(b => b.id === id);
      if (!hit && be) {
        if (be._circ) hit = Math.hypot(x - be._circ.x, y - be._circ.y) < be._circ.r;
        if (!hit && be._labelBox && pointInLabelBox(x, y, be._labelBox)) hit = true;
      }
      const te = engine.textAnnots.find(t => t.id === id);
      if (!hit && te && te._box) {
        hit = x >= te._box.x && x <= te._box.x + te._box.w && y >= te._box.y && y <= te._box.y + te._box.h;
      }
      if (hit) {
        if (!isMultiSelectModifier) {
          const tp = engine.toPlane(x, y);
          const origData: Record<string, any> = {};
          for (const mid of engine.multiSel) {
            const mel = engine.ramales.find(r => r.id === mid);
            if (mel) {
              origData[mid] = { type: 'ramal', origPts: mel.pts.map(p => [...p]), origLabelX: mel.labelX, origLabelY: mel.labelY, origLabelAngle: mel.labelAngle || 0 };
              continue;
            }
            const mba = engine.bajantes.find(b => b.id === mid);
            if (mba) {
              origData[mid] = { type: 'bajante', origX: mba.x, origY: mba.y, origLabelX: mba.labelX, origLabelY: mba.labelY };
              continue;
            }
            const mtx = engine.textAnnots.find(t => t.id === mid);
            if (mtx) {
              origData[mid] = { type: 'text', origX: mtx.x, origY: mtx.y };
            }
          }
          engine.multiDrag = { startX: tp.x, startY: tp.y, origData };
          return;
        }
      }
    }
  }

  if (engine.multiSel.length > 0 && !isMultiSelectModifier) {
    engine.multiSel = [];
  }

  if (sel && (sel as any)._circ && ((sel as any).tipo === 'bajante' || (sel as any).tipo === 'montante' || (sel as any).tipo === 'red_publica' || (sel as any).tipo === 'contador' || sel.id?.startsWith('B'))) {
    if ((sel as any)._labelBox && pointInLabelBox(x, y, (sel as any)._labelBox)) {
      const lPos = engine.toCvs((sel as any).labelX, (sel as any).labelY);
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return;
    }
    if ((sel as any).labelX != null && (sel as any).labelY != null) {
      const lPos = engine.toCvs((sel as any).labelX, (sel as any).labelY);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 20) {
        engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
        return;
      }
    }
    const circ = (sel as any)._circ!;
    const d = Math.hypot(x - circ.x, y - circ.y);
    if (d < circ.r && !(sel as any).isFantasma) {
      if (wasGhostSel) {
        engine._isGhostSel = false;
        engine._emitSelect(sel);
        engine.render();
      }
      if (!(sel as any).isFantasma) {
        engine.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
      }
      return;
    }
  }

  if (sel && (sel as any).pts && (sel.id?.startsWith('R'))) {
    const ramalSel = sel as any;
    
    for (let i = 0; i < ramalSel.pts.length; i++) {
      const pc = engine.toCvs(ramalSel.pts[i][0], ramalSel.pts[i][1]);
      if (Math.hypot(x - pc.x, y - pc.y) < 15) {
        let slideConstraint = undefined;
        const isEndpoint = i === 0 || i === ramalSel.pts.length - 1;
        if (isEndpoint) {
          const pt = ramalSel.pts[i];
          for (const other of engine.ramales) {
            if (other.id === sel.id) continue;
            for (let si = 0; si < other.pts.length - 1; si++) {
              const [ax, ay] = other.pts[si], [bx, by] = other.pts[si+1];
              const sDx = bx - ax, sDy = by - ay;
              const sLen = Math.hypot(sDx, sDy);
              if (sLen < 0.001) continue;
              const cross = Math.abs(sDx * (ay - pt[1]) - sDy * (ax - pt[0])) / sLen;
              if (cross < 0.05) {
                slideConstraint = { otherId: other.id, segmentIdx: si };
                break;
              }
            }
            if (slideConstraint) break;
          }
        }
        engine.ptDrag = { id: sel.id, ptIdx: i, slideConstraint };
        return;
      }
    }
    for (let i = 0; i < ramalSel.pts.length - 1; i++) {
      const p1 = engine.toCvs(ramalSel.pts[i][0], ramalSel.pts[i][1]);
      const p2 = engine.toCvs(ramalSel.pts[i+1][0], ramalSel.pts[i+1][1]);
      if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 6) {
        const tp = engine.toPlane(x, y);
        const origPts = ramalSel.pts.map((pt: number[]) => [...pt] as [number, number]);
        const connBaj: { id: string; origX: number; origY: number; origLblX: number; origLblY: number; atIdx: number }[] = [];
        for (const b of engine.bajantes) {
          if (!b.recibeDeIds?.includes(sel.id)) continue;
          const startDist = Math.hypot(b.x - ramalSel.pts[0][0], b.y - ramalSel.pts[0][1]);
          const lastIdx = ramalSel.pts.length - 1;
          const endDist = Math.hypot(b.x - ramalSel.pts[lastIdx][0], b.y - ramalSel.pts[lastIdx][1]);
          if (startDist < 0.5) {
            connBaj.push({ id: b.id, origX: b.x, origY: b.y, origLblX: b.labelX ?? b.x, origLblY: b.labelY ?? b.y, atIdx: 0 });
          } else if (endDist < 0.5) {
            connBaj.push({ id: b.id, origX: b.x, origY: b.y, origLblX: b.labelX ?? b.x, origLblY: b.labelY ?? b.y, atIdx: lastIdx });
          }
        }
        engine.ramalDrag = { id: sel.id, startX: tp.x, startY: tp.y, origPts, connBaj };
        return;
      }
    }
  }

  if (sel && (sel as any).labelX !== undefined && !(sel.id?.startsWith('T'))) {
    if ((sel as any)._labelBox && pointInLabelBox(x, y, (sel as any)._labelBox)) {
      const lPos = engine.toCvs((sel as any).labelX, (sel as any).labelY);
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return;
    }
    if (!((sel as any).tipo === 'bajante' || (sel as any).tipo === 'montante' || (sel as any).tipo === 'red_publica' || (sel as any).tipo === 'contador' || sel.id?.startsWith('B'))) {
      const lPos = engine.toCvs((sel as any).labelX, (sel as any).labelY);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 12) {
        engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
        return;
      }
    }
  }

  if (sel && (sel as any)._box && (sel.id?.startsWith('T'))) {
    const b = (sel as any)._box!;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      const tp = engine.toPlane(x, y);
      engine.txtDrag = { id: sel.id, startX: tp.x, startY: tp.y, origX: (sel as any).x, origY: (sel as any).y };
      return;
    }
  }

  if (sel && (sel.id?.startsWith('AR')) && (sel as any)._polyBox) {
    const pb = (sel as any)._polyBox!;
    if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
      for (const b of engine.bajantes) {
        if ((b as any)._circ) {
          const d = Math.hypot(x - (b as any)._circ.x, y - (b as any)._circ.y);
          if (d < (b as any)._circ.r) { selectAt(engine, x, y, isMultiSelectModifier); return; }
        }
      }
      const fg = engine.getBajantesFantasma() as any[];
      for (const b of fg) {
        if (b._ghost) {
          const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
          if (d < b._ghost.r) { selectAt(engine, x, y, isMultiSelectModifier); return; }
        }
      }
      const tp = engine.toPlane(x, y);
      engine.areaDrag = { id: sel.id, startX: tp.x, startY: tp.y };
      return;
    }
  }

  for (const t of engine.textAnnots) {
    if ((t as any)._box) {
      const b = (t as any)._box;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        engine.selId = t.id;
        const tp = engine.toPlane(x, y);
        engine.txtDrag = { id: t.id, startX: tp.x, startY: tp.y, origX: t.x, origY: t.y };
        engine._emitSelect(t);
        engine.render();
        return;
      }
    }
  }

  for (const a of engine.areas) {
    if ((a as any)._labelBox && pointInLabelBox(x, y, (a as any)._labelBox)) {
      engine.selId = a.id;
      const lPos = engine.toCvs(a.labelX, a.labelY);
      engine.lblDrag = { id: a.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(a);
      engine.render();
      return;
    }
  }

  for (const a of engine.areas) {
    if ((a as any)._polyBox) {
      const b = (a as any)._polyBox;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        let bajAtPos = false;
        for (const bb of engine.bajantes) {
          if ((bb as any)._circ && Math.hypot(x - (bb as any)._circ.x, y - (bb as any)._circ.y) < (bb as any)._circ.r) { bajAtPos = true; break; }
        }
        if (!bajAtPos) {
          const fg = engine.getBajantesFantasma() as any[];
          for (const bb of fg) { if (bb._ghost && Math.hypot(x - bb._ghost.x, y - bb._ghost.y) < bb._ghost.r) { bajAtPos = true; break; } }
        }
        if (bajAtPos) break;
        engine.selId = a.id;
        const tp = engine.toPlane(x, y);
        engine.areaDrag = { id: a.id, startX: tp.x, startY: tp.y };
        engine._emitSelect(a);
        engine.render();
        return;
      }
    }
  }

  for (const r of engine.ramales) {
    const lPos = engine.toCvs((r as any).labelX, (r as any).labelY);
    const inBox = (r as any)._labelBox && pointInLabelBox(x, y, (r as any)._labelBox);
    const nearPoint = Math.hypot(x - lPos.x, y - lPos.y) < 12;
    if (inBox || nearPoint) {
      if (r.net !== engine.activeNet) {
        if (!checkActiveNet(engine, r.net)) {
          const netObj = NETS.find((n: any) => n.id === r.net);
          const netName = netObj ? netObj.name : r.net;
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netName} en la información general`);
          return;
        } else {
          engine.setActiveNet(r.net);
        }
      }
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  for (const b of engine.bajantes) {
    const lb = (b as any)._labelBox;
    const lbHit = lb && pointInLabelBox(x, y, lb);
    const lPos = engine.toCvs((b as any).labelX, (b as any).labelY);
    const nearLabel = Math.hypot(x - lPos.x, y - lPos.y) < 20;
    if (lbHit || nearLabel) {
      if (b.net !== engine.activeNet) {
        if (!checkActiveNet(engine, b.net)) {
          const netObj = NETS.find((n: any) => n.id === b.net);
          const netName = netObj ? netObj.name : b.net;
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netName} en la información general`);
          return;
        } else {
          engine.setActiveNet(b.net);
        }
      }
      engine.selId = b.id;
      engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(b);
      engine.render();
      return;
    }
  }

  const fg = engine.getBajantesFantasma() as any[];
  let gFound: any = null, gMin = Infinity;

  for (const b of fg) {
    if ((b as any)._ghostLabelBox && pointInLabelBox(x, y, (b as any)._ghostLabelBox)) {
      if (b.net !== engine.activeNet) {
        if (!checkActiveNet(engine, b.net)) {
          const netObj = NETS.find((n: any) => n.id === b.net);
          const netName = netObj ? netObj.name : b.net;
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netName} en la información general`);
          return;
        } else {
          engine.setActiveNet(b.net);
        }
      }
      engine.selId = b.id;
      engine._isGhostSel = true;
      const gd = (b as any).ghostData?.[engine.nivelActual?.label ?? ''] || {};
      let lx, ly;
      if (gd.labelX != null && gd.labelY != null) {
        lx = gd.labelX;
        ly = gd.labelY;
      } else {
        const disp = (b as any).desplazamientos?.[engine.nivelActual?.label ?? ''];
        const gx = (b as any).x + (disp ? disp.dx : 0);
        const gy = (b as any).y + (disp ? disp.dy : 0);
        let ghostAngle = 0;
        const firstRamal = (b as any).recibeDeIds?.length
          ? engine.ramales.find((rr: any) => rr.id === (b as any).recibeDeIds[0])
          : engine.ramales.find((rr: any) => rr.pts?.length && Math.hypot(rr.pts[0][0] - gx, rr.pts[0][1] - gy) < 12);
        if (firstRamal && firstRamal.pts && firstRamal.pts.length >= 2) {
          const dx = firstRamal.pts[1][0] - firstRamal.pts[0][0];
          const dy = firstRamal.pts[1][1] - firstRamal.pts[0][1];
          if (Math.hypot(dx, dy) > 0.1) {
            ghostAngle = Math.atan2(dy, dx);
          }
        } else {
          ghostAngle = ((b as any).labelAngle || 0) * Math.PI / 180;
        }
        const c = engine.toCvs(gx, gy);
        const distPx = engine.mm2cvs(15);
        const cLx = c.x + distPx * Math.cos(ghostAngle);
        const cLy = c.y + distPx * Math.sin(ghostAngle);
        const pL = engine.toPlane(cLx, cLy);
        lx = pL.x;
        ly = pL.y;
      }
      const lPos = engine.toCvs(lx, ly);
      engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(b);
      engine.render();
      return;
    }
  }

  fg.forEach(b => {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      if (d < b._ghost.r && d < gMin) { gMin = d; gFound = b; }
    }
  });
  if (gFound) {
    engine.selId = (gFound as any).id;
    engine._isGhostSel = true;
    engine._emitSelect(gFound);
    engine.render();
    if ((gFound as any).isFantasma) {
      engine.ghostDrag = {
        id: (gFound as any).id,
        startX: x, startY: y,
        baseDx: (gFound as any).desplazamientos?.[engine.nivelActual?.label ?? '']?.dx || 0,
        baseDy: (gFound as any).desplazamientos?.[engine.nivelActual?.label ?? '']?.dy || 0,
      };
    }
    return;
  }
  selectAt(engine, x, y, isMultiSelectModifier);
  if (engine.tool === 'sel' && !engine.ptDrag && !engine.ramalDrag && !engine.bajDrag && !engine.ghostDrag && !engine.lblDrag && !engine.txtDrag && !engine.areaDrag && !engine.multiDrag && !engine.selId) {
    if (!isMultiSelectModifier) {
      engine.multiSel = [];
    }
    engine.marqueeRect = { x1: x, y1: y, x2: x, y2: y };
  }
}
