import type { IPlanoEngineCore, PlanoBajante, MultiDragOrigData } from './PlanoState';
import { NETS, isBajante, isRamal, isTextAnnotation, isArea } from './PlanoState';
import { pointInLabelBox, pointToSegmentDist, distanceToRamal } from './HitTester';
import { getSelected } from './PlanoEngineSelection';
import { selectAt } from './PlanoEngineSelection';
import { checkActiveNet } from './PlanoState';

function _tryBajanteHit(engine: IPlanoEngineCore, x: number, y: number, sel: any): boolean {
  for (const b of engine.bajantes) {
    if (b._labelBox && pointInLabelBox(x, y, b._labelBox)) {
      if (b.net !== engine.activeNet) {
        if (!checkActiveNet(engine, b.net)) {
          const netObj = NETS.find(n => n.id === b.net);
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : b.net} en la información general`);
          return true;
        } else {
          engine.setActiveNet(b.net);
        }
      }
      if (b.id !== sel?.id) {
        engine.selId = b.id;
        engine._emitSelect(b);
        engine.render();
      }
      const lPos = engine.toCvs(b.labelX ?? b.x, b.labelY ?? (b.y + 20));
      (engine as any)._lblDragIsParent = true;
      engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
      return true;
    }
    if (b.tipo === 'contador' || b.tipo === 'calentador') {
      const lx = b.labelX ?? (b.x - 25);
      const ly = b.labelY ?? b.y;
      const lPos = engine.toCvs(lx, ly);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 50) {
        if (b.net !== engine.activeNet) {
          if (!checkActiveNet(engine, b.net)) {
            const netObj = NETS.find(n => n.id === b.net);
            engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : b.net} en la información general`);
            return true;
          } else {
            engine.setActiveNet(b.net);
          }
        }
        if (b.id !== sel?.id) {
          engine.selId = b.id;
          engine._emitSelect(b);
          engine.render();
        }
        engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
        return true;
      }
    }
    if (b._circ && Math.hypot(x - b._circ.x, y - b._circ.y) < b._circ.r) {
      if (b.net !== engine.activeNet) {
        if (!checkActiveNet(engine, b.net)) {
          const netObj = NETS.find(n => n.id === b.net);
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : b.net} en la información general`);
          return true;
        } else {
          engine.setActiveNet(b.net);
        }
      }
      if (b.id !== sel?.id) {
        engine.selId = b.id;
        engine._emitSelect(b);
        engine.render();
      }
      if (b.isFantasma) {
        // Allow parent bajante to be moved normally via bajDrag
        const assocIds = [...(b.recibeDeIds || [])];
        if (b.descargaEnId) assocIds.push(b.descargaEnId);
        const hasLockedRamal = (engine.ramales || []).some(r =>
          assocIds.includes(r.id) && r.bloqueado
        );
        if (!hasLockedRamal) {
          engine.bajDrag = { id: b.id, offX: x - b._circ.x, offY: y - b._circ.y };
        }
      } else {
        // Don't allow dragging if associated ramales are bloqueados
        const assocIds = [...(b.recibeDeIds || [])];
        if (b.descargaEnId) assocIds.push(b.descargaEnId);
        const hasLockedRamal = (engine.ramales || []).some(r =>
          assocIds.includes(r.id) && r.bloqueado
        );
        if (!hasLockedRamal) {
          engine.bajDrag = { id: b.id, offX: x - b._circ.x, offY: y - b._circ.y };
        }
      }
      return true;
    }
    if (b.labelX != null && b.labelY != null) {
      const lPos = engine.toCvs(b.labelX, b.labelY);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 30) {
        if (b.id !== sel?.id) {
          engine.selId = b.id;
          engine._emitSelect(b);
          engine.render();
        }
        (engine as any)._lblDragIsParent = true;
        engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
        return true;
      }
    }
  }
  return false;
}

function _tryRamalEndpointHit(engine: IPlanoEngineCore, x: number, y: number): boolean {
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
          const bajAtEp = engine.bajantes.find(b =>
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
  if (!bestRamal) return false;

  if (bestRamal.net !== engine.activeNet) {
    if (!checkActiveNet(engine, bestRamal.net)) {
      const netObj = NETS.find(n => n.id === bestRamal.net);
      engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : bestRamal.net} en la información general`);
      return true;
    } else {
      engine.setActiveNet(bestRamal.net);
    }
  }
  engine.selId = bestRamal.id;
  engine.multiSel = [];
  engine._emitSelect(bestRamal);
  if (bestRamal.bloqueado) {
    engine.render();
    return true;
  }

  let slideConstraint = undefined;
  {
    // Strictly same-net only — an endpoint must never slide-constrain against a segment from a
    // different red just because it happens to be visually close.
    const pt = bestRamal.pts[bestPtIdx];
    for (const other of engine.ramales) {
      if (other.id === bestRamal.id || other.net !== bestRamal.net) continue;
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

  (engine as any)._dragBackupPts = JSON.parse(JSON.stringify(bestRamal.pts));
  engine.ptDrag = { id: bestRamal.id, ptIdx: bestPtIdx, slideConstraint };
  engine.render();
  return true;
}

function _tryMultiSelDrag(engine: IPlanoEngineCore, x: number, y: number, isMultiSelectModifier: boolean): boolean {
  if (engine.multiSel.length === 0 || engine.tool !== 'sel') return false;

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
        const origData: MultiDragOrigData = {};
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
      }
      return true;
    }
  }
  return false;
}

