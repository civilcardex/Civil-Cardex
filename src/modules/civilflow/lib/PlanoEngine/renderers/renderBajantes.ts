import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../HitTester';
import type { IPlanoEngineCore } from '../PlanoState';
import type { PlanoBajante } from '../PlanoState';
import type { CrossFloorGhost } from '../../../utils/associateBajanteAcrossFloors';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { parseDescargaEnId } from '../../../utils/parseDescargaEnId';
import { pisoCortoLoose as getPisoCorto } from '../../../constants';
import { MONTANTE_NETS } from '../drawingCreations';
import { BORDE_LIBRE_CANAL_CM } from '../../../utils/calcRainwater';
import { computeCanalFlowArrows } from '../canalAssociation';

const DIR_MAP: Record<string, string> = { sube: 'Sube', baja: 'Baja', continua: 'Continua' };

function renderBajanteLabel(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  b: PlanoBajante | CrossFloorGhost,
  c: { x: number; y: number },
  r: number,
  angle: number,
  offDx: number,
  offDy: number,
  line1: string,
  dirText: string,
  labelBoxProp: '_labelBox' | '_ghostLabelBox' | '_crossFloorLabelBox',
  alpha: number,
  opts?: { skipLeader?: boolean; textColor?: string },
): void {
  const { skipLeader = false, textColor = '#000' } = opts || {};
  const hasDir = !!dirText;

  const bTipo2 = 'tipo' in b ? b.tipo : undefined;
  const labelSizeMul = bTipo2 === 'contador' || bTipo2 === 'calentador' ? 0.75 : 1;
  // Bajante/montante code label uses the exact same size formula as a ramal's own name label
  // (renderRamales.ts fsName/fsInfo) so the two read as objectively equal in size.
  const fsCode = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM * labelSizeMul);
  const fsDir = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * labelSizeMul);
  const lineH = fsCode + 2;

  ctx.save();
  ctx.font = `bold ${fsCode}px Geist, monospace`;
  const tw1 = ctx.measureText(line1).width;
  const boxW = tw1 + engine.mm2cvs(4);
  const boxH = hasDir ? lineH + 2 + fsDir + engine.mm2cvs(1.5) : lineH + engine.mm2cvs(1);
  const hh2 = boxH / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(c.x, c.y);

  if (!skipLeader) {
    const intersection = getLabelIntersection(offDx, offDy, boxW, boxH, angle);
    const distToLabel = Math.hypot(offDx, offDy);
    let lineStartX = 0,
      lineStartY = 0;
    if (distToLabel > 0.1) {
      const ux = offDx / distToLabel,
        uy = offDy / distToLabel;
      lineStartX = r * ux;
      lineStartY = r * uy;
    }
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(intersection.x, intersection.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.8 * engine.zoom;
    ctx.stroke();
    ctx.restore();
  }

  ctx.translate(offDx, offDy);
  ctx.rotate(angle);

  const lbCx = c.x + offDx;
  const lbCy = c.y + offDy;
  const {
    corners: corners2,
    minX,
    minY,
    maxX,
    maxY,
  } = rotatedRectCorners(lbCx, lbCy - 10 + hh2, boxW, boxH, angle, 2);
  (b as unknown as Record<string, unknown>)[labelBoxProp] = {
    cx: lbCx,
    cy: lbCy - 10 + hh2,
    w: boxW,
    h: boxH,
    angle,
    minX,
    minY,
    maxX,
    maxY,
    corners: corners2,
  };

  // Deliberately no fill here anymore — labels used to sit on a solid white plate; now they read
  // directly over whatever's underneath (transparent background), per explicit request.
  ctx.beginPath();
  ctx.roundRect(-boxW / 2, -10, boxW, boxH, 0);

  const bTipo = 'tipo' in b ? b.tipo : undefined;
  if (bTipo === 'contador' || bTipo === 'calentador') {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8 * engine.zoom;
    ctx.stroke();
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(line1, 0, -10 + engine.mm2cvs(0.5));

  if (dirText) {
    ctx.font = `${fsDir}px Geist, monospace`;
    ctx.fillStyle = textColor;
    ctx.fillText(dirText, 0, -10 + lineH + engine.mm2cvs(1));
  }
  ctx.restore();
  ctx.restore();
}

function getLabelIntersection(
  offDx: number,
  offDy: number,
  boxW: number,
  boxH: number,
  angle: number,
): { x: number; y: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const localStartX = -offDx * cosA - offDy * sinA;
  const localStartY = offDx * sinA - offDy * cosA;

  const xMin = -boxW / 2;
  const xMax = boxW / 2;
  const yMin = -10;
  const yMax = -10 + boxH;

  let tEnter = 0;

  if (localStartX !== 0) {
    const t1 = 1 - xMin / localStartX;
    const t2 = 1 - xMax / localStartX;
    const tMin = Math.min(t1, t2);
    tEnter = Math.max(tEnter, tMin);
  }

  if (localStartY !== 0) {
    const t1 = 1 - yMin / localStartY;
    const t2 = 1 - yMax / localStartY;
    const tMin = Math.min(t1, t2);
    tEnter = Math.max(tEnter, tMin);
  }

  tEnter = Math.max(0, Math.min(1, tEnter));

  const localIntersectX = localStartX * (1 - tEnter);
  const localIntersectY = localStartY * (1 - tEnter);

  const intersectDx = localIntersectX * cosA - localIntersectY * sinA + offDx;
  const intersectDy = localIntersectX * sinA + localIntersectY * cosA + offDy;

  return { x: intersectDx, y: intersectDy };
}

// Shared by the parent bajante's own circle AND its ghost — draws the interior direction glyph
// (arrow up/down, dot, or "continua" arrow) the exact same vector-drawn way in both places.
// Previously the ghost used unicode text glyphs (⬇/•/➜) filled with the net color instead of
// this vector shape in arrowCol (red for bajante, blue for montante), so it never actually looked
// like its parent despite the size/opacity already matching. Caller must already have translated
// ctx to the symbol's local origin (0,0) and rotated as needed.
function drawDireccionSymbol(
  ctx: CanvasRenderingContext2D,
  tipo: string,
  r: number,
  direccion: string | undefined,
): void {
  const arrowCol = tipo === 'bajante' ? '#F04545' : '#3B82F6';
  if (direccion === 'sube') {
    ctx.fillStyle = arrowCol;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (direccion === 'baja') {
    const aS = r * 0.7;
    ctx.strokeStyle = arrowCol;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, -aS * 0.9);
    ctx.lineTo(0, aS * 0.5);
    ctx.stroke();
    ctx.fillStyle = arrowCol;
    ctx.beginPath();
    ctx.moveTo(0, aS * 0.9);
    ctx.lineTo(-aS * 0.4, aS * 0.3);
    ctx.lineTo(aS * 0.4, aS * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (direccion === 'continua') {
    ctx.fillStyle = arrowCol;
    ctx.font = `${r * 1.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('➜', 0, 0);
  } else {
    // No direction resolved: default fallback arrow, down for bajante / up for montante.
    const aS = r * 0.7;
    ctx.strokeStyle = arrowCol;
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    if (tipo === 'bajante') {
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(0, aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(-aS * 0.4, aS * 0.3);
      ctx.lineTo(aS * 0.4, aS * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(0, -aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(-aS * 0.4, -aS * 0.3);
      ctx.lineTo(aS * 0.4, -aS * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// Canal is a corner+size rectangle (b.x/b.y = top-left plane corner, b.base/b.altura = real cm
// size) rather than a point+radius symbol — drawn in absolute canvas space, never rotated (unlike
// every other bajante-array glyph, whose shape rotates with labelAngle), since a non-square
// rectangle rotating with the label would visually contradict its own resize handles, which are
// always axis-aligned. Selected corners get a small square handle (grabbed by
// handleMouseDown.ts's _tryCanalResizeHit) to resize independently of the label rotation.
function renderCanalGlyph(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  b: PlanoBajante,
): void {
  if (engine._hiddenNets.has(b.net)) return;
  const tl = engine.toCvs(b.x, b.y);
  const w = Math.max(engine.cmToCanvasPx(b.base || 0), 20);
  const h = Math.max(engine.cmToCanvasPx(b.altura || 0), 14);
  const sel = b.id === engine.selId && !engine._isGhostSel;
  const col = NETS.find((n) => n.id === 'll')?.col || '#8B5CF6';

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, w, h);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = (sel ? 1.6 : 0.8) * engine.zoom;
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, w, h);
  ctx.stroke();
  const midY = tl.y + h * 0.25;
  ctx.beginPath();
  ctx.moveTo(tl.x, midY);
  ctx.lineTo(tl.x + w, midY);
  ctx.stroke();

  // Corner resize handles are intentionally not drawn — the grab hit-test in
  // handleMouseDown.ts's _tryCanalResizeHit works purely off proximity to `_canalBox`'s
  // corners (computed below regardless of what's rendered), so resizing still works without
  // the visual squares.

  // Yellow selection arrow — same style/shape every other bajante-array glyph shows when
  // selected (renderBajantes' main loop below), pointing in from the right edge.
  const inMultiSel = (engine.multiSel || []).includes(b.id);
  if ((sel || inMultiSel) && !engine._isGhostSel) {
    const arrowR = 8 * engine.zoom;
    const cy = tl.y + h / 2;
    const ox = tl.x + w + 14 * engine.zoom;
    ctx.fillStyle = '#FFEB3B';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6 * engine.zoom;
    ctx.beginPath();
    ctx.moveTo(ox - arrowR, cy);
    ctx.lineTo(ox, cy - arrowR * 0.5);
    ctx.lineTo(ox, cy + arrowR * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Flow-direction arrows — black and short, same as a ramal's own flow arrow. With NO bajante
  // inside, a single centered arrow points the way the canal was dragged when drawn
  // (_canalFlowDir). With bajantes, that arrow is replaced by one short arrow per bajante side,
  // each pointing INTO the bajante (two if it's mid-body; see canalAssociation.ts
  // computeCanalFlowArrows), aligned with the bajante's circle center and stopping at its rim —
  // the arrows stay outside the symbol. The canal itself is never split.
  const drawFlowArrow = (tail: { x: number; y: number }, head: { x: number; y: number }) => {
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = 1 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    const aSize = Math.min(5 * engine.zoom, len * 0.55);
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(head.x - ux * aSize - uy * aSize * 0.45, head.y - uy * aSize + ux * aSize * 0.45);
    ctx.lineTo(head.x - ux * aSize + uy * aSize * 0.45, head.y - uy * aSize - ux * aSize * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  const bajArrows = computeCanalFlowArrows(engine, b);
  if (bajArrows.length === 0) {
    const cx = tl.x + w / 2;
    const cy = tl.y + h / 2;
    const half = 7 * engine.zoom;
    const dir = b._canalFlowDir ?? (w >= h ? 'derecha' : 'abajo');
    if (dir === 'derecha') drawFlowArrow({ x: cx - half, y: cy }, { x: cx + half, y: cy });
    else if (dir === 'izquierda') drawFlowArrow({ x: cx + half, y: cy }, { x: cx - half, y: cy });
    else if (dir === 'abajo') drawFlowArrow({ x: cx, y: cy - half }, { x: cx, y: cy + half });
    else drawFlowArrow({ x: cx, y: cy + half }, { x: cx, y: cy - half });
  }
  // Rounded to the same radius the bajante symbol renders at (renderBajantes' main loop), so the
  // arrow head stops exactly at the rim of the bajante's circle instead of driving through it.
  const bajR = engine.realMmToCanvasPx(20) * 0.6;
  const shortLen = 14 * engine.zoom;
  for (const arrow of bajArrows) {
    const head = engine.toCvs(arrow.x1, arrow.y1);
    const tail = engine.toCvs(arrow.x0, arrow.y0);
    const dx = head.x - tail.x;
    const dy = head.y - tail.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ux = dx / len;
    const uy = dy / len;
    const rim = { x: head.x - ux * bajR, y: head.y - uy * bajR };
    const cut = Math.min(shortLen, len - bajR);
    drawFlowArrow({ x: rim.x - ux * cut, y: rim.y - uy * cut }, rim);
  }

  b._canalBox = { x: tl.x, y: tl.y, w, h };
  // Centered on the rectangle (not the top-left corner) so the shared circular hit-test every
  // other bajante-array tipo already uses (selectAt, hitTestRightClick, _tryBajanteHit) covers
  // the whole visible shape for click-anywhere selection.
  b._circ = { x: tl.x + w / 2, y: tl.y + h / 2, r: Math.hypot(w, h) / 2 };

  if (b.code || b.code === '') {
    // Always centered directly below the rectangle, outside it — not draggable (ignores any
    // stored labelX/labelY/labelAngle) and no leader line, per explicit request.
    const offDx = 0;
    const offDy = h + engine.mm2cvs(3);
    // Floor suffix is already baked into b.code at creation (CALL{n}-P{piso}) — a canal lives
    // on a single floor, unlike bajante's dynamic per-render lvlSuffix.
    const line1 = b.code || '—';
    const dirText = `${b.base || 0} x ${(b.altura || 0) + BORDE_LIBRE_CANAL_CM}`;
    renderBajanteLabel(
      ctx,
      engine,
      b,
      { x: tl.x + w / 2, y: tl.y },
      0,
      0,
      offDx,
      offDy,
      line1,
      dirText,
      '_labelBox',
      1,
      {
        skipLeader: true,
      },
    );
  } else {
    b._labelBox = undefined;
  }
}

// Live rubber-band preview while the canal tool is mid-drag (_canalStart set, first corner
// placed, second click not yet made) — same dashed-preview pattern as renderGuideGhost/
// renderDimGhost, plus a live cm dimension readout (also shown in the status bar via
// _statusMsg) so the user can see the exact size before committing the second click.
export function renderCanalGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine._canalStart || engine.tool !== 'canal') return;
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const x = Math.min(engine._canalStart.x, mp.x);
  const y = Math.min(engine._canalStart.y, mp.y);
  const w = Math.abs(mp.x - engine._canalStart.x);
  const h = Math.abs(mp.y - engine._canalStart.y);
  const tl = engine.toCvs(x, y);
  const cw = w * engine.zoom;
  const ch = h * engine.zoom;

  ctx.save();
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 1 * engine.zoom;
  ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, cw, ch);
  ctx.stroke();
  ctx.setLineDash([]);

  const baseCm = Math.round(engine.pxToM(w) * 100);
  const alturaCm = Math.round(engine.pxToM(h) * 100);
  ctx.font = `${11 * engine.zoom}px Geist, monospace`;
  ctx.fillStyle = '#8B5CF6';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${baseCm} x ${alturaCm} cm`, tl.x, tl.y - 4 * engine.zoom);
  ctx.restore();
}

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.bajantes.forEach((b) => {
    if (engine._hiddenNets.has(b.net)) return;

    // Canal is a corner+size rectangle, not a point+radius symbol like every other tipo in this
    // array — it never rotates (labelAngle only affects its label position, not the shape) and
    // has its own hit-test box (_canalBox) instead of the generic ctx.rotate glyph pipeline
    // below, so it's handled entirely separately.
    if (b.tipo === 'canal') {
      renderCanalGlyph(ctx, engine, b);
      return;
    }

    // A bajante only gets its solid circle on ITS OWN floor (pisoBase). A displacement entry
    // for the current level doesn't mean anything about which floor it belongs to — it's also
    // how ghosts get positioned on remote floors — so it must never suppress the ghost check.
    const isDirectionGhost = b.pisoBase !== engine.nivelActual?.label;

    const c = engine.toCvs(b.x, b.y);
    // When this bajante is a remote-floor ghost, never draw the thick yellow selection border.
    const sel = b.id === engine.selId && !engine._isGhostSel && !isDirectionGhost;
    // realMmToCanvasPx floors at 1mm paper (see PlanoEngine.ts) — at common architectural
    // scales a 20mm or 10mm real radius both land on that floor and render identically, so
    // halving the mm argument alone is invisible. Halve the resulting px value instead.
    const r = engine.realMmToCanvasPx(20) * 0.6;

    // Item 2: Label angle + snap constraint (Auto-rotation removed as requested)
    const angle = ((b.labelAngle || 0) * Math.PI) / 180;

    b._circ = { x: c.x, y: c.y, r };
    if (isDirectionGhost) return;

    // Draw green dashed lines from ramales that feed this bajante (recibeDeIds) — this is a
    // guide for when the bajante sits AWAY from the ramal (e.g. an offset/ghost position), so
    // skip it whenever the bajante/montante's own point already coincides with ANY point of the
    // ramal (not just its two endpoints): a montante created mid-body (createMontanteMidBody)
    // sits on an INTERIOR vertex, not an endpoint, so comparing only against the closest endpoint
    // never matched and always drew a pointless line back from wherever that endpoint was; same
    // fix also covers a ramal arriving at this bajante's ghost/displaced position on this floor.
    if (b.recibeDeIds?.length) {
      const ghostDisp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
      const bPos = ghostDisp
        ? { x: b.x + ghostDisp.dx, y: b.y + ghostDisp.dy }
        : { x: b.x, y: b.y };
      b.recibeDeIds.forEach((rid: string) => {
        const ram = engine.ramales.find((rr) => rr.id === rid);
        if (ram && ram.pts.length) {
          const touchesDirectly = ram.pts.some(
            ([px, py]) => Math.hypot(px - bPos.x, py - bPos.y) < 1.5,
          );
          if (touchesDirectly) return;
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(rc.x, rc.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    if (b.descargaEnId) {
      const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
      const targetPlanId = parts[0];
      const targetId = parts[1];

      // Only draw line if the target is on the CURRENT floor
      if (String(targetPlanId) === String(engine._loadedPlanId)) {
        // Draw line to target RAMAL
        const ram = engine.ramales.find((rr) => rr.id === targetId);
        if (ram && ram.pts.length) {
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(rc.x, rc.y);
          ctx.stroke();
          ctx.restore();
        }
        // Draw line to target BAJANTE on same floor
        const targetBaj = engine.bajantes.find((bb) => bb.id === targetId);
        if (targetBaj) {
          const tc = engine.toCvs(targetBaj.x, targetBaj.y);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(tc.x, tc.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#ffffff';
    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#475569';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      ctx.fillStyle = '#A855F7';
      const devW = r * 2;
      const devH = r * 2.4;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#A855F7';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.stroke();
      const dispW = devW * 0.6;
      const dispH = devH * 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-dispW / 2, -devH / 2 + devH * 0.12, dispW, dispH, 1 * engine.zoom);
      ctx.fill();
    } else if (b.tipo === 'contador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'af'));
      const col = netObj ? netObj.col : '#4D8FF7';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.tipo === 'calentador') {
      const netObj = NETS.find((n) => n.id === (b.net === 'gas' ? 'gas' : 'ac'));
      const col = netObj ? netObj.col : b.net === 'gas' ? '#A855F7' : '#F04545';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else {
      const netObj = NETS.find((n) => n.id === b.net);
      const col = netObj ? netObj.col : '#e2e2e8';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 1.2 : 0.6) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RP', 0, 0);
    } else if (b.tipo === 'contador' && b.net === 'gas') {
      // Gas meter: no letter, no pipe segments
    } else if (b.tipo === 'contador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', 0, 0);
    } else if (b.tipo === 'calentador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 0);
    } else {
      drawDireccionSymbol(ctx, b.tipo, r, b.direccion);
    }

    // Yellow selection arrow (same style as ramales)
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    if ((sel || inMultiSel) && !engine._isGhostSel) {
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.save();
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // The parent label is drawn EXCEPT when this is a direction-based ghost on a remote floor
    // (pisoBase !== current nivel means the bajante belongs to another floor) — isDirectionGhost
    // computed above; this whole block is unreachable for that case anyway (early return above).
    if (!isDirectionGhost && (b.code || b.code === '')) {
      const lx = b.labelX ?? b.x;
      const ly = b.labelY ?? b.y + 20;
      const offDx = (lx - b.x) * engine.zoom;
      let offDy = (ly - b.y) * engine.zoom;

      // Item 2: Enforce minimum perpendicular offset so label doesn't sit on the ramal
      const minPerpPx = engine.mm2cvs(3);
      if (Math.abs(offDy) < minPerpPx) {
        offDy = offDy >= 0 ? minPerpPx : -minPerpPx;
      }

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      let diamStr = '';
      if (b.dNominal && b.dNominal !== '0') {
        const v = String(b.dNominal).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = normalizeDnLabel(v);
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = normalizeDnLabel(v);
          }
        }
      } else if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro.split(' — ')[0]);
      }
      // Bold big line is just the code — mirrors a ramal's own label, which keeps its bold
      // name line to the short code alone and pushes diametro into the smaller info line below.
      const line1 = codeStr || '—';
      const dirWord = DIR_MAP[b.direccion ?? ''] || '';
      const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      renderBajanteLabel(ctx, engine, b, c, r, angle, offDx, offDy, line1, dirText, '_labelBox', 1);
    } else {
      b._labelBox = undefined;
    }
  });
}

export function renderGhosts(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const fg = engine.getBajantesFantasma();
  fg.forEach((b) => {
    const net = NETS.find((n) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const gx = b.x + (disp ? disp.dx : 0);
    const gy = b.y + (disp ? disp.dy : 0);
    const c = engine.toCvs(gx, gy);
    // realMmToCanvasPx floors at 1mm paper (see PlanoEngine.ts) — at common architectural
    // scales a 20mm or 10mm real radius both land on that floor and render identically, so
    // halving the mm argument alone is invisible. Halve the resulting px value instead.
    const r = engine.realMmToCanvasPx(20) * 0.6;
    b._ghost = { x: c.x, y: c.y, r };

    // Ghost label always horizontal
    const ghostAngle = 0;

    // Ghost circle: same size, color and full opacity as the parent's own circle (per explicit
    // request — the ghost should look exactly like its parent, size and intensity alike).
    // Exception: a ghost with no real displacement on the parent's OWN floor sits at the exact
    // same (x,y) as the parent, which already draws its own solid circle there — skip the extra
    // ring so it doesn't look like an oversized halo. A ghost created by dragging (dx/dy set)
    // is a different point in space even on the parent's own floor, so it must still be drawn.
    const hasDisplacement = !!disp && (Math.abs(disp.dx) >= 1 || Math.abs(disp.dy) >= 1);
    const isOwnFloorGhost = b.pisoBase === engine.nivelActual?.label && !hasDisplacement;
    if (!isOwnFloorGhost) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col;
      // Must match the parent's own non-selected circle stroke exactly (0.6*zoom, set in the
      // default bajante/montante branch above) — this was 1.5, 2.5x thicker than the parent,
      // which is exactly the "ghost looks thicker" complaint.
      ctx.lineWidth = 0.6 * engine.zoom;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
    let ghostDir = b.direccion;
    if (gd && gd.direccion !== undefined) {
      ghostDir = gd.direccion;
    } else if (b.direccion === 'sube') {
      ghostDir = 'baja';
    } else if (b.direccion === 'baja') {
      ghostDir = 'sube';
    }
    // Same vector-drawn symbol as the parent's own circle (drawDireccionSymbol), not the old
    // unicode-glyph rendering — that was the actual visual mismatch with the parent.
    const skipSymbol = !ghostDir && !!b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    if (!skipSymbol) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.translate(c.x, c.y);
      drawDireccionSymbol(ctx, b.tipo, r, ghostDir);
      ctx.restore();
    }

    // Item 4: Yellow selection arrow for ghost bajante selection
    const inMultiSel = (engine.multiSel || []).includes(b.id);
    const ghostSel = engine.selId === b.id && engine._isGhostSel;
    if (ghostSel || inMultiSel) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(ghostAngle);
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6 * engine.zoom;
      const arrowR = 8 * engine.zoom;
      const ox = r + 14 * engine.zoom;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Item 6: Ghost label — render for all ghosts
    if (b.code || b.code === '') {
      const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
      let ghostOffX = 0;
      let ghostOffY = 0;
      if (gd?.labelX != null && gd?.labelY != null) {
        ghostOffX = (gd.labelX - gx) * engine.zoom;
        ghostOffY = (gd.labelY - gy) * engine.zoom;
      } else {
        const distPx = engine.mm2cvs(15);
        ghostOffX = distPx * Math.cos(ghostAngle);
        ghostOffY = distPx * Math.sin(ghostAngle);
      }
      const offDx = ghostOffX;
      const offDy = ghostOffY;

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr =
        (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      let ghostDir = b.direccion;
      if (gd?.direccion !== undefined) {
        ghostDir = gd.direccion;
      } else if (b.direccion === 'sube') {
        ghostDir = 'baja';
      } else if (b.direccion === 'baja') {
        ghostDir = 'sube';
      }
      const ghostDNom = gd?.dNominal || b.dNominal;
      let diamStr = '';
      if (b.diametro) {
        diamStr = normalizeDnLabel(b.diametro.split(' — ')[0]);
      } else if (ghostDNom && ghostDNom !== '0') {
        const v = String(ghostDNom).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = normalizeDnLabel(v);
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = normalizeDnLabel(v);
          }
        }
      }
      const line1 = codeStr || '—';
      const dirWord = DIR_MAP[ghostDir ?? ''] || '';
      const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;
      renderBajanteLabel(
        ctx,
        engine,
        b,
        c,
        r,
        ghostAngle,
        offDx,
        offDy,
        line1,
        dirText,
        '_ghostLabelBox',
        1,
      );
    }
  });
}

// Cross-floor association ghosts (associateBajanteAcrossFloors.ts) — pure positional reference
// markers written directly into this floor's own `crossFloorGhosts` array. Dashed circle + full
// bajante label above (code-Piso, D=, dir) in network color, matching source bajante format.
function toShortPiso(label: string): string {
  if (!label) return '';
  if (label.includes('Cubierta')) return 'C';
  const m = label.match(/(\d+)/);
  if (label.includes('Sótano')) return `S${m?.[1] || ''}`;
  if (label.includes('Piso')) return `P${m?.[1] || ''}`;
  return label;
}

export function renderCrossFloorGhosts(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
): void {
  (engine.crossFloorGhosts || []).forEach((g) => {
    if (engine._hiddenNets.has(g.net)) return;
    const net = NETS.find((n) => n.id === g.net);
    const col = net ? net.col : '#e2e2e8';
    const c = engine.toCvs(g.x, g.y);
    const r = engine.realMmToCanvasPx(20) * 0.6;
    g._hitCircle = { x: c.x, y: c.y, r };

    // Dashed line to the target bajante on this floor — tenuer than the network color and
    // dotted, so the cross-floor connector reads as a reference (not a real pipe) and stays
    // visibly lighter than the ramales on this same floor.
    if (g.targetBajanteId) {
      const targetB = engine.bajantes.find((b) => b.id === g.targetBajanteId);
      if (targetB) {
        const tc = engine.toCvs(targetB.x, targetB.y);
        ctx.save();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5 * engine.zoom;
        ctx.setLineDash([4 * engine.zoom, 4 * engine.zoom]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tc.x, tc.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // Dashed circle
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1 * engine.zoom;
    ctx.setLineDash([4 * engine.zoom, 3 * engine.zoom]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Direction glyph inside the circle — same vector shape as the real bajante's, reading the
    // SOURCE (parent) direction so the arrow matches the text label above.
    const ghostTipo = MONTANTE_NETS.includes(g.net) ? 'montante' : 'bajante';
    ctx.save();
    ctx.translate(c.x, c.y);
    drawDireccionSymbol(ctx, ghostTipo, r, g.parentDireccion ?? g.direccion);
    ctx.restore();

    // Label: BAN2-P2 / D=4" Baja (short piso, diameter shown)
    const shortPiso = toShortPiso(g.piso || '');
    const codeStr = (g.code || '').replace(/#/g, '').toUpperCase();
    const line1 = codeStr ? `${codeStr}${shortPiso ? '-' + shortPiso : ''}` : shortPiso || '—';
    let diamStr = '';
    if (g.dNominal && g.dNominal !== '0') {
      const v = String(g.dNominal).trim();
      if (v.includes('"') || v.includes('mm')) {
        diamStr = normalizeDnLabel(v);
      } else {
        const numV = Number(v);
        diamStr = !isNaN(numV) ? (numV < 20 ? `${numV}"` : `${numV}mm`) : normalizeDnLabel(v);
      }
    }
    // Show the SOURCE (upper-floor) parent's direction in the label, not the ghost's own counter-
    // direction. Falls back to ghost.direccion for legacy ghosts written before this field existed.
    const dirWord = DIR_MAP[g.parentDireccion ?? g.direccion ?? ''] || '';
    const dirText = diamStr ? `D=${diamStr}${dirWord ? '  ' + dirWord : ''}` : dirWord;

    // Label above the circle, centered, no leader line, network color. Tighter offset than a
    // regular bajante label — the ghost sits alongside its dashed line and the source's parent
    // symbol, so an extra 8 mm of breathing room just pushes it onto adjacent annotations.
    const offDy = -(r + engine.mm2cvs(3));
    renderBajanteLabel(
      ctx,
      engine,
      g,
      c,
      r,
      0,
      0,
      offDy,
      line1,
      dirText,
      '_crossFloorLabelBox',
      1,
      {
        skipLeader: true,
        textColor: col,
      },
    );
  });
}
