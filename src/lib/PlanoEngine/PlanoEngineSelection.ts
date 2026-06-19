import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoEngineTypes';
import { NETS } from './PlanoState';
import { pointInPoly, pointInLabelBox, pointToSegmentDist, distanceToRamal } from './HitTester';
import { _midpoint, _firstSegmentAngle, calculateRamalLength } from './PlanoEngineDrawing';

export function selectAt(engine: IPlanoEngineCore, cx: number, cy: number): void {
  engine._isGhostSel = false;
  let foundTxt: PlanoTextAnnotation | null = null;
  engine.textAnnots.forEach((t: any) => {
    if (t._box) {
      const b = t._box;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) foundTxt = t;
    }
  });
  if (foundTxt) { engine.selId = (foundTxt as any).id; engine._emitSelect(foundTxt); engine.render(); return; }

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
  if (foundBaj) {
    engine.selId = (foundBaj as any).id;
    engine._isGhostSel = foundBajIsGhost;
    engine._emitSelect(foundBaj);
    engine.render();
    return;
  }

  let found: PlanoRamal | null = null, minD = 20;
  engine.ramales.forEach((r: any) => {
    if (r._labelBox && pointInLabelBox(cx, cy, r._labelBox)) {
      const d = Math.hypot(cx - r._labelBox.cx, cy - r._labelBox.cy);
      if (d < minD) { minD = d; found = r; }
    }
    const d = distanceToRamal(cx, cy, r.pts, (x, y) => engine.toCvs(x, y), engine.mm2cvs(3));
    if (d < minD) { minD = d; found = r; }
  });
  engine.selId = found ? (found as any).id : null;

  let foundAreaLabel: PlanoArea | null = null;
  engine.areas.forEach((a: any) => {
    if (a._labelBox && pointInLabelBox(cx, cy, a._labelBox)) {
      foundAreaLabel = a;
    }
  });
  if (foundAreaLabel) { engine.selId = (foundAreaLabel as any).id; engine._emitSelect(foundAreaLabel); engine.render(); return; }

  let foundArea: PlanoArea | null = null;
  engine.areas.forEach((a: any) => {
    if (pointInPoly(cx, cy, a.pts.map((pt: number[]) => engine.toCvs(pt[0], pt[1])))) {
      foundArea = a;
    }
  });
  if (foundArea) { engine.selId = (foundArea as any).id; engine._emitSelect(foundArea); engine.render(); return; }

  engine._emitSelect(found);
  engine.render();
}

export function selectById(engine: IPlanoEngineCore, id: string): void {
  engine._isGhostSel = false;
  const found = engine.ramales.find((r: any) => r.id === id)
    || engine.bajantes.find((b: any) => b.id === id)
    || engine.textAnnots.find((t: any) => t.id === id)
    || engine.areas.find((a: any) => a.id === id)
    || engine.dims.find((d: any) => d.id === id);
  if (found) { engine.selId = found.id; engine._emitSelect(found); engine.render(); }
}

export function getSelected(engine: IPlanoEngineCore): PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null {
  if (!engine.selId) return null;
  return (engine.ramales.find((r: any) => r.id === engine.selId)
    || engine.bajantes.find((b: any) => b.id === engine.selId)
    || engine.textAnnots.find((t: any) => t.id === engine.selId)
    || engine.areas.find((a: any) => a.id === engine.selId)
    || null) as PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | null;
}

export function updateSelected(engine: IPlanoEngineCore, fields: Record<string, unknown>): void {
  const el = getSelected(engine);
  if (el) {
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      const [mx, my] = _midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal).labelX = mx;
      (el as PlanoRamal).labelY = my;
    }
  } else {
    return;
  }
  engine.render();
  engine._markDirty();
}

export function updateElementById(engine: IPlanoEngineCore, id: string, fields: Record<string, unknown>): void {
  let el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | undefined =
    (engine.ramales.find((r: any) => r.id === id)
      || engine.bajantes.find((b: any) => b.id === id)
      || engine.textAnnots.find((t: any) => t.id === id)
      || engine.areas.find((a: any) => a.id === id)) as any;
  if (el) {
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      const [mx, my] = _midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal).labelX = mx;
      (el as PlanoRamal).labelY = my;
    }
    engine.selId = id;
  }
  engine.render();
  engine._markDirty();
}