function _trySelBajanteDrag(engine: IPlanoEngineCore, x: number, y: number, sel: any, wasGhostSel: boolean): boolean {
  if (!isBajante(sel) || !(sel.tipo === 'bajante' || sel.tipo === 'montante' || sel.tipo === 'red_publica' || sel.tipo === 'contador' || sel.tipo === 'calentador' || sel.id?.startsWith('B'))) return false;

  if (sel.net !== engine.activeNet) {
    if (!checkActiveNet(engine, sel.net)) {
      const netObj = NETS.find(n => n.id === sel.net);
      engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : sel.net} en la información general`);
      return true;
    } else {
      engine.setActiveNet(sel.net);
    }
  }
  if (sel._labelBox && pointInLabelBox(x, y, sel._labelBox)) {
    const lPos = engine.toCvs(sel.labelX, sel.labelY);
    (engine as any)._lblDragIsParent = true;
    engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
    return true;
  }
  if (sel.labelX != null && sel.labelY != null) {
    const lPos = engine.toCvs(sel.labelX, sel.labelY);
    if (Math.hypot(x - lPos.x, y - lPos.y) < 30) {
      (engine as any)._lblDragIsParent = true;
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return true;
    }
  }
  const circ = sel._circ!;
  const d = Math.hypot(x - circ.x, y - circ.y);
  if (d < circ.r) {
    if (wasGhostSel && !sel.isFantasma) {
      engine._isGhostSel = false;
      engine._emitSelect(sel);
      engine.render();
    }
      if (sel.isFantasma) {
        // Allow parent bajante to be moved normally via bajDrag
        const assocIds2 = [...(sel.recibeDeIds || [])];
        if (sel.descargaEnId) assocIds2.push(sel.descargaEnId);
        const hasLockedRamal2 = (engine.ramales || []).some(r =>
          assocIds2.includes(r.id) && r.bloqueado
        );
        if (!hasLockedRamal2) {
          engine.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
        }
      } else {
      // Don't allow dragging if associated ramales are bloqueados
      const assocIds = [...(sel.recibeDeIds || [])];
      if (sel.descargaEnId) assocIds.push(sel.descargaEnId);
      const hasLockedRamal = (engine.ramales || []).some(r =>
        assocIds.includes(r.id) && r.bloqueado
      );
      if (!hasLockedRamal) {
        engine.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
      }
    }
    return true;
  }
  return false;
}

function _trySelDimDrag(engine: IPlanoEngineCore, x: number, y: number, sel: any): boolean {
  if (!sel || sel.L === undefined || sel.x1 === undefined) return false;
  const dist = distanceToRamal(x, y, [[sel.x1, sel.y1], [sel.x2, sel.y2]], (px, py) => engine.toCvs(px, py), 2);
  if (dist < 15) {
    const tp = engine.toPlane(x, y);
    engine.dimDrag = { id: sel.id, startX: tp.x, startY: tp.y };
    return true;
  }
  return false;
}

function _trySelRamalDrag(engine: IPlanoEngineCore, x: number, y: number, sel: any): boolean {
  if (!isRamal(sel) || !sel.id?.startsWith('R') || sel.bloqueado) return false;

  for (let i = 0; i < sel.pts.length; i++) {
    const pc = engine.toCvs(sel.pts[i][0], sel.pts[i][1]);
    if (Math.hypot(x - pc.x, y - pc.y) < 15) {
      let slideConstraint = undefined;
      const isEndpoint = i === 0 || i === sel.pts.length - 1;
      // An accessory drawn mid-body (accMed) can be moved, but only sliding along the straight
      // line to its neighbors — it must not bend the ramal's actual path.
      if (!isEndpoint && sel.accMed && sel.accMed[`accMed${i}`]) {
        const a = sel.pts[i - 1], b = sel.pts[i + 1];
        (engine as any)._dragBackupPts = JSON.parse(JSON.stringify(sel.pts));
        engine.ptDrag = { id: sel.id, ptIdx: i, accMedSlide: { ax: a[0], ay: a[1], bx: b[0], by: b[1] } };
        return true;
      }
      if (isEndpoint) {
        // A connected endpoint (bajante or accessory) is NOT blocked from dragging — it goes
        // through the exact same snap-angle-constrained ptDrag path as a free endpoint (below),
        // which already propagates the move rigidly to any attached bajante/ramal. Blocking it
        // outright just pushed users onto the unconstrained body-drag path instead.
        const pt = sel.pts[i];
        for (const other of engine.ramales) {
          if (other.id === sel.id || other.net !== sel.net) continue;
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
      (engine as any)._dragBackupPts = JSON.parse(JSON.stringify(sel.pts));
      engine.ptDrag = { id: sel.id, ptIdx: i, slideConstraint };
      return true;
    }
  }
  for (let i = 0; i < sel.pts.length - 1; i++) {
    const p1 = engine.toCvs(sel.pts[i][0], sel.pts[i][1]);
    const p2 = engine.toCvs(sel.pts[i+1][0], sel.pts[i+1][1]);
    if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 6) {
      const tp = engine.toPlane(x, y);
      const origPts = sel.pts.map((pt: number[]) => [...pt] as [number, number]);
      const connBaj: { id: string; origX: number; origY: number; origLblX: number; origLblY: number; atIdx: number }[] = [];
      for (const b of engine.bajantes) {
        if (!b.recibeDeIds?.includes(sel.id)) continue;
        const startDist = Math.hypot(b.x - sel.pts[0][0], b.y - sel.pts[0][1]);
        const lastIdx = sel.pts.length - 1;
        const endDist = Math.hypot(b.x - sel.pts[lastIdx][0], b.y - sel.pts[lastIdx][1]);
        if (startDist < 0.5) {
          connBaj.push({ id: b.id, origX: b.x, origY: b.y, origLblX: b.labelX ?? b.x, origLblY: b.labelY ?? b.y, atIdx: 0 });
        } else if (endDist < 0.5) {
          connBaj.push({ id: b.id, origX: b.x, origY: b.y, origLblX: b.labelX ?? b.x, origLblY: b.labelY ?? b.y, atIdx: lastIdx });
        }
      }
      // Ramales/tributarios sharing an endpoint with this one should move together as a rigid
      // body, so the connection doesn't tear apart when dragging an unlocked ramal.
      const lastIdx = sel.pts.length - 1;
      const selStart = sel.pts[0], selEnd = sel.pts[lastIdx];
      const connRamales: { id: string; origPts: [number, number][] }[] = [];
      for (const other of engine.ramales) {
        if (other.id === sel.id || other.net !== sel.net || !other.pts?.length) continue;
        const oStart = other.pts[0], oEnd = other.pts[other.pts.length - 1];
        const touches = [oStart, oEnd].some(op =>
          Math.hypot(op[0] - selStart[0], op[1] - selStart[1]) < 0.5 ||
          Math.hypot(op[0] - selEnd[0], op[1] - selEnd[1]) < 0.5
        );
        if (touches) {
          connRamales.push({ id: other.id, origPts: other.pts.map((pt: number[]) => [...pt] as [number, number]) });
        }
      }
      engine.ramalDrag = { id: sel.id, startX: tp.x, startY: tp.y, origPts, connBaj, connRamales, origLabelX: sel.labelX, origLabelY: sel.labelY };
      return true;
    }
  }
  return false;
}

export function handleSelectDown(engine: IPlanoEngineCore, x: number, y: number, isMultiSelectModifier: boolean = false): void {
  const wasGhostSel = engine._isGhostSel;
  engine._isGhostSel = false;
  (engine as any)._lblDragIsParent = false;
  const sel = getSelected(engine);

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryBajanteHit(engine, x, y, sel)) return;
  }

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryRamalEndpointHit(engine, x, y)) return;
  }

  if (_tryMultiSelDrag(engine, x, y, isMultiSelectModifier)) return;

  if (engine.multiSel.length > 0 && !isMultiSelectModifier) {
    engine.multiSel = [];
  }

  if (_trySelBajanteDrag(engine, x, y, sel, wasGhostSel)) return;
  if (_trySelDimDrag(engine, x, y, sel)) return;
  if (_trySelRamalDrag(engine, x, y, sel)) return;

  if (sel && 'labelX' in sel && !(sel.id?.startsWith('T'))) {
    if (sel._labelBox && pointInLabelBox(x, y, sel._labelBox)) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return;
    }
    if (!(isBajante(sel) && (sel.tipo === 'bajante' || sel.tipo === 'montante' || sel.tipo === 'red_publica' || sel.tipo === 'contador' || sel.tipo === 'calentador' || sel.id?.startsWith('B')))) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 12) {
        engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
        return;
      }
    }
  }

  if (isTextAnnotation(sel) && sel._box && sel.id?.startsWith('T')) {
    const b = sel._box;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      const tp = engine.toPlane(x, y);
      engine.txtDrag = { id: sel.id, startX: tp.x, startY: tp.y, origX: sel.x, origY: sel.y };
      return;
    }
  }

  if (isArea(sel) && sel.id?.startsWith('AR') && sel._polyBox) {
    const pb = sel._polyBox;
    if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
      for (const b of engine.bajantes) {
        if (b._circ) {
          const d = Math.hypot(x - b._circ.x, y - b._circ.y);
          if (d < b._circ.r) { selectAt(engine, x, y, isMultiSelectModifier); return; }
        }
      }
      const fg = engine.getBajantesFantasma();
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
    if (t._box) {
      const b = t._box;
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
    if (a._labelBox && pointInLabelBox(x, y, a._labelBox)) {
      engine.selId = a.id;
      const lPos = engine.toCvs(a.labelX, a.labelY);
      engine.lblDrag = { id: a.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(a);
      engine.render();
      return;
    }
  }

  for (const a of engine.areas) {
    if (a._polyBox) {
      const b = a._polyBox;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        let bajAtPos = false;
        for (const bb of engine.bajantes) {
          if (bb._circ && Math.hypot(x - bb._circ.x, y - bb._circ.y) < bb._circ.r) { bajAtPos = true; break; }
        }
        if (!bajAtPos) {
          const fg = engine.getBajantesFantasma();
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
    const lPos = engine.toCvs(r.labelX, r.labelY);
    const inBox = r._labelBox && pointInLabelBox(x, y, r._labelBox);
    const nearPoint = Math.hypot(x - lPos.x, y - lPos.y) < 12;
    if (inBox || nearPoint) {
      if (r.net !== engine.activeNet) {
        if (!checkActiveNet(engine, r.net)) {
          const netObj = NETS.find(n => n.id === r.net);
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : r.net} en la información general`);
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
    const lb = b._labelBox;
    const lbHit = lb && pointInLabelBox(x, y, lb);
    const lPos = engine.toCvs(b.labelX, b.labelY);
    const nearLabel = Math.hypot(x - lPos.x, y - lPos.y) < 20;
    if (lbHit || nearLabel) {
      if (b.net !== engine.activeNet) {
        if (!checkActiveNet(engine, b.net)) {
          const netObj = NETS.find(n => n.id === b.net);
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : b.net} en la información general`);
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

  const fg = engine.getBajantesFantasma();
  let gFound: PlanoBajante | null = null, gMin = Infinity;

  for (const b of fg) {
    if (b._ghostLabelBox && pointInLabelBox(x, y, b._ghostLabelBox)) {
      if (b.net !== engine.activeNet) {
        if (!checkActiveNet(engine, b.net)) {
          const netObj = NETS.find(n => n.id === b.net);
          engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : b.net} en la información general`);
          return;
        } else {
          engine.setActiveNet(b.net);
        }
      }
      engine.selId = b.id;
      engine._isGhostSel = true;
      // The ghost always gets its own independent label position (ghostData per level) — it
      // must never be redirected to drag the parent's label instead.
      const gd = b.ghostData?.[engine.nivelActual?.label ?? ''] || {};
      let lx: number, ly: number;
      if (gd.labelX != null && gd.labelY != null) {
        lx = gd.labelX;
        ly = gd.labelY;
      } else {
        const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
        const gx = b.x + (disp ? disp.dx : 0);
        const gy = b.y + (disp ? disp.dy : 0);
        let ghostAngle = 0;
        const firstRamal = b.recibeDeIds?.length
          ? engine.ramales.find(rr => rr.id === b.recibeDeIds![0])
          : engine.ramales.find(rr => rr.pts?.length && Math.hypot(rr.pts[0][0] - gx, rr.pts[0][1] - gy) < 12);
        if (firstRamal && firstRamal.pts && firstRamal.pts.length >= 2) {
          const dx = firstRamal.pts[1][0] - firstRamal.pts[0][0];
          const dy = firstRamal.pts[1][1] - firstRamal.pts[0][1];
          if (Math.hypot(dx, dy) > 0.1) {
            ghostAngle = Math.atan2(dy, dx);
          }
        } else {
          ghostAngle = (b.labelAngle || 0) * Math.PI / 180;
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

  for (const b of fg) {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      if (d < b._ghost.r && d < gMin) { gMin = d; gFound = b as PlanoBajante; }
    }
  }
  if (gFound) {
    if (gFound.net !== engine.activeNet) {
      if (!checkActiveNet(engine, gFound.net)) {
        const netObj = NETS.find(n => n.id === gFound.net);
        engine.triggerAlert('Red inactiva', `Debe activar la red de ${netObj ? netObj.name : gFound.net} en la información general`);
        return;
      } else {
        engine.setActiveNet(gFound.net);
      }
    }
    engine.selId = gFound.id;
    engine._isGhostSel = true;
    engine._emitSelect(gFound);
    engine.render();
    engine.ghostDrag = {
      id: gFound.id,
      startX: x, startY: y,
      baseDx: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dx || 0,
      baseDy: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dy || 0,
    };
    return;
  }
  selectAt(engine, x, y, isMultiSelectModifier);
  if (engine.tool === 'sel' && !engine.ptDrag && !engine.ramalDrag && !engine.bajDrag && !engine.ghostDrag && !engine.lblDrag && !engine.txtDrag && !engine.areaDrag && !engine.dimDrag && !engine.multiDrag && !engine.selId) {
    if (!isMultiSelectModifier) {
      engine.multiSel = [];
    }
    engine.marqueeRect = { x1: x, y1: y, x2: x, y2: y };
  }
}
