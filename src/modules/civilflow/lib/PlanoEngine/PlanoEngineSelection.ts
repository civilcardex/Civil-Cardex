import type {
  PlanoRamal,
  PlanoBajante,
  PlanoArea,
  PlanoTextAnnotation,
  PlanoDimension,
  PlanoGuideLine,
  PlanoElement,
} from './PlanoState';
import type { IPlanoEngineCore } from './PlanoState';
import { NETS, checkActiveNet } from './PlanoState';
import { _midpoint } from './PlanoEngineDrawing';
import { diamPulgFromLabel } from '../../utils/diamPulgFromLabel';
import { pointInPoly, pointInLabelBox, distanceToRamal, findAccMedVertexHit } from './HitTester';
import { updateCrossFloorGhostFieldBySource } from '../../utils/associateBajanteAcrossFloors';

export function selectAt(
  engine: IPlanoEngineCore,
  cx: number,
  cy: number,
  isMultiSelectModifier: boolean = false,
): void {
  engine._isGhostSel = false;

  const applySelection = (
    id: string | null,
    obj: PlanoElement | null,
    isGhost: boolean = false,
  ) => {
    engine._isGhostSel = isGhost;
    if (isMultiSelectModifier) {
      if (engine.selId && !engine.multiSel.includes(engine.selId)) {
        engine.multiSel.push(engine.selId);
      }
      engine.selId = null;
      if (id) {
        if (engine.multiSel.includes(id)) {
          engine.multiSel = engine.multiSel.filter((mid) => mid !== id);
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
  for (const t of engine.textAnnots) {
    if (t._box) {
      const b = t._box;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h)
        foundTxt = t as PlanoTextAnnotation;
    }
  }
  if (foundTxt) return applySelection(foundTxt.id, foundTxt);

  let foundBaj: PlanoBajante | null = null,
    minBD = 50;
  let foundBajIsGhost = false;
  for (const b of engine.bajantes) {
    if (b._labelBox && pointInLabelBox(cx, cy, b._labelBox)) {
      const d = Math.hypot(cx - b._labelBox.cx, cy - b._labelBox.cy);
      if (d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = false;
      }
    }
    if (b._circ) {
      const d = Math.hypot(cx - b._circ.x, cy - b._circ.y);
      if (d < b._circ.r && d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = false;
      }
    }
  }
  const fg = engine.getBajantesFantasma();
  for (const b of fg) {
    if (b._ghostLabelBox && pointInLabelBox(cx, cy, b._ghostLabelBox)) {
      const d = Math.hypot(cx - b._ghostLabelBox.cx, cy - b._ghostLabelBox.cy);
      if (d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = true;
      }
    }
    if (b._ghost) {
      const d = Math.hypot(cx - b._ghost.x, cy - b._ghost.y);
      if (d < b._ghost.r && d < minBD) {
        minBD = d;
        foundBaj = b as PlanoBajante;
        foundBajIsGhost = true;
      }
    }
  }
  const checkAndSwitchNet = (obj: { net?: string }): boolean => {
    if (!obj || !obj.net) return true;
    if (obj.net !== engine.activeNet) {
      if (!checkActiveNet(engine, obj.net)) {
        const netObj = NETS.find((n) => n.id === obj.net);
        const netName = netObj ? netObj.name : obj.net;
        engine.triggerAlert(
          'Red inactiva',
          `Debe activar la red de ${netName} en la información general`,
        );
        return false;
      } else {
        engine.setActiveNet(obj.net);
      }
    }
    return true;
  };

  if (foundBaj) {
    if (!checkAndSwitchNet(foundBaj)) return;
    return applySelection(foundBaj.id, foundBaj, foundBajIsGhost);
  }

  let foundDim: PlanoDimension | null = null,
    minDimD = 20;
  for (const d of engine.dims) {
    // A click ON the dimension's label must also select the dimension — otherwise the user can't
    // pre-select a dim to drag its label (the only way _trySelDimDrag's label-radius starts to
    // apply is if sel === the dim itself, which only happens after selectAt picks it).
    const distLine = distanceToRamal(
      cx,
      cy,
      [
        [d.x1, d.y1],
        [d.x2, d.y2],
      ],
      (x, y) => engine.toCvs(x, y),
      2,
    );
    let hitD = distLine;
    if (d._labelPos) {
      // d._labelPos is already in canvas coords (see renderDimensions.ts:59 where lx/ly were
      // produced by toCvs). Calling toCvs a second time would double-transform. Use directly.
      const labelDist = Math.hypot(cx - d._labelPos.x, cy - d._labelPos.y);
      // Treat the label hit as a stronger preference than a near-line hit — clicking the small
      // numeric bubble is intentional and the label takes up real screen space; the line is
      // only 2px wide and rarely what the user meant.
      hitD = labelDist < 22 ? -1 : distLine;
    }
    if (hitD < minDimD) {
      minDimD = hitD;
      foundDim = d as PlanoDimension;
    }
  }
  if (foundDim) {
    return applySelection(foundDim.id, foundDim);
  }

  let foundGuide: PlanoGuideLine | null = null,
    minGuideD = 15;
  for (const g of engine.guideLines) {
    const d = distanceToRamal(cx, cy, g.pts, (x, y) => engine.toCvs(x, y), engine.mm2cvs(2));
    if (d < minGuideD) {
      minGuideD = d;
      foundGuide = g;
    }
  }
  if (foundGuide) {
    return applySelection(foundGuide.id, foundGuide);
  }

  let found: PlanoRamal | null = null,
    minD = 20;
  for (const r of engine.ramales) {
    if (r._labelBox && pointInLabelBox(cx, cy, r._labelBox)) {
      const d = Math.hypot(cx - r._labelBox.cx, cy - r._labelBox.cy);
      if (d < minD) {
        minD = d;
        found = r as PlanoRamal;
      }
    }
    // The generous accessory-icon radius below is meant for a REAL accessory glyph that sticks
    // out visibly from the pipe and needs an easy-to-hit target. 'teeBilateral' is just a tiny
    // black '+' drawn exactly ON the crossing point (renderRamales.ts) — giving it the same big
    // radius made whichever of the two crossing ramales happened to carry that accMed entry win
    // essentially every click anywhere near the crossing, even ones clearly closer to the OTHER
    // (perpendicular) ramal's own line. Skip it here so the normal per-ramal line-distance
    // competition below decides fairly between the two.
    const accMedHitIdx = findAccMedVertexHit(
      r.pts,
      r.accMed,
      (x, y) => engine.toCvs(x, y),
      cx,
      cy,
      engine.realMmToCanvasPx(23) * 0.6 + 8,
    );
    if (accMedHitIdx !== null && r.accMed?.[`accMed${accMedHitIdx}`] !== 'teeBilateral') {
      if (0.01 < minD) {
        minD = 0.01;
        found = r as PlanoRamal;
      }
    }
    let d = distanceToRamal(cx, cy, r.pts, (x, y) => engine.toCvs(x, y), engine.mm2cvs(3));
    if (r.pts && r.pts.length > 0) {
      const pc1 = engine.toCvs(r.pts[0][0], r.pts[0][1]);
      const pc2 = engine.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
      if (Math.hypot(cx - pc1.x, cy - pc1.y) < 15 || Math.hypot(cx - pc2.x, cy - pc2.y) < 15) {
        d -= 5;
      }
    }
    if (d < minD) {
      minD = d;
      found = r as PlanoRamal;
    }
  }

  let foundAreaLabel: PlanoArea | null = null;
  for (const a of engine.areas) {
    if (a._labelBox && pointInLabelBox(cx, cy, a._labelBox)) {
      foundAreaLabel = a as PlanoArea;
    }
  }
  if (foundAreaLabel) {
    if (!checkAndSwitchNet(foundAreaLabel)) return;
    return applySelection(foundAreaLabel.id, foundAreaLabel);
  }

  let foundArea: PlanoArea | null = null;
  for (const a of engine.areas) {
    if (
      pointInPoly(
        cx,
        cy,
        a.pts.map((pt) => engine.toCvs(pt[0], pt[1])),
      )
    ) {
      foundArea = a as PlanoArea;
    }
  }
  if (foundArea) {
    if (!checkAndSwitchNet(foundArea)) return;
    return applySelection(foundArea.id, foundArea);
  }

  if (found) {
    if (!checkAndSwitchNet(found)) return;
  }

  applySelection(found ? found.id : null, found);
}
export { deleteSelected } from './deleteSelected';
export { handleSelectDown } from './handleMouseDown';
export { handleDragMove } from './handleDragMove';
export { handleDragUp } from './handleDragUp';

export function selectById(engine: IPlanoEngineCore, id: string): void {
  engine._isGhostSel = false;
  const found =
    engine.ramales.find((r) => r.id === id) ||
    engine.bajantes.find((b) => b.id === id) ||
    engine.textAnnots.find((t) => t.id === id) ||
    engine.areas.find((a) => a.id === id) ||
    engine.dims.find((d) => d.id === id) ||
    engine.guideLines.find((g) => g.id === id);
  if (found) {
    engine.selId = found.id;
    engine._emitSelect(found);
    engine.render();
  }
}

export function getSelected(
  engine: IPlanoEngineCore,
):
  | PlanoRamal
  | PlanoBajante
  | PlanoTextAnnotation
  | PlanoArea
  | PlanoDimension
  | PlanoGuideLine
  | null {
  if (!engine.selId) return null;
  // Dimensions were missing here even though selectAt()/selectById() both select them fine —
  // sel came back null on every click after the first, so _trySelDimDrag's isDimension(sel)
  // check never passed and neither the line nor its label could ever be dragged.
  return (engine.ramales.find((r) => r.id === engine.selId) ||
    engine.bajantes.find((b) => b.id === engine.selId) ||
    engine.textAnnots.find((t) => t.id === engine.selId) ||
    engine.areas.find((a) => a.id === engine.selId) ||
    engine.dims.find((d) => d.id === engine.selId) ||
    engine.guideLines.find((g) => g.id === engine.selId) ||
    null) as
    | PlanoRamal
    | PlanoBajante
    | PlanoTextAnnotation
    | PlanoArea
    | PlanoDimension
    | PlanoGuideLine
    | null;
}

function checkVentDiameterLimits(
  engine: IPlanoEngineCore,
  el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | PlanoDimension | PlanoGuideLine,
  fields: Record<string, unknown>,
): boolean {
  if (!el || !fields) return true;
  if (!('tipo' in el)) return true; // text annotations / areas never trigger vent-diameter checks

  const getConnectedVentRamales = (b: PlanoBajante) => {
    const ventRamales = engine.ramales.filter((r) => r.net === 'vent');
    const connected: PlanoRamal[] = [];
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const bx = b.x + (disp ? disp.dx : 0);
    const by = b.y + (disp ? disp.dy : 0);
    for (const vr of ventRamales) {
      const isExplicit =
        b.recibeDeIds &&
        (b.recibeDeIds.includes(vr.id) || (vr.label && b.recibeDeIds.includes(vr.label)));
      let isConnected = isExplicit;
      if (!isConnected && vr.pts && vr.pts.length >= 2) {
        const d1 = Math.hypot(vr.pts[0][0] - bx, vr.pts[0][1] - by);
        const d2 = Math.hypot(vr.pts[vr.pts.length - 1][0] - bx, vr.pts[vr.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vr);
    }
    return connected;
  };

  const getConnectedVentBajantes = (r: PlanoRamal) => {
    const ventBajantes = engine.bajantes.filter((b) => b.net === 'vent');
    const connected: PlanoBajante[] = [];
    for (const vb of ventBajantes) {
      const disp = vb.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bx = vb.x + (disp ? disp.dx : 0);
      const by = vb.y + (disp ? disp.dy : 0);
      const isExplicit =
        vb.recibeDeIds &&
        (vb.recibeDeIds.includes(r.id) || (r.label && vb.recibeDeIds.includes(r.label)));
      let isConnected = isExplicit;
      if (!isConnected && r.pts && r.pts.length >= 2) {
        const d1 = Math.hypot(r.pts[0][0] - bx, r.pts[0][1] - by);
        const d2 = Math.hypot(r.pts[r.pts.length - 1][0] - bx, r.pts[r.pts.length - 1][1] - by);
        if (d1 < 2.0 || d2 < 2.0) isConnected = true;
      }
      if (isConnected) connected.push(vb);
    }
    return connected;
  };

  const isVent = el.net === 'vent' || ('_net' in el && el._net === 'vent');
  if (isVent) {
    if (el.tipo === 'bajante' || el.tipo === 'montante') {
      let newDNom = '';
      if (fields.dNominal !== undefined) {
        newDNom = String(fields.dNominal || '');
      } else if (fields.ghostData !== undefined) {
        const lvl = engine.nivelActual?.label ?? '';
        const gd =
          (fields.ghostData as Record<string, { dNominal?: string; d_nominal?: string }>)[lvl] ||
          {};
        newDNom = String(gd.dNominal || gd.d_nominal || '');
      }
      if (newDNom) {
        const bDVal = diamPulgFromLabel(newDNom);
        if (bDVal > 0) {
          const connected = getConnectedVentRamales(el as PlanoBajante);
          for (const vr of connected) {
            const rDVal = vr.diamPulg || diamPulgFromLabel(vr.diametro);
            if (rDVal > 0 && bDVal < rDVal) {
              engine.triggerAlert(
                'Diámetro no válido',
                `El diámetro del bajante de ventilación (${newDNom}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${vr.diametro || vr.id}).`,
              );
              if (fields.dNominal !== undefined) {
                fields.dNominal = '';
              } else if (fields.ghostData !== undefined) {
                const lvl = engine.nivelActual?.label ?? '';
                const gd =
                  (fields.ghostData as Record<string, { dNominal?: string; d_nominal?: string }>)[
                    lvl
                  ] || {};
                gd.dNominal = '';
                gd.d_nominal = '';
              }
              return true;
            }
          }
        }
      }
    } else if (el.id?.startsWith('R') && fields.diametro !== undefined) {
      const newDiam = String(fields.diametro || '');
      const rDVal = diamPulgFromLabel(newDiam);
      if (rDVal > 0) {
        const connected = getConnectedVentBajantes(el as PlanoRamal);
        for (const vb of connected) {
          const lvl = engine.nivelActual?.label ?? '';
          const gd = vb.ghostData?.[lvl];
          const bNominal = gd?.dNominal || vb.dNominal || '';
          const bDVal = vb.diamPulg || diamPulgFromLabel(bNominal);
          if (bDVal > 0 && bDVal < rDVal) {
            engine.triggerAlert(
              'Diámetro no válido',
              `El diámetro del bajante de ventilación (${bNominal || vb.id}) no puede ser inferior al diámetro del ramal de ventilación al que está conectado (${newDiam}).`,
            );
            fields.diametro = '';
            return true;
          }
        }
      }
    }
  }
  return true;
}

export function updateSelected(engine: IPlanoEngineCore, fields: Record<string, unknown>): void {
  const el = getSelected(engine);
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
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

export function updateElementById(
  engine: IPlanoEngineCore,
  id: string,
  fields: Record<string, unknown>,
): void {
  const el: PlanoRamal | PlanoBajante | PlanoTextAnnotation | PlanoArea | undefined =
    engine.ramales.find((r) => r.id === id) ||
    engine.bajantes.find((b) => b.id === id) ||
    engine.textAnnots.find((t) => t.id === id) ||
    engine.areas.find((a) => a.id === id);
  if (el) {
    checkVentDiameterLimits(engine, el, fields);
    Object.assign(el, fields);
    if ((el as PlanoRamal).pts && el.id?.startsWith('R') && fields.pts) {
      const [mx, my] = _midpoint((el as PlanoRamal).pts);
      (el as PlanoRamal).labelX = mx;
      (el as PlanoRamal).labelY = my;
    }
  }
  // Mirror bajante property changes (dNominal, direction) to any cross-floor ghost that points at
  // this bajante so the dashed-line label on the target floor stays in sync without a separate
  // user action.
  if (el && (el as PlanoBajante).tipo) {
    if (fields.dNominal !== undefined) {
      updateCrossFloorGhostFieldBySource(
        engine._loadedPlanId ?? '',
        id,
        'dNominal',
        String(fields.dNominal ?? ''),
      );
    }
    if (fields.direccion !== undefined) {
      const dirVal = String(fields.direccion ?? '');
      if (dirVal === 'sube' || dirVal === 'baja') {
        updateCrossFloorGhostFieldBySource(
          engine._loadedPlanId ?? '',
          id,
          'parentDireccion',
          dirVal,
        );
      }
    }
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
    const idx = ANGLES.reduce(
      (b, a, i) => (Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b),
      0,
    );
    (el as PlanoTextAnnotation).textAngle = ANGLES[(idx + 1) % ANGLES.length];
  } else {
    const elLabeled = el as PlanoRamal | PlanoBajante | PlanoArea;
    const cur = elLabeled.labelAngle || 0;
    const idx = ANGLES.reduce(
      (b, a, i) => (Math.abs(cur - a) < Math.abs(cur - ANGLES[b]) ? i : b),
      0,
    );
    elLabeled.labelAngle = ANGLES[(idx + 1) % ANGLES.length];
  }
  engine._emitSelect(el);
  engine.render();
}

export function resetLabel(engine: IPlanoEngineCore): void {
  const el = getSelected(engine);
  if (!el) return;
  if ((el as PlanoRamal).pts) {
    const [mx, my] = _midpoint((el as PlanoRamal).pts);
    const elRamal = el as PlanoRamal;
    elRamal.labelX = mx;
    elRamal.labelY = my;
    elRamal.labelAngle = 0;
  } else {
    // Bajantes/areas carry their own labelX/Y; text annotations position via x/y
    // instead — this cast reflects that genuinely mixed shape, not uncertainty.
    const elPositionable = el as {
      labelX?: number;
      labelY?: number;
      labelAngle?: number;
      x?: number;
      y?: number;
    };
    elPositionable.labelX = elPositionable.x;
    elPositionable.labelY = elPositionable.y;
    elPositionable.labelAngle = 0;
  }
  engine.render();
}
