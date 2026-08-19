import type { IPlanoEngineCore, PlanoBajante } from './PlanoState';
import { isBajante, isTextAnnotation, isArea, ensureActiveNet } from './PlanoState';
import {
  type TextCorner,
  oppositeTextCorner,
  textLocalCorner,
  rotateLocalPoint,
} from './textAnnotationGeometry';
import { pointInLabelBox, pointOnAnyBodySegment } from './HitTester';
import { getSelected, selectAt } from './PlanoEngineSelection';
import { bajanteHitDistance } from './canalAssociation';
import {
  _tryCanalResizeHit,
  _tryBajanteHit,
  _tryRamalEndpointHit,
  _tryMultiSelEndpointHit,
  _tryMultiSelDrag,
} from './mouseDownHits';
import { _trySelBajanteDrag, _trySelDimDrag, _trySelRamalDrag } from './mouseDownDrags';

export { collectConnectedGraph } from './mouseDownDrags';

export function handleSelectDown(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  isMultiSelectModifier: boolean = false,
): void {
  const wasGhostSel = engine._isGhostSel;
  engine._isGhostSel = false;
  engine._lblDragIsParent = false;
  // Traza de diagnóstico del flujo de selección para DEV — documenta qué ramal/bajante ganó en
  // cada etapa y por qué. Se imprime desde _onDownHandler (PlanoEngine.ts) solo en dev.
  if (import.meta.env?.DEV) {
    engine._debugSel = { x, y, notes: [] as string[], final: null as string | null };
  }
  // La selección de un fantasma de asociación entre pisos (selectedGhostId) nunca debe
  // sobrevivir a este clic — se limpia incondicionalmente al inicio para que CUALQUIER otro
  // acierto de abajo (la etiqueta de un bajante real, un ramal, etc.) parta de pizarra limpia.
  // Se re-fija abajo solo si ESTE clic realmente cae sobre el círculo propio de un fantasma.
  if (engine.tool === 'sel' && !isMultiSelectModifier && engine.selectedGhostId) {
    engine.selectedGhostId = null;
  }
  // PRIMERO: revisar todas las etiquetas de bajante — simple, sin juegos de prioridad
  let labelBest: { id: string; x: number; y: number; isParent: boolean } | null = null;
  let labelBestDist = Infinity;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 30) {
      if (ensureActiveNet(engine, b.net)) return;
      const isParent = b.pisoBase === engine.nivelActual?.label;
      if (
        !labelBest ||
        (isParent && !labelBest.isParent) ||
        (isParent === labelBest.isParent && d < labelBestDist)
      ) {
        labelBest = { id: b.id, x: x - lPos.x, y: y - lPos.y, isParent };
        labelBestDist = d;
      }
    }
  }
  if (labelBest) {
    engine.selId = labelBest.id;
    engine._lblDragIsParent = labelBest.isParent;
    const b = engine.bajantes.find((bb) => bb.id === labelBest!.id);
    if (b) engine._emitSelect(b);
    engine.lblDrag = { id: labelBest.id, offX: labelBest.x, offY: labelBest.y };
    engine.render();
    return;
  }
  const sel = getSelected(engine);

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryCanalResizeHit(engine, x, y, sel)) return;
  }

  // Fantasma de asociación entre pisos (associateBajanteAcrossFloors.ts) — marcador de
  // referencia puro, con su propio estado de selección (selectedGhostId), nunca dirige la
  // selección ni el arrastre de ramales/bajantes. selectedGhostId ya se limpió
  // incondicionalmente arriba; solo se re-fija si ESTE clic realmente cae sobre el círculo
  // propio de un fantasma.
  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    for (const g of engine.crossFloorGhosts) {
      if (!g._hitCircle) continue;
      const gDist = Math.hypot(x - g._hitCircle.x, y - g._hitCircle.y);
      if (gDist >= g._hitCircle.r) continue;
      // Un bajante real justo al lado de este marcador de referencia debe ganar siempre si está
      // genuinamente más cerca del clic — el fantasma es secundario, nunca se le permite
      // eclipsar un elemento real y editable.
      let realIsCloser = false;
      for (const b of engine.bajantes) {
        const c = engine.toCvs(b.x, b.y);
        if (Math.hypot(x - c.x, y - c.y) < gDist) {
          realIsCloser = true;
          break;
        }
        const lx = b.labelX ?? b.x,
          ly = b.labelY ?? b.y + 20;
        const lPos = engine.toCvs(lx, ly);
        if (Math.hypot(x - lPos.x, y - lPos.y) < gDist) {
          realIsCloser = true;
          break;
        }
      }
      if (realIsCloser) continue;
      engine.selectedGhostId = g.id;
      engine.selId = null;
      engine.render();
      return;
    }
  }

  // Ítem 7: el arrastre de conjunto multi-seleccionado nunca funcionaba en la práctica — el clic
  // sobre un bajante (_tryBajanteHit) o un extremo de ramal (_tryRamalEndpointHit) capturaba
  // primero y nunca llegaba a _tryMultiSelDrag. Si el elemento bajo el cursor pertenece a la
  // multi-selección (y no es un extremo, que sigue remodelando su ramal individual), el arrastre
  // de grupo gana.
  if (engine.tool === 'sel' && !isMultiSelectModifier && engine.multiSel.length > 0) {
    if (
      !_tryMultiSelEndpointHit(engine, x, y) &&
      _tryMultiSelDrag(engine, x, y, isMultiSelectModifier)
    )
      return;
  }

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

  if (sel && 'labelX' in sel && !sel.id?.startsWith('T')) {
    if (sel._labelBox && pointInLabelBox(x, y, sel._labelBox)) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return;
    }
    if (
      !(
        isBajante(sel) &&
        (sel.tipo === 'bajante' ||
          sel.tipo === 'montante' ||
          sel.tipo === 'red_publica' ||
          sel.tipo === 'contador' ||
          sel.tipo === 'calentador' ||
          sel.id?.startsWith('B'))
      )
    ) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 12) {
        engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
        return;
      }
    }
  }

  if (isTextAnnotation(sel) && sel._box && sel.id?.startsWith('T')) {
    const b = sel._box;
    // Cualquiera de las 4 esquinas se puede arrastrar para redimensionar. El ancla es la esquina
    // OPUESTA en el marco local (sin rotar) de la caja — calculada con las mismas fórmulas que
    // renderTextAnnotations.ts usa para dibujarla — para que la posición de canvas de esa
    // esquina quede exactamente fija mientras se redimensiona, sin importar qué esquina se agarró
    // ni si el texto está rotado.
    const corners: { x: number; y: number; corner: TextCorner }[] = [
      { x: b.x, y: b.y, corner: 'tl' },
      { x: b.x + b.w, y: b.y, corner: 'tr' },
      { x: b.x, y: b.y + b.h, corner: 'bl' },
      { x: b.x + b.w, y: b.y + b.h, corner: 'br' },
    ];
    const grabbed = corners.find((c) => Math.hypot(x - c.x, y - c.y) < 10);
    if (grabbed) {
      const fs = engine.mm2cvs(sel.fontMm || 2.5);
      const pad = 5 * engine.zoom;
      const boxWFull = (sel.boxW > 0 ? sel.boxW * engine.zoom : b.w - pad * 2) + pad * 2;
      const boxHFull = fs + pad * 2;
      const angle = ((sel.textAngle || 0) * Math.PI) / 180;
      const c = engine.toCvs(sel.x + (sel.lblOffX || 0), sel.y + (sel.lblOffY || 0));
      const anchorCorner = oppositeTextCorner(grabbed.corner);
      const local = textLocalCorner(anchorCorner, fs, pad, boxWFull, boxHFull);
      const rot = rotateLocalPoint(local.lx, local.ly, angle);
      const anchorX = c.x + rot.x;
      const anchorY = c.y + rot.y;
      engine.txtResize = {
        id: sel.id,
        corner: grabbed.corner,
        anchorX,
        anchorY,
        startDist: Math.hypot(x - anchorX, y - anchorY),
        origFontMm: sel.fontMm || 2.5,
        origBoxWpx: boxWFull,
      };
      return;
    }
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
        if (Number.isFinite(bajanteHitDistance(b, x, y))) {
          selectAt(engine, x, y, isMultiSelectModifier);
          return;
        }
      }
      const fg = engine.getBajantesFantasma();
      for (const b of fg) {
        if (b._ghost) {
          const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
          if (d < b._ghost.r) {
            selectAt(engine, x, y, isMultiSelectModifier);
            return;
          }
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
          if (Number.isFinite(bajanteHitDistance(bb, x, y))) {
            bajAtPos = true;
            break;
          }
        }
        if (!bajAtPos) {
          const fg = engine.getBajantesFantasma();
          for (const bb of fg) {
            if (bb._ghost && Math.hypot(x - bb._ghost.x, y - bb._ghost.y) < bb._ghost.r) {
              bajAtPos = true;
              break;
            }
          }
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

  // Clic sobre el CUERPO (interior del trazo) de un ramal: ese dueño es el target real — el
  // arrastre de etiqueta de OTRO ramal cuya caja quedó encima por casualidad debe ceder.
  const lblBodyOwner = pointOnAnyBodySegment(
    engine.ramales,
    x,
    y,
    (px, py) => engine.toCvs(px, py),
    engine.mm2cvs(3),
  );
  for (const r of engine.ramales) {
    if (lblBodyOwner && r.id !== lblBodyOwner) continue;
    const lPos = engine.toCvs(r.labelX, r.labelY);
    const inBox = r._labelBox && pointInLabelBox(x, y, r._labelBox);
    const nearPoint = Math.hypot(x - lPos.x, y - lPos.y) < 12;
    if (inBox || nearPoint) {
      if (ensureActiveNet(engine, r.net)) return;
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  // Etiqueta de accesorio de sifón ("S D=...") — su propia caja arrastrable, separada de la
  // etiqueta principal del ramal, una por extremo porque un ramal puede llevar un sifón en
  // ambas puntas.
  for (const r of engine.ramales) {
    if (lblBodyOwner && r.id !== lblBodyOwner) continue;
    const slots: Array<{ slot: 'ini' | 'fin'; box: typeof r._sifonLabelBoxIni }> = [
      { slot: 'ini', box: r._sifonLabelBoxIni },
      { slot: 'fin', box: r._sifonLabelBoxFin },
    ];
    for (const { slot, box } of slots) {
      if (!box || !pointInLabelBox(x, y, box)) continue;
      if (ensureActiveNet(engine, r.net)) return;
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - box.cx, offY: y - box.cy, slot };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  // Acierto directo de etiqueta usando solo labelX/labelY — se salta posibles problemas de
  // _labelBox.
  let bestB: (typeof engine.bajantes)[0] | null = null;
  let bestDist = Infinity;
  let bestIsGhost = false;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 40) {
      if (ensureActiveNet(engine, b.net)) return;
      const isGhost = b.pisoBase !== engine.nivelActual?.label;
      // Preferir no-fantasma (padre) sobre fantasma, y más cercano sobre más lejano
      if (!bestB || (!isGhost && bestIsGhost) || (isGhost === bestIsGhost && d < bestDist)) {
        bestB = b;
        bestDist = d;
        bestIsGhost = isGhost;
      }
    }
  }
  if (bestB) {
    const lPos = engine.toCvs(bestB.labelX ?? bestB.x, bestB.labelY ?? bestB.y + 20);
    engine.selId = bestB.id;
    engine._emitSelect(bestB);
    engine._lblDragIsParent = true;
    engine.lblDrag = { id: bestB.id, offX: x - lPos.x, offY: y - lPos.y };
    engine.render();
    return;
  }

  const fg = engine.getBajantesFantasma();
  let gFound: PlanoBajante | null = null,
    gMin = Infinity;

  for (const b of fg) {
    if (b._ghostLabelBox && pointInLabelBox(x, y, b._ghostLabelBox)) {
      if (ensureActiveNet(engine, b.net)) return;
      engine.selId = b.id;
      engine._isGhostSel = true;
      // El fantasma siempre tiene su propia posición de etiqueta independiente (ghostData por
      // nivel) — nunca debe redirigirse a arrastrar la etiqueta del padre en su lugar.
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
          ? engine.ramales.find((rr) => rr.id === b.recibeDeIds![0])
          : engine.ramales.find(
              (rr) => rr.pts?.length && Math.hypot(rr.pts[0][0] - gx, rr.pts[0][1] - gy) < 12,
            );
        if (firstRamal && firstRamal.pts && firstRamal.pts.length >= 2) {
          const dx = firstRamal.pts[1][0] - firstRamal.pts[0][0];
          const dy = firstRamal.pts[1][1] - firstRamal.pts[0][1];
          if (Math.hypot(dx, dy) > 0.1) {
            ghostAngle = Math.atan2(dy, dx);
          }
        } else {
          ghostAngle = ((b.labelAngle || 0) * Math.PI) / 180;
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
      const dGhost = Math.hypot(x - lPos.x, y - lPos.y);
      // Antes de comprometerse con el fantasma: revisar si alguna etiqueta de padre no-fantasma
      // está más cerca
      let bestParent: typeof b | null = null,
        bestPDist = Infinity;
      for (const pb of engine.bajantes) {
        if (pb.pisoBase !== engine.nivelActual?.label) continue;
        const plx = pb.labelX ?? pb.x;
        const ply = pb.labelY ?? pb.y + 20;
        const pp = engine.toCvs(plx, ply);
        const pd = Math.hypot(x - pp.x, y - pp.y);
        if (pd < 40 && pd < bestPDist) {
          bestParent = pb;
          bestPDist = pd;
        }
      }
      if (bestParent && bestPDist < dGhost) {
        engine._isGhostSel = false;
        engine._lblDragIsParent = true;
        const pp = engine.toCvs(
          bestParent.labelX ?? bestParent.x,
          bestParent.labelY ?? bestParent.y + 20,
        );
        engine.lblDrag = { id: bestParent.id, offX: x - pp.x, offY: y - pp.y };
        engine._emitSelect(bestParent);
        engine.render();
        return;
      }
      engine._lblDragIsParent = false;
      engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(b);
      engine.render();
      return;
    }
  }

  for (const b of fg) {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      if (d < b._ghost.r && d < gMin) {
        gMin = d;
        gFound = b as PlanoBajante;
      }
    }
  }
  if (gFound) {
    if (ensureActiveNet(engine, gFound.net)) return;
    engine.selId = gFound.id;
    engine._isGhostSel = true;
    engine._emitSelect(gFound);
    engine.render();
    engine.ghostDrag = {
      id: gFound.id,
      startX: x,
      startY: y,
      baseDx: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dx || 0,
      baseDy: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dy || 0,
    };
    return;
  }
  // Línea guía: clic sobre su caja de hit-test (el rectángulo fino que pinta
  // renderGuideLines) → selección + arrastre de cuerpo completo. Va DESPUÉS de todos los
  // aciertos de ramal/bajante (una guía cruzando un ramal no debe robarle el clic) y antes del
  // selectAt genérico.
  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    for (const g of engine.guideLines) {
      if (!g._labelBox || !pointInLabelBox(x, y, g._labelBox)) continue;
      engine.selId = g.id;
      engine._emitSelect(g);
      const tp = engine.toPlane(x, y);
      engine.guideDrag = {
        id: g.id,
        startX: tp.x,
        startY: tp.y,
        origPts: g.pts.map((pt) => [...pt] as [number, number]),
      };
      engine.render();
      return;
    }
  }

  selectAt(engine, x, y, isMultiSelectModifier);
  if (
    engine.tool === 'sel' &&
    !engine.ptDrag &&
    !engine.ramalDrag &&
    !engine.bajDrag &&
    !engine.ghostDrag &&
    !engine.guideDrag &&
    !engine.lblDrag &&
    !engine.txtDrag &&
    !engine.areaDrag &&
    !engine.dimDrag &&
    !engine.multiDrag &&
    !engine.selId
  ) {
    if (!isMultiSelectModifier) {
      engine.multiSel = [];
    }
    engine.marqueeRect = { x1: x, y1: y, x2: x, y2: y };
  }
}