export function rotateLabelSnap(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  const ANGLES = [0, 45, 90, -90, -45];
  if (el.id?.startsWith('T') && (el as PlanoTextAnnotation).text !== undefined) {
    const cur = (el as PlanoTextAnnotation).textAngle || 0;
    const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
    (el as PlanoTextAnnotation).textAngle = ANGLES[(idx + 1) % ANGLES.length];
  } else {
    const cur = (el as any).labelAngle || 0;
    const idx = ANGLES.reduce((b, a, i) => Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b, 0);
    (el as any).labelAngle = ANGLES[(idx + 1) % ANGLES.length];
  }
  engine._emitSelect(el);
  engine.render();
}

export function resetLabel(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  if ((el as PlanoRamal).pts) {
    const [mx, my] = _midpoint((el as PlanoRamal).pts);
    (el as any).labelX = mx;
    (el as any).labelY = my;
    (el as any).labelAngle = 0;
  } else {
    (el as any).labelX = (el as any).x;
    (el as any).labelY = (el as any).y;
    (el as any).labelAngle = 0;
  }
  engine.render();
}

export function deleteSelected(engine: IPlanoEngineCore, ids?: string[]): void {
  if (ids && ids.length > 0) {
    engine._yeeFlashKey = null;
    const netsToRenumber = new Set<string>();
    const bajNetsToRenumber = new Set<string>();
    let renumberAreas = false;
    for (const id of ids) {
      const idxR = engine.ramales.findIndex((r: any) => r.id === id);
      if (idxR >= 0) {
        const deleted = engine.ramales[idxR];
        engine.ramales = engine.ramales.filter((r: any) => r.id !== deleted.id && r.padre !== deleted.id);
        netsToRenumber.add(deleted.net);
        continue;
      }
      const idxB = engine.bajantes.findIndex((b: any) => b.id === id);
      if (idxB >= 0) {
        const deleted = engine.bajantes[idxB];
        const lvl = engine.nivelActual?.label ?? '';
        if (engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
          const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
          if (lDesvioId) {
            engine.ramales = engine.ramales.filter((r: any) => r.id !== lDesvioId);
            netsToRenumber.add(deleted.net);
          }
          delete deleted.desplazamientos[lvl];
          if (deleted.ghostData) delete deleted.ghostData[lvl];
        } else {
          engine.bajantes.splice(idxB, 1);
          if ((deleted as any).tipo === 'bajante') bajNetsToRenumber.add((deleted as any).net);
          else if ((deleted as any).tipo === 'montante') bajNetsToRenumber.add('montante');
        }
        continue;
      }
      const idxT = engine.textAnnots.findIndex((t: any) => t.id === id);
      if (idxT >= 0) { engine.textAnnots.splice(idxT, 1); continue; }
      const idxA = engine.areas.findIndex((a: any) => a.id === id);
      if (idxA >= 0) { engine.areas.splice(idxA, 1); renumberAreas = true; continue; }
      const idxD = engine.dims.findIndex((d: any) => d.id === id);
      if (idxD >= 0) { engine.dims.splice(idxD, 1); continue; }
    }
    for (const net of netsToRenumber) engine._renumberRamales(net);
    for (const net of bajNetsToRenumber) {
      if (net === 'montante') engine._renumberMontantes();
      else engine._renumberBajantes(net);
    }
    if (renumberAreas) engine._renumberAreas();
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete(ids as string[]);
    engine.render();
    engine._markDirty();
    return;
  }
  if (!engine.selId) return;
  engine._yeeFlashKey = null;
  const idxR = engine.ramales.findIndex((r: any) => r.id === engine.selId);
  if (idxR >= 0) {
    const deleted = engine.ramales[idxR];
    const deletedId = deleted.id;
    engine.ramales = engine.ramales.filter((r: any) => r.id !== deleted.id && r.padre !== deleted.id);
    engine._renumberRamales(deleted.net);
    engine.selId = null;
    engine._emitSelect(null);
    engine._emitDelete([deletedId]);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxB = engine.bajantes.findIndex((b: any) => b.id === engine.selId);
  if (idxB >= 0) { 
    const deleted = engine.bajantes[idxB];
    const deletedId = deleted.id;
    // Ghost deletion: remove ghost data + desvio ramal, keep parent bajante
    const lvl = engine.nivelActual?.label ?? '';
    if (engine._isGhostSel && deleted.desplazamientos?.[lvl]) {
      const lDesvioId = deleted.desplazamientos[lvl].Ldesvio;
      if (lDesvioId) {
        engine.ramales = engine.ramales.filter((r: any) => r.id !== lDesvioId);
        engine._renumberRamales(deleted.net);
      }
      delete deleted.desplazamientos[lvl];
      if (deleted.ghostData) delete deleted.ghostData[lvl];
      engine.selId = null; engine._isGhostSel = false; engine._emitSelect(null); engine.render(); engine._markDirty(); return;
    }
    engine.bajantes.splice(idxB, 1); 
    if ((deleted as any).tipo === 'bajante') {
      engine._renumberBajantes((deleted as any).net);
    } else if ((deleted as any).tipo === 'montante') {
      engine._renumberMontantes();
    }
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
  const idxT = engine.textAnnots.findIndex((t: any) => t.id === engine.selId);
  if (idxT >= 0) { 
    const deletedId = engine.textAnnots[idxT].id;
    engine.textAnnots.splice(idxT, 1); 
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
  const idxA = engine.areas.findIndex((a: any) => a.id === engine.selId);
  if (idxA >= 0) { 
    const deletedId = engine.areas[idxA].id;
    engine.areas.splice(idxA, 1); 
    engine._renumberAreas();
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
  const idxD = engine.dims.findIndex((d: any) => d.id === engine.selId);
  if (idxD >= 0) { 
    const deletedId = engine.dims[idxD].id;
    engine.dims.splice(idxD, 1); 
    engine.selId = null; engine._emitSelect(null); engine._emitDelete([deletedId]); engine.render(); engine._markDirty(); return; 
  }
}

export function handleSelectDown(engine: IPlanoEngineCore, x: number, y: number): void {
  const wasGhostSel = engine._isGhostSel;
  engine._isGhostSel = false;
  const sel = getSelected(engine);

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

  if (engine.multiSel.length > 0) {
    engine.multiSel = [];
  }

  if (sel && (sel as any)._circ && ((sel as any).tipo === 'bajante' || (sel as any).tipo === 'montante' || sel.id?.startsWith('B'))) {
    const circ = (sel as any)._circ!;
    const d = Math.hypot(x - circ.x, y - circ.y);
    if (d < circ.r) {
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

  // Ramal point/segment drag before label drag (points have 10px radius, label has 12px)
  if (sel && (sel as any).pts && (sel.id?.startsWith('R'))) {
    const ramalSel = sel as any;
    
    for (let i = 0; i < ramalSel.pts.length; i++) {
      const pc = engine.toCvs(ramalSel.pts[i][0], ramalSel.pts[i][1]);
      if (Math.hypot(x - pc.x, y - pc.y) < 10) {
        engine.ptDrag = { id: sel.id, ptIdx: i };
        return;
      }
    }
    // If not on a point, check if on a line segment for full branch drag
    for (let i = 0; i < ramalSel.pts.length - 1; i++) {
      const p1 = engine.toCvs(ramalSel.pts[i][0], ramalSel.pts[i][1]);
      const p2 = engine.toCvs(ramalSel.pts[i+1][0], ramalSel.pts[i+1][1]);
      if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 6) {
        const tp = engine.toPlane(x, y);
        const origPts = ramalSel.pts.map((pt: number[]) => [...pt] as [number, number]);
        // Capture connected bajantes original positions for block-move
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
    if (!((sel as any).tipo === 'bajante' || (sel as any).tipo === 'montante' || sel.id?.startsWith('B'))) {
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
          if (d < (b as any)._circ.r) { selectAt(engine, x, y); return; }
        }
      }
      const fg = engine.getBajantesFantasma() as any[];
      for (const b of fg) {
        if (b._ghost) {
          const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
          if (d < b._ghost.r) { selectAt(engine, x, y); return; }
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
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  for (const b of engine.bajantes) {
    if ((b as any)._labelBox && pointInLabelBox(x, y, (b as any)._labelBox)) {
      engine.selId = b.id;
      const lPos = engine.toCvs((b as any).labelX, (b as any).labelY);
      engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(b);
      engine.render();
      return;
    }
  }

  const fg = engine.getBajantesFantasma() as any[];
  let gFound: any = null, gMin = Infinity;

  // Check ghost label boxes first (for label drag)
  for (const b of fg) {
    if ((b as any)._ghostLabelBox && pointInLabelBox(x, y, (b as any)._ghostLabelBox)) {
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
        if (firstRamal?.pts?.length >= 2) {
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

  // Check ghost circles for ghost drag
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
  selectAt(engine, x, y);
  if (engine.tool === 'sel' && !engine.ptDrag && !engine.ramalDrag && !engine.bajDrag && !engine.ghostDrag && !engine.lblDrag && !engine.txtDrag && !engine.areaDrag && !engine.multiDrag && !engine.selId) {
    engine.multiSel = [];
    engine.marqueeRect = { x1: x, y1: y, x2: x, y2: y };
  }
}

export function handleDragMove(engine: IPlanoEngineCore, x: number, y: number): void {
  if (engine.multiDrag) {
    const tp = engine.toPlane(x, y);
    const dx = tp.x - engine.multiDrag.startX;
    const dy = tp.y - engine.multiDrag.startY;
    for (const id of Object.keys(engine.multiDrag.origData)) {
      const orig = engine.multiDrag.origData[id];
      if (!orig) continue;
      if (orig.type === 'ramal') {
        const r = engine.ramales.find(rr => rr.id === id);
        if (r) {
          r.pts = orig.origPts.map((p: number[]) => [p[0] + dx, p[1] + dy]);
          r.labelX = orig.origLabelX + dx;
          r.labelY = orig.origLabelY + dy;
          r.labelAngle = orig.origLabelAngle;
          r.totalL = calculateRamalLength(r.pts, engine);
        }
      } else if (orig.type === 'bajante') {
        const b = engine.bajantes.find(bb => bb.id === id);
        if (b) {
          b.x = orig.origX + dx;
          b.y = orig.origY + dy;
          b.labelX = orig.origLabelX + dx;
          b.labelY = orig.origLabelY + dy;
        }
      } else if (orig.type === 'text') {
        const t = engine.textAnnots.find(tt => tt.id === id);
        if (t) {
          t.x = orig.origX + dx;
          t.y = orig.origY + dy;
        }
      }
    }
    engine.render();
    return;
  }
  if (engine.ramalDrag) {
    const r = engine.ramales.find((rr: any) => rr.id === engine.ramalDrag!.id);
    if (r) {
      const tp = engine.toPlane(x, y);
      const dx = tp.x - engine.ramalDrag.startX;
      const dy = tp.y - engine.ramalDrag.startY;

      // Slide constraint: if first point lies on another ramal's segment, slide along it
      let slideDx = dx, slideDy = dy;
      for (const other of engine.ramales) {
        if (other.id === r.id) continue;
        for (let si = 0; si < other.pts.length - 1; si++) {
          const [ax, ay] = other.pts[si], [bx, by] = other.pts[si+1];
          const sDx = bx - ax, sDy = by - ay;
          const sLen = Math.hypot(sDx, sDy);
          if (sLen < 0.001) continue;
          const origFirst = engine.ramalDrag.origPts[0];
          const cross = Math.abs(sDx * (ay - origFirst[1]) - sDy * (ax - origFirst[0])) / sLen;
          if (cross < 0.05) {
            const proposedX = origFirst[0] + dx, proposedY = origFirst[1] + dy;
            let t = ((proposedX - ax) * sDx + (proposedY - ay) * sDy) / (sLen * sLen);
            t = Math.max(0, Math.min(1, t));
            slideDx = (ax + t * sDx) - origFirst[0];
            slideDy = (ay + t * sDy) - origFirst[1];
            break;
          }
        }
      }

      for (let i = 0; i < r.pts.length; i++) {
        r.pts[i][0] = engine.ramalDrag.origPts[i][0] + slideDx;
        r.pts[i][1] = engine.ramalDrag.origPts[i][1] + slideDy;
      }
      r.totalL = calculateRamalLength(r.pts, engine);
      // Block-move: update connected bajantes
      if (engine.ramalDrag.connBaj) {
        for (const cb of engine.ramalDrag.connBaj) {
          const b = engine.bajantes.find((bb: any) => bb.id === cb.id);
          if (!b) continue;
          b.x = cb.origX + slideDx;
          b.y = cb.origY + slideDy;
          b.labelX = cb.origLblX + slideDx;
          b.labelY = cb.origLblY + slideDy;
        }
      }
      engine.render();
    }
    return;
  }
  if (engine.ghostDrag) {
    const b = engine.bajantes.find((bb: any) => bb.id === engine.ghostDrag!.id);
    if (b && engine.nivelActual) {
      let dx = (x - engine.ghostDrag.startX) / engine.zoom + engine.ghostDrag.baseDx;
      let dy = (y - engine.ghostDrag.startY) / engine.zoom + engine.ghostDrag.baseDy;
      if (engine.snapMode) {
        let snappedPt = engine.snapAngle(b.x, b.y, b.x + dx, b.y + dy);
        const sp = engine.snapToExisting(snappedPt.x, snappedPt.y);
        if (sp) {
          snappedPt = sp;
        }
        dx = snappedPt.x - b.x;
        dy = snappedPt.y - b.y;
      }
      if (!(b as any).desplazamientos) (b as any).desplazamientos = {};
      const oldD = (b as any).desplazamientos[engine.nivelActual.label ?? ''];
      const oldGx = b.x + (oldD ? oldD.dx : 0);
      const oldGy = b.y + (oldD ? oldD.dy : 0);
      
      const lDesvio = oldD ? oldD.Ldesvio : null;
      (b as any).desplazamientos[engine.nivelActual.label ?? ''] = { dx, dy, Ldesvio: lDesvio };
      
      const newGx = b.x + dx;
      const newGy = b.y + dy;
      const diffGx = newGx - oldGx;
      const diffGy = newGy - oldGy;

      if (lDesvio) {
        const r = engine.ramales.find((rr: any) => rr.id === lDesvio);
        if (r) {
          r.pts[0] = [b.x, b.y];
          r.pts[r.pts.length - 1] = [newGx, newGy];
          r.totalL = calculateRamalLength(r.pts, engine);
          r.labelAngle = _firstSegmentAngle(r.pts);
          const [mx, my] = _midpoint(r.pts);
          r.labelX = mx;
          r.labelY = my;
        }
      }
      
      // Update other connected ramales to the phantom
      engine.ramales.forEach((r: any) => {
        if (r.id !== lDesvio && r.pts && r.pts.length > 0) {
          let changed = false;
          if (Math.hypot(r.pts[0][0] - oldGx, r.pts[0][1] - oldGy) < 12) {
            r.pts[0][0] += diffGx; r.pts[0][1] += diffGy; changed = true;
          }
          const lastIdx = r.pts.length - 1;
          if (Math.hypot(r.pts[lastIdx][0] - oldGx, r.pts[lastIdx][1] - oldGy) < 12) {
            r.pts[lastIdx][0] += diffGx; r.pts[lastIdx][1] += diffGy; changed = true;
          }
          if (changed) {
            r.totalL = calculateRamalLength(r.pts, engine);
            r.labelAngle = _firstSegmentAngle(r.pts);
            const [mx, my] = _midpoint(r.pts);
            r.labelX = mx;
            r.labelY = my;
          }
        }
      });
      
      engine.render();
    }
    return;
  }
  if (engine.bajDrag) {
    const b = engine.bajantes.find((bb: any) => bb.id === engine.bajDrag!.id);
    if (b) {
      const p = engine.toPlane(x - engine.bajDrag.offX, y - engine.bajDrag.offY);
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const oldX = b.x;
      const oldY = b.y;
      const desp = (b as any).desplazamientos?.[engine.nivelActual?.label ?? ''];
      const oldGx = desp ? oldX + desp.dx : oldX;
      const oldGy = desp ? oldY + desp.dy : oldY;

      (b as any).x = p.x;
      (b as any).y = p.y;
      (b as any).labelX = ((b as any).labelX || 0) + dx;
      (b as any).labelY = ((b as any).labelY || 0) + dy;
      
      // Update connected ramales via recibeDeIds
      if (b.recibeDeIds?.length) {
        b.recibeDeIds.forEach((rid: string) => {
          const r = engine.ramales.find((rr: any) => rr.id === rid);
          if (!r || !r.pts) return;
          let changed = false;
          if (Math.hypot(r.pts[0][0] - oldX, r.pts[0][1] - oldY) < 0.5) {
            r.pts[0][0] = p.x; r.pts[0][1] = p.y; changed = true;
          }
          const lastIdx = r.pts.length - 1;
          if (Math.hypot(r.pts[lastIdx][0] - oldX, r.pts[lastIdx][1] - oldY) < 0.5) {
            r.pts[lastIdx][0] = p.x; r.pts[lastIdx][1] = p.y; changed = true;
          }
          if (changed) {
            r.totalL = calculateRamalLength(r.pts, engine);
            r.labelAngle = _firstSegmentAngle(r.pts);
            const [mx, my] = _midpoint(r.pts);
            r.labelX = mx;
            r.labelY = my;
          }
        });
      }
      
      engine.render();
    }
    return;
  }
  if (engine.lblDrag) {
    const el = engine.ramales.find((r: any) => r.id === engine.lblDrag!.id)
      || engine.bajantes.find((b: any) => b.id === engine.lblDrag!.id)
      || engine.areas.find((a: any) => a.id === engine.lblDrag!.id);
    if (el) {
      const p = engine.toPlane(x - engine.lblDrag.offX, y - engine.lblDrag.offY);
      // Check if it's a ghost — write to ghostData instead of labelX/labelY
      const isGhost = engine.getBajantesFantasma().some((g: any) => g.id === el.id);
      if (isGhost && engine.nivelActual) {
        const lbl = engine.nivelActual.label ?? '';
        if (!(el as any).ghostData) (el as any).ghostData = {};
        if (!(el as any).ghostData[lbl]) (el as any).ghostData[lbl] = {};
        (el as any).ghostData[lbl].labelX = p.x;
        (el as any).ghostData[lbl].labelY = p.y;
      } else {
        (el as any).labelX = p.x;
        (el as any).labelY = p.y;
      }
      engine.render();
    }
    return;
  }
  if (engine.txtDrag) {
    const t = engine.textAnnots.find((tt: any) => tt.id === engine.txtDrag!.id);
    if (t) {
      const p = engine.toPlane(x, y);
      (t as any).x = engine.txtDrag.origX + (p.x - engine.txtDrag.startX);
      (t as any).y = engine.txtDrag.origY + (p.y - engine.txtDrag.startY);
      engine.render();
    }
    return;
  }
  if (engine.areaDrag) {
    const a = engine.areas.find((aa: any) => aa.id === engine.areaDrag!.id);
    if (a) {
      const p = engine.toPlane(x, y);
      const dx = p.x - engine.areaDrag.startX;
      const dy = p.y - engine.areaDrag.startY;
      (a as any).pts.forEach((pt: number[]) => { pt[0] += dx; pt[1] += dy; });
      if ((a as any).labelX !== undefined) { (a as any).labelX += dx; (a as any).labelY += dy; }
      engine.areaDrag.startX = p.x;
      engine.areaDrag.startY = p.y;
      engine.render();
    }
    return;
  }
  if (engine.ptDrag) {
    const r = engine.ramales.find((rr: any) => rr.id === engine.ptDrag!.id);
    if (r) {
      let p = engine.toPlane(x, y);
      const idx = engine.ptDrag.ptIdx;
      const isEndpoint = idx === 0 || idx === r.pts.length - 1;

      // SLIDE CONSTRAINT: if dragging endpoint that lies on another ramal's segment
      if (isEndpoint) {
        const origPt = r.pts[idx];
        for (const other of engine.ramales) {
          if (other.id === r.id) continue;
          for (let si = 0; si < other.pts.length - 1; si++) {
            const [ax, ay] = other.pts[si], [bx, by] = other.pts[si+1];
            const sDx = bx - ax, sDy = by - ay;
            const sLen = Math.hypot(sDx, sDy);
            if (sLen < 0.001) continue;
            const cross = Math.abs(sDx * (ay - origPt[1]) - sDy * (ax - origPt[0])) / sLen;
            if (cross < 0.05) {
              let t = ((p.x - ax) * sDx + (p.y - ay) * sDy) / (sLen * sLen);
              t = Math.max(0, Math.min(1, t));
              p.x = ax + t * sDx;
              p.y = ay + t * sDy;
              break;
            }
          }
        }
      }

      if (engine.snapMode) {
        if (idx === 0 && r.pts.length > 1) {
          p = engine.snapAngle(r.pts[1][0], r.pts[1][1], p.x, p.y);
        } else if (idx > 0) {
          p = engine.snapAngle(r.pts[idx - 1][0], r.pts[idx - 1][1], p.x, p.y);
        }
      }

      const oldP = [...(r as any).pts[idx]];
      (r as any).pts[idx] = [p.x, p.y];

      // GROUP MOVE: at junctions, move all connected ramales sharing this point
      if (isEndpoint) {
        const dPx = p.x - oldP[0], dPy = p.y - oldP[1];
        if (Math.abs(dPx) + Math.abs(dPy) > 0.001) {
          for (const other of engine.ramales) {
            if (other.id === r.id) continue;
            let changed = false;
            if (Math.hypot(other.pts[0][0] - oldP[0], other.pts[0][1] - oldP[1]) < 0.5) {
              other.pts[0][0] += dPx; other.pts[0][1] += dPy; changed = true;
            }
            const last = other.pts.length - 1;
            if (last > 0 && Math.hypot(other.pts[last][0] - oldP[0], other.pts[last][1] - oldP[1]) < 0.5) {
              other.pts[last][0] += dPx; other.pts[last][1] += dPy; changed = true;
            }
            if (changed) {
              other.totalL = calculateRamalLength(other.pts, engine);
              other.labelAngle = _firstSegmentAngle(other.pts);
              const [mx, my] = _midpoint(other.pts);
              other.labelX = mx;
              other.labelY = my;
            }
          }
          // Also move bajante if this ramal is in recibeDeIds
          const bajForRamal = engine.bajantes.find((b: any) =>
            b.recibeDeIds?.includes(r.id) &&
            (Math.hypot(oldP[0] - b.x, oldP[1] - b.y) < 0.5 ||
             Math.hypot(p.x - b.x, p.y - b.y) < 0.5)
          );
          if (bajForRamal) {
            bajForRamal.x += dPx;
            bajForRamal.y += dPy;
            bajForRamal.labelX = (bajForRamal.labelX || 0) + dPx;
            bajForRamal.labelY = (bajForRamal.labelY || 0) + dPy;
          }
        }
      }

      (r as any).labelAngle = _firstSegmentAngle((r as any).pts);
      (r as any).totalL = calculateRamalLength((r as any).pts, engine);
      const [mx, my] = _midpoint((r as any).pts);
      (r as any).labelX = mx;
      (r as any).labelY = my;
      engine.render();
    }
    return;
  }
}

export function handleDragUp(engine: IPlanoEngineCore): void {
  if (engine.marqueeRect) {
    const { x1, y1, x2, y2 } = engine.marqueeRect;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const w = maxX - minX, h = maxY - minY;
    engine.marqueeRect = null;
    if (w < 3 && h < 3) {
      engine.multiSel = [];
      engine.selId = null;
      engine._emitSelect(null);
    } else {
      engine.multiSel = [];
      engine.ramales.forEach(r => {
        let inside = false;
        const lc = engine.toCvs(r.labelX || 0, r.labelY || 0);
        if (lc.x >= minX && lc.x <= maxX && lc.y >= minY && lc.y <= maxY) inside = true;
        if (!inside) {
          for (const pt of r.pts) {
            const c = engine.toCvs(pt[0], pt[1]);
            if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) { inside = true; break; }
          }
        }
        if (!inside && r.pts.length >= 2) {
          for (let i = 0; i < r.pts.length - 1; i++) {
            const p1 = engine.toCvs(r.pts[i][0], r.pts[i][1]);
            const p2 = engine.toCvs(r.pts[i+1][0], r.pts[i+1][1]);
            let t0 = 0, t1 = 1;
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const p = [-dx, dx, -dy, dy];
            const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];
            let ok = true;
            for (let k = 0; k < 4; k++) {
              if (p[k] === 0) { if (q[k] < 0) { ok = false; break; } }
              else { const t = q[k] / p[k]; if (p[k] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) { ok = false; break; } }
            }
            if (ok) { inside = true; break; }
          }
        }
        if (inside) engine.multiSel.push(r.id);
      });
      engine.bajantes.forEach(b => {
        const c = engine.toCvs(b.x, b.y);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) engine.multiSel.push(b.id);
      });
      engine.textAnnots.forEach(t => {
        const c = engine.toCvs(t.x, t.y);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) engine.multiSel.push(t.id);
      });
      engine.selId = null;
      engine._emitSelect(null);
    }
    engine.render();
    return;
  }
  if (engine.multiDrag) { engine.multiDrag = null; engine._markDirty(); engine.render(); }
  if (engine.ghostDrag) {
    const b = engine.bajantes.find((bb: any) => bb.id === engine.ghostDrag!.id);
    if (b && engine.nivelActual && (b as any).desplazamientos?.[engine.nivelActual.label ?? '']) {
      const d = (b as any).desplazamientos[engine.nivelActual.label ?? ''];
      if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) {
        delete (b as any).desplazamientos[engine.nivelActual.label ?? ''];
      } else {
        const oldLdesvio = d.Ldesvio;
        if (!oldLdesvio) {
          const net = NETS.find(n => n.id === (b as any).net);
          const pfx = net ? net.lbl : 'R';
          const cnt = ++(engine._netCounts[(b as any).net].ramal);
          const ramId = pfx + cnt;
          const diam = (b as any).dNominal || '0';
          const ramal: PlanoRamal = {
            id: ramId,
            net: (b as any).net,
            tipo: 'ramal',
            padre: null,
            pts: [[b.x, b.y], [b.x + d.dx, b.y + d.dy]],
            totalL: +(engine.pxToM(Math.hypot(d.dx, d.dy))).toFixed(3),
            label: pfx + cnt,
            ini: '',
            fin: '',
            piso: engine.nivelActual?.n ?? '',
            dz: '',
            uc: 0,
            labelX: (b.x + b.x + d.dx) / 2,
            labelY: (b.y + b.y + d.dy) / 2,
            labelAngle: 0,
            material: '',
            diametro: diam !== '0' ? diam : '',
            pendiente: 1.5,
          };
          engine.ramales.push(ramal);
          d.Ldesvio = ramId;
          engine._emitStatus(`Desplazamiento conectado: ${ramId}`);
        }
      }
    }
    engine.ghostDrag = null;
    engine.render();
    engine._markDirty();
  }
  if (engine.lblDrag) engine.lblDrag = null;
  if (engine.txtDrag) engine.txtDrag = null;
  if (engine.bajDrag) engine.bajDrag = null;
  if (engine.areaDrag) engine.areaDrag = null;
  if (engine.ptDrag) { engine.ptDrag = null; engine._markDirty(); }
  if (engine.ramalDrag) {
    engine.ramalDrag = null;
    engine._markDirty();
  }
}
