import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoEngineTypes';
import { NETS } from './PlanoState';
import { pointInPoly, pointInLabelBox, pointToSegmentDist } from './HitTester';
import { _midpoint } from './PlanoEngineDrawing';

export function selectAt(engine: IPlanoEngineCore, cx: number, cy: number): void {
  let foundTxt: PlanoTextAnnotation | null = null;
  engine.textAnnots.forEach((t: any) => {
    if (t._box) {
      const b = t._box;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) foundTxt = t;
    }
  });
  if (foundTxt) { engine.selId = (foundTxt as any).id; engine._emitSelect(foundTxt); engine.render(); return; }

  let foundBaj: PlanoBajante | null = null, minBD = 50;
  engine.bajantes.forEach((b: any) => {
    if (b._labelBox && pointInLabelBox(cx, cy, b._labelBox)) {
      const d = Math.hypot(cx - b._labelBox.cx, cy - b._labelBox.cy);
      if (d < minBD) { minBD = d; foundBaj = b; }
    }
    if (b._circ) {
      const d = Math.hypot(cx - b._circ.x, cy - b._circ.y);
      if (d < b._circ.r && d < minBD) { minBD = d; foundBaj = b; }
    }
  });
  const fg = engine.getBajantesFantasma() as any[];
  fg.forEach(b => {
    if (b._ghost) {
      const d = Math.hypot(cx - b._ghost.x, cy - b._ghost.y);
      if (d < b._ghost.r && d < minBD) { minBD = d; foundBaj = b as any; }
    }
  });
  if (foundBaj) { engine.selId = (foundBaj as any).id; engine._emitSelect(foundBaj); engine.render(); return; }

  let found: PlanoRamal | null = null, minD = 20;
  engine.ramales.forEach((r: any) => {
    if (r._labelBox && pointInLabelBox(cx, cy, r._labelBox)) {
      const d = Math.hypot(cx - r._labelBox.cx, cy - r._labelBox.cy);
      if (d < minD) { minD = d; found = r; }
    }
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, y1] = r.pts[i], [x2, y2] = r.pts[i + 1];
      const c1 = engine.toCvs(x1, y1), c2 = engine.toCvs(x2, y2);
      const d = pointToSegmentDist(cx, cy, c1.x, c1.y, c2.x, c2.y);
      if (d < minD) { minD = d; found = r; }
    }
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

export function deleteSelected(engine: IPlanoEngineCore): void {
  if (!engine.selId) return;
  const idxR = engine.ramales.findIndex((r: any) => r.id === engine.selId);
  if (idxR >= 0) {
    const deleted = engine.ramales[idxR];
    engine.ramales = engine.ramales.filter((r: any) => r.id !== deleted.id && r.padre !== deleted.id);
    engine._renumberRamales(deleted.net);
    engine.selId = null;
    engine._emitSelect(null);
    engine.render();
    engine._markDirty();
    return;
  }
  const idxB = engine.bajantes.findIndex((b: any) => b.id === engine.selId);
  if (idxB >= 0) { engine.bajantes.splice(idxB, 1); engine.selId = null; engine._emitSelect(null); engine.render(); engine._markDirty(); return; }
  const idxT = engine.textAnnots.findIndex((t: any) => t.id === engine.selId);
  if (idxT >= 0) { engine.textAnnots.splice(idxT, 1); engine.selId = null; engine._emitSelect(null); engine.render(); engine._markDirty(); return; }
  const idxA = engine.areas.findIndex((a: any) => a.id === engine.selId);
  if (idxA >= 0) { engine.areas.splice(idxA, 1); engine.selId = null; engine._emitSelect(null); engine.render(); engine._markDirty(); return; }
  const idxD = engine.dims.findIndex((d: any) => d.id === engine.selId);
  if (idxD >= 0) { engine.dims.splice(idxD, 1); engine.selId = null; engine._emitSelect(null); engine.render(); engine._markDirty(); return; }
}

export function handleSelectDown(engine: IPlanoEngineCore, x: number, y: number): void {
  const sel = getSelected(engine);

  if (sel && (sel as any)._circ && ((sel as any).tipo === 'bajante' || (sel as any).tipo === 'montante' || sel.id?.startsWith('B'))) {
    const circ = (sel as any)._circ!;
    const d = Math.hypot(x - circ.x, y - circ.y);
    if (d < circ.r) {
      engine.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
      return;
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

  if (sel && (sel as any).pts && (sel.id?.startsWith('R'))) {
    const ramalSel = sel as any;
    for (let i = 0; i < ramalSel.pts.length; i++) {
      const pc = engine.toCvs(ramalSel.pts[i][0], ramalSel.pts[i][1]);
      if (Math.hypot(x - pc.x, y - pc.y) < 10) {
        engine.ptDrag = { id: sel.id, ptIdx: i };
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
  let gFound: any = null, gMin = 16;
  fg.forEach(b => {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      if (d < b._ghost.r && d < gMin) { gMin = d; gFound = b; }
    }
  });
  if (gFound) {
    engine.ghostDrag = {
      id: (gFound as any).id,
      startX: x, startY: y,
      baseDx: (gFound as any).desplazamientos?.[engine.nivelActual?.label ?? '']?.dx || 0,
      baseDy: (gFound as any).desplazamientos?.[engine.nivelActual?.label ?? '']?.dy || 0,
    };
    return;
  }
  selectAt(engine, x, y);
}

export function handleDragMove(engine: IPlanoEngineCore, x: number, y: number): void {
  if (engine.ghostDrag) {
    const b = engine.bajantes.find((bb: any) => bb.id === engine.ghostDrag!.id);
    if (b && engine.nivelActual) {
      const dx = (x - engine.ghostDrag.startX) / engine.zoom + engine.ghostDrag.baseDx;
      const dy = (y - engine.ghostDrag.startY) / engine.zoom + engine.ghostDrag.baseDy;
      if (!(b as any).desplazamientos) (b as any).desplazamientos = {};
      (b as any).desplazamientos[engine.nivelActual.label ?? ''] = { dx, dy, Ldesvio: null };
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
      (b as any).x = p.x;
      (b as any).y = p.y;
      (b as any).labelX = ((b as any).labelX || 0) + dx;
      (b as any).labelY = ((b as any).labelY || 0) + dy;
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
      (el as any).labelX = p.x;
      (el as any).labelY = p.y;
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
      const p = engine.toPlane(x, y);
      (r as any).pts[engine.ptDrag.ptIdx] = [p.x, p.y];
      (r as any).totalL = 0;
      for (let i = 0; i < (r as any).pts.length - 1; i++) {
        (r as any).totalL += engine.pxToM(Math.hypot(
          (r as any).pts[i + 1][0] - (r as any).pts[i][0],
          (r as any).pts[i + 1][1] - (r as any).pts[i][1],
        ));
      }
      (r as any).totalL = +(r as any).totalL.toFixed(3);
      const [mx, my] = _midpoint((r as any).pts);
      (r as any).labelX = mx;
      (r as any).labelY = my;
      engine.render();
    }
    return;
  }
}

export function handleDragUp(engine: IPlanoEngineCore): void {
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
  if (engine.ptDrag) engine.ptDrag = null;
}
