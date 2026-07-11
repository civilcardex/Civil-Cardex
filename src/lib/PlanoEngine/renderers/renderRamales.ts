import { NETS } from '../PlanoState';
import { snapTributaryToPadre45Deg } from '../PlanoEngineDrawing';
import { rotatedRectCorners, pointToSegmentDist } from '../HitTester';
import type { IPlanoEngineCore } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';
import { pisoCortoLoose as getPisoCorto } from '../../../constants';
import { drawRamalPath } from './drawRamalPath';
import { renderJunctions } from './renderJunctions';
import { renderVentCodos } from './renderVentCodos';

// Shared by both extreme (accesorioInicio/Fin) and mid-ramal (accMed*) accessory rendering.
// `outX,outY` is the "pointing away from the pipe" direction — for an extreme it's away from
// the ramal's own body; for a mid-ramal vertex it's the perpendicular normal (px,py) since
// there's no single "outward" side there. Caller is responsible for ctx.save()/restore().
function drawExtremeAccessorySymbol(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  accType: string,
  c: { x: number; y: number },
  dx: number, dy: number, px: number, py: number,
  outX: number, outY: number,
  rad: number
): void {
  if (accType === 'sifon') {
    const perX = -outY;
    const perY = outX;

    const L1 = rad * 1.6;
    const tickL = rad * 0.45;
    const H1 = rad * 0.4;
    const R = rad * 0.6;
    const H2 = rad * 1.0;
    const capW = rad * 0.35;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Long segment: from c to pt_corner1
    const pt_corner1X = c.x + outX * L1;
    const pt_corner1Y = c.y + outY * L1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(pt_corner1X, pt_corner1Y);
    ctx.stroke();

    // 2. Tick line crossing the long segment
    const pt_tickX = c.x + outX * (rad * 0.9);
    const pt_tickY = c.y + outY * (rad * 0.9);
    ctx.beginPath();
    ctx.moveTo(pt_tickX + perX * tickL, pt_tickY + perY * tickL);
    ctx.lineTo(pt_tickX - perX * tickL, pt_tickY - perY * tickL);
    ctx.stroke();

    // 3. Turn down: from pt_corner1 to pt_corner2
    const pt_corner2X = pt_corner1X + perX * H1;
    const pt_corner2Y = pt_corner1Y + perY * H1;
    ctx.beginPath();
    ctx.moveTo(pt_corner1X, pt_corner1Y);
    ctx.lineTo(pt_corner2X, pt_corner2Y);
    ctx.stroke();

    // 4. Semi-circular U-bend centered at cArc
    const cArcX = pt_corner2X + outX * R;
    const cArcY = pt_corner2Y + outY * R;
    ctx.beginPath();
    for (let step = 0; step <= 16; step++) {
      const angleVal = Math.PI + (step / 16) * Math.PI;
      const cosA = Math.cos(angleVal);
      const sinA = Math.sin(angleVal);
      const px_arc = cArcX + outX * R * cosA - perX * R * sinA;
      const py_arc = cArcY + outY * R * cosA - perY * R * sinA;
      if (step === 0) ctx.moveTo(px_arc, py_arc);
      else ctx.lineTo(px_arc, py_arc);
    }
    ctx.stroke();

    // 5. Riser going up from end of arc
    const pt_end_arcX = pt_corner2X + outX * (2 * R);
    const pt_end_arcY = pt_corner2Y + outY * (2 * R);
    const pt_riser_topX = pt_end_arcX - perX * H2;
    const pt_riser_topY = pt_end_arcY - perY * H2;
    ctx.beginPath();
    ctx.moveTo(pt_end_arcX, pt_end_arcY);
    ctx.lineTo(pt_riser_topX, pt_riser_topY);
    ctx.stroke();

    // 6. Cap line at the top of the riser
    ctx.beginPath();
    ctx.moveTo(pt_riser_topX + outX * capW, pt_riser_topY + outY * capW);
    ctx.lineTo(pt_riser_topX - outX * capW, pt_riser_topY - outY * capW);
    ctx.stroke();
  } else if (accType === 'codoSube') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (accType === 'codoBaja') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    const offset = rad * Math.SQRT1_2;
    ctx.moveTo(c.x - offset, c.y - offset);
    ctx.lineTo(c.x + offset, c.y + offset);
    ctx.moveTo(c.x + offset, c.y - offset);
    ctx.lineTo(c.x - offset, c.y + offset);
    ctx.stroke();
  } else if (accType === 'codo90rmSube') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (accType === 'codo90rmBaja') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const aS = rad * 0.7;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = rad * 0.15;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - aS * 0.9);
    ctx.lineTo(c.x, c.y + aS * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + aS * 0.9);
    ctx.lineTo(c.x - aS * 0.4, c.y + aS * 0.3);
    ctx.lineTo(c.x + aS * 0.4, c.y + aS * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (accType === 'codoReventilado') {
    // Proportioned off `rad` (real-world accessory size) rather than a fixed paper-mm constant,
    // so this scales down together with the wall-fitting fix like every other accessory symbol.
    const rf = rad / 1.6;
    const rRad = 1.2 * rf;
    const vLen = 1.6 * rf;
    const offset = rRad + 0.5 * rf;
    const cx1 = c.x - dx * offset, cy1 = c.y - dy * offset;
    const cx2 = c.x + dx * offset, cy2 = c.y + dy * offset;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5 * engine.zoom;
    ctx.beginPath();
    ctx.moveTo(cx1 - px * vLen, cy1 - py * vLen);
    ctx.lineTo(cx1 + px * vLen, cy1 + py * vLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx2 - px * vLen, cy2 - py * vLen);
    ctx.lineTo(cx2 + px * vLen, cy2 + py * vLen);
    ctx.stroke();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.beginPath();
    ctx.moveTo(cx1 - px * vLen, cy1 - py * vLen);
    ctx.lineTo(cx1 + px * vLen, cy1 + py * vLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx2 - px * vLen, cy2 - py * vLen);
    ctx.lineTo(cx2 + px * vLen, cy2 + py * vLen);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rRad + 0.2 * rf, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 0.35 * rf, 0, Math.PI * 2);
    ctx.fill();
  } else if (accType === 'valvCompuerta') {
    const triH = rad * 0.9;
    const triW = rad * 0.7;
    const stem = rad * 1.5;
    const capW = rad * 0.7;

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Filled triangle pointing perpendicular to ramal (along px,py)
    ctx.beginPath();
    ctx.moveTo(c.x + px * triH, c.y + py * triH);
    ctx.lineTo(c.x + dx * triW, c.y + dy * triW);
    ctx.lineTo(c.x - dx * triW, c.y - dy * triW);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stem from center perpendicular to ramal
    const stemEndX = c.x + px * stem;
    const stemEndY = c.y + py * stem;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.stroke();

    // T-bar cap at end of stem
    ctx.beginPath();
    ctx.moveTo(stemEndX - dx * capW, stemEndY - dy * capW);
    ctx.lineTo(stemEndX + dx * capW, stemEndY + dy * capW);
    ctx.stroke();
  } else if (accType === 'valvGlobo') {
    const circR = rad * 0.55;
    const stem = rad * 1.5;
    const capW = rad * 0.7;

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Filled circle centered on endpoint
    ctx.beginPath();
    ctx.arc(c.x, c.y, circR, 0, Math.PI * 2);
    ctx.fill();

    // Stem from center perpendicular to ramal
    const stemEndX = c.x + px * stem;
    const stemEndY = c.y + py * stem;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.stroke();

    // T-bar cap at end of stem
    ctx.beginPath();
    ctx.moveTo(stemEndX - dx * capW, stemEndY - dy * capW);
    ctx.lineTo(stemEndX + dx * capW, stemEndY + dy * capW);
    ctx.stroke();
  } else if (accType === 'valvCheque') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const tipX = c.x + dx * rad * 0.65;
    const tipY = c.y + dy * rad * 0.65;
    const baseX = c.x - dx * rad * 0.4;
    const baseY = c.y - dy * rad * 0.4;
    const perpX = px * rad * 0.3;
    const perpY = py * rad * 0.3;
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX - perpX, baseY - perpY);
    ctx.lineTo(baseX + perpX, baseY + perpY);
    ctx.closePath();
    ctx.fill();
  } else if (accType === 'valvAngulo') {
    const perX = -outY;
    const perY = outX;

    const vRad = rad * 1.35;
    const capW = vRad * 0.4;
    const L1 = vRad * 0.55;
    const triH = vRad * 0.65;
    const triW = vRad * 0.35;
    const L2 = vRad * 0.65;
    const L3 = vRad * 0.8;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.0 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. T-bar cap at the connection point c
    ctx.beginPath();
    ctx.moveTo(c.x + perX * capW, c.y + perY * capW);
    ctx.lineTo(c.x - perX * capW, c.y - perY * capW);
    ctx.stroke();

    // 2. Vertical line from c to junction P
    const pX = c.x + outX * L1;
    const pY = c.y + outY * L1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(pX, pY);
    ctx.stroke();

    // 3. Vertical triangle (pointing down along out)
    const v1X = pX + outX * triH + perX * triW;
    const v1Y = pY + outY * triH + perY * triW;
    const v2X = pX + outX * triH - perX * triW;
    const v2Y = pY + outY * triH - perY * triW;

    ctx.beginPath();
    ctx.moveTo(pX, pY);
    ctx.lineTo(v1X, v1Y);
    ctx.lineTo(v2X, v2Y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Line below the vertical triangle
    const baseVertX = pX + outX * triH;
    const baseVertY = pY + outY * triH;
    ctx.beginPath();
    ctx.moveTo(baseVertX, baseVertY);
    ctx.lineTo(baseVertX + outX * L2, baseVertY + outY * L2);
    ctx.stroke();

    // 5. Horizontal triangle (pointing right along per)
    const h1X = pX + perX * triH + outX * triW;
    const h1Y = pY + perY * triH + outY * triW;
    const h2X = pX + perX * triH - outX * triW;
    const h2Y = pY + perY * triH - outY * triW;

    ctx.beginPath();
    ctx.moveTo(pX, pY);
    ctx.lineTo(h1X, h1Y);
    ctx.lineTo(h2X, h2Y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Line extending from the horizontal triangle
    const baseHorizX = pX + perX * triH;
    const baseHorizY = pY + perY * triH;
    ctx.beginPath();
    ctx.moveTo(baseHorizX, baseHorizY);
    ctx.lineTo(baseHorizX + perX * L3, baseHorizY + perY * L3);
    ctx.stroke();
  } else if (accType === 'llaveTerminal') {
    const circR = rad * 0.5;
    const stem = rad * 1.5;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // White circle at the connection point (valve body)
    ctx.beginPath();
    ctx.arc(c.x, c.y, circR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Stem from center perpendicular to ramal
    const stemEndX = c.x + px * stem;
    const stemEndY = c.y + py * stem;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(stemEndX, stemEndY);
    ctx.stroke();

    // "T" terminal mark at the end of the stem
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${rad * 0.8}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', stemEndX, stemEndY);
  } else {
    if (accType.startsWith('tee') || accType === 'te_linea' || accType === 'te_ramal' || accType.startsWith('yee')) {
      return;
    }
    // Fallback text symbol for any other accessory
    let label = accType.substring(0, 3).toUpperCase();
    if (accType.startsWith('codo90')) label = 'C90';
    else if (accType.startsWith('codo45')) label = 'C45';
    else if (accType === 'codos_90_std' || accType === 'codos_90_rl') label = 'C90';
    else if (accType === 'valvula_bola') label = 'VB';
    else if (accType === 'valvPie') label = 'VP';
    else if (accType === 'reduccion') label = 'RED';
    else if (accType === 'ampliacion') label = 'AMP';

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2 * engine.zoom;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    // Sized off the circle's own radius (like every other accessory glyph) — a fixed zoom-based
    // minimum here would overflow the circle once it shrinks to a real-world-accurate size.
    ctx.font = `bold ${rad * 0.6}px 'Geist', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, c.x, c.y);
  }
}

export function renderRamales(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const isTributarioMode = engine.tipoTramo === 'tributario' && engine.tool === 'line';
  const padreId = engine.padreTributario;
  const drawnCrossings = new Set<string>();
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    const net = NETS.find((n) => n.id === r.net);
    const col = net ? net.col : '#e2e2e8';
    const sel = r.id === engine.selId;
    const isPadre = r.id === padreId;
    ctx.save();
    ctx.strokeStyle = col;
            ctx.lineWidth = (sel ? 3 : 2) * engine.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (r.pts.length > 1) {
      if (isPadre && isTributarioMode) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 3 * engine.zoom;
        ctx.strokeStyle = col;
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else if (r.tipo === 'tributario') {
        ctx.save();
        ctx.setLineDash([6, 4]);
        drawRamalPath(ctx, r.pts, engine, col);
        ctx.restore();
      } else {
        drawRamalPath(ctx, r.pts, engine, col);
      }
    }

    if (sel) {
      r.pts.forEach(([px, py], idx: number) => {
        if (idx > 0 && idx < r.pts.length - 1) {
          const cvsA = engine.toCvs(r.pts[idx - 1][0], r.pts[idx - 1][1]);
          const cvsB = engine.toCvs(px, py);
          const cvsC = engine.toCvs(r.pts[idx + 1][0], r.pts[idx + 1][1]);
          const ax = cvsB.x - cvsA.x, ay = cvsB.y - cvsA.y;
          const bx = cvsC.x - cvsB.x, by = cvsC.y - cvsB.y;
          const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
          if (lenA > 0 && lenB > 0) {
            const ux = -ax / lenA, uy = -ay / lenA;
            const vx = bx / lenB, vy = by / lenB;
            const cosAngle = ux * vx + uy * vy;
            // Hide intermediate collinear selection dots (straight line)
            if (cosAngle < -0.95) {
              return;
            }
          }
        }
        const c = engine.toCvs(px, py);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3 * engine.zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (isPadre && isTributarioMode && !engine.activeRamal && r.pts.length >= 2) {
      const mp = engine.snapPreviewToPadre(engine.mouseX, engine.mouseY);
      if (mp) {
        const c = engine.toCvs(mp.x, mp.y);
        ctx.save();
        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * engine.zoom;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5 * engine.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }



    if (r.label || r.totalL || r.material || r.diametro || r.pendiente) {
      const lc = engine.toCvs(r.labelX, r.labelY);
      const FLOW_NETS = ['san', 'll', 'af', 'ac'];
      const showFlow = FLOW_NETS.includes(r.net) && r.pts.length >= 2;
      let flowDx = 0, flowDy = 0, flowLen = 0;
      if (showFlow) {
        const fc = engine.toCvs(r.pts[0][0], r.pts[0][1]);
        const lastc = engine.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
        flowDx = lastc.x - fc.x;
        flowDy = lastc.y - fc.y;
        flowLen = Math.hypot(flowDx, flowDy);
      }
      
      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const lbl = r.label ? `${r.label}${lvlSuffix}` : '';
      const matPart = r.material || '';
      const dPart = r.diametro ? `D=${normalizeDnLabel(r.diametro.split(' — ')[0])}` : '';
      const pPart = r.pendiente ? `S=${r.pendiente}%` : '';
      const showPend = (r.net === 'san' || r.net === 'll');
      const pendPart = showPend && pPart ? pPart : '';
      const lblPart = r.totalL ? `L=${r.totalL.toFixed(2)}m` : '';

      const fsName = engine.mm2cvs(engine.MM.lblName * engine.labelScaleM);
      const fsInfo = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
      const lineHName = fsName + 2;
      const lineHInfo = fsName + 4;
      const boxPadX = engine.mm2cvs(1.0);
      const boxPadY = engine.mm2cvs(0.6);

      const infoSegs: Array<{ text: string; bold: boolean; w: number } | null> = [
        matPart ? { text: matPart, bold: false, w: 0 } : null,
        dPart ? { text: dPart, bold: true, w: 0 } : null,
        pendPart ? { text: pendPart, bold: false, w: 0 } : null,
        lblPart ? { text: lblPart, bold: false, w: 0 } : null,
      ].filter(Boolean) as Array<{ text: string; bold: boolean; w: number }>;
      const segSep = ' · ';
      let sepW = 0;
      ctx.font = `600 ${fsInfo}px Geist, monospace`;
      if (infoSegs.length > 1) sepW = ctx.measureText(segSep).width;
      for (const s of infoSegs) {
        ctx.font = s!.bold ? `bold ${fsInfo}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
        s!.w = ctx.measureText(s!.text).width;
      }
      const totalInfoW = infoSegs.reduce((sum: number, s, i) => sum + s!.w + (i < infoSegs.length - 1 ? sepW : 0), 0);

      ctx.font = `bold ${fsName}px Geist, monospace`;
      const nameW = lbl ? ctx.measureText(lbl).width : 0;
      const contentW = Math.max(nameW, totalInfoW);
      const boxW = contentW + boxPadX * 2;
      const boxH = (lbl ? lineHName : 0) + (infoSegs.length > 0 ? lineHInfo : 0) + boxPadY * 2;
      const drawX = lc.x;
      const drawY = lc.y;
      let labelAngleDeg = r.labelAngle != null ? r.labelAngle : 0;
      if ((r.labelAngle == null || r.labelAngle === 0) && r.pts && r.pts.length >= 2) {
        const dx = r.pts[1][0] - r.pts[0][0];
        const dy = r.pts[1][1] - r.pts[0][1];
        if (Math.abs(dy) > Math.abs(dx)) {
          labelAngleDeg = 90;
        }
      }
      const labelAngle = labelAngleDeg * Math.PI / 180;
      const cosA = Math.cos(labelAngle), sinA = Math.sin(labelAngle);
      const labelGap = -engine.mm2cvs(5);
      const gapOffX = -labelGap * sinA;
      const gapOffY = labelGap * cosA;
      const adjCx = drawX + gapOffX;
      const adjCy = drawY + gapOffY;

      const { corners, minX, minY, maxX, maxY } = rotatedRectCorners(adjCx, adjCy, boxW, boxH, labelAngle);
      r._labelBox = { cx: adjCx, cy: adjCy, w: boxW, h: boxH, angle: labelAngle, minX, minY, maxX, maxY, corners };

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(labelAngle);
      ctx.translate(0, labelGap);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (lbl) {
        ctx.font = `bold ${fsName}px Geist, monospace`;
        ctx.fillStyle = col;
        ctx.fillText(lbl, 0, -boxH / 2 + boxPadY + lineHName / 2);
      }
      if (infoSegs.length > 0) {
        const yInfo = boxH / 2 - boxPadY - lineHInfo / 2;
        let xCursor = -totalInfoW / 2;
        for (let i = 0; i < infoSegs.length; i++) {
          const s = infoSegs[i];
          ctx.font = s!.bold ? `bold ${fsInfo}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
          ctx.fillStyle = s!.bold ? '#000000' : '#1a1a1a';
          ctx.textAlign = 'left';
          ctx.fillText(s!.text, xCursor, yInfo);
          xCursor += s!.w;
          if (i < infoSegs.length - 1) {
            ctx.font = `600 ${fsInfo}px Geist, monospace`;
            ctx.fillStyle = '#1a1a1a';
            ctx.fillText(segSep, xCursor, yInfo);
            xCursor += sepW;
          }
        }
        ctx.textAlign = 'center';
      }

      if (showFlow && flowLen > 12 * engine.zoom) {
        const arrowY = boxH / 2 + 2 * engine.zoom;
        ctx.save();
        ctx.translate(0, arrowY);
        const dot = flowDx * cosA + flowDy * sinA;
        const dir = dot >= 0 ? 1 : -1;
        const halfSize = nameW ? nameW / 2 : 12 * engine.zoom;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1 * engine.zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-halfSize * dir, 0);
        ctx.lineTo(halfSize * dir, 0);
        ctx.stroke();
        const aSize = Math.min(6 * engine.zoom, halfSize * 0.6);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(halfSize * dir, 0);
        ctx.lineTo(halfSize * dir - dir * aSize, -aSize * 0.4);
        ctx.lineTo(halfSize * dir - dir * aSize, aSize * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else {
      r._labelBox = undefined;
    }

    ctx.restore();

    if (r.net === 'san' && r.pts.length >= 2) {
      const endpointIndices = [0, r.pts.length - 1];
      for (const idx of endpointIndices) {
        const connectedBaj = engine.bajantes.find((b) => {
          if (b.net !== 'san') return false;
          const bDisp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
          const bx = b.x + (bDisp ? bDisp.dx : 0);
          const by = b.y + (bDisp ? bDisp.dy : 0);
          return Math.hypot(bx - r.pts[idx][0], by - r.pts[idx][1]) < 0.5;
        });
        if (connectedBaj && connectedBaj.direccion) {
          const v = engine.toCvs(r.pts[idx][0], r.pts[idx][1]);
          const rad = engine.mm2cvs(2);
          const isSube = connectedBaj.direccion === 'sube';
          ctx.save();
          ctx.strokeStyle = col;
          ctx.fillStyle = '#ffffff';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.beginPath();
          ctx.arc(v.x, v.y, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (isSube) {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(v.x, v.y, rad * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }

    if (r.pts.length >= 2 && (r.id === engine.selId || (engine.multiSel || []).includes(r.id))) {
      let desvioBajante: any = null;
      const isDesvio = engine.bajantes.some((b) => {
        const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
        if (!disp || disp.Ldesvio !== r.id) return false;
        const gx = b.x + (disp.dx || 0), gy = b.y + (disp.dy || 0);
        const firstPt = r.pts[0], lastPt = r.pts[r.pts.length - 1];
        const nearParent = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
        const nearGhost = Math.hypot(lastPt[0] - gx, lastPt[1] - gy) < 0.5;
        if (nearParent && nearGhost) {
          desvioBajante = b;
          return true;
        }
        return false;
      });
      
      if (isDesvio && desvioBajante) {
        const firstPt = r.pts[0];
        const isSube = desvioBajante.direccion === 'sube';
        
        let startIdx = 0, nextIdx = 1;
        
        const firstIsParent = Math.hypot(firstPt[0] - desvioBajante.x, firstPt[1] - desvioBajante.y) < 0.5;
        if (isSube) {
          if (firstIsParent) {
            startIdx = r.pts.length - 1; nextIdx = r.pts.length - 2;
          } else {
            startIdx = 0; nextIdx = 1;
          }
        } else {
          if (firstIsParent) {
            startIdx = 0; nextIdx = 1;
          } else {
            startIdx = r.pts.length - 1; nextIdx = r.pts.length - 2;
          }
        }
        
        const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
        const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
        const adx = secondC.x - firstC.x, ady = secondC.y - firstC.y;
        const alen = Math.hypot(adx, ady);
        
        if (alen > 2) {
          const unx = adx / alen, uny = ady / alen;
          const arrowR = 10 * engine.zoom;
          const cx = firstC.x;
          const cy = firstC.y;
          ctx.save();
          ctx.fillStyle = '#FFEB3B';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx - unx * arrowR + uny * arrowR * 0.4, cy - uny * arrowR - unx * arrowR * 0.4);
          ctx.lineTo(cx - unx * arrowR - uny * arrowR * 0.4, cy - uny * arrowR + unx * arrowR * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else {
        let startIdx = 0;
        let nextIdx = 1;
        
        let isCodoReventiladoConnection = false;
        let codoEndIdx = -1;

        if (r.net === 'vent' || r.net === 'san') {
          const ventRamales = engine.ramales.filter((rm) => rm.net === 'vent');
          const sanRamales = engine.ramales.filter((rm) => rm.net === 'san');
          
          for (const vr of ventRamales) {
            for (const idx of [0, vr.pts.length - 1]) {
              const pt = vr.pts[idx];
              const connectsToSan = sanRamales.some((sr) =>
                sr.pts.some((sPt: number[]) => Math.hypot(pt[0] - sPt[0], pt[1] - sPt[1]) < 0.5)
              );
              if (connectsToSan) {
                const rEndIdx = [0, r.pts.length - 1].find(eIdx => Math.hypot(r.pts[eIdx][0] - pt[0], r.pts[eIdx][1] - pt[1]) < 0.5);
                if (rEndIdx !== undefined) {
                  isCodoReventiladoConnection = true;
                  codoEndIdx = rEndIdx;
                  break;
                }
              }
            }
            if (isCodoReventiladoConnection) break;
          }
        }

        if (r.net === 'san' && !isCodoReventiladoConnection) {
          for (const b of (engine.bajantes || [])) {
            if (b.net !== 'san') continue;
            if (!b.recibeDeIds?.includes(r.id)) continue;
            const firstPt = r.pts[0];
            const lastPt = r.pts[r.pts.length - 1];
            const bajanteNearFirst = Math.hypot(firstPt[0] - b.x, firstPt[1] - b.y) < 0.5;
            const bajanteNearLast = Math.hypot(lastPt[0] - b.x, lastPt[1] - b.y) < 0.5;
            if (bajanteNearFirst) {
              startIdx = r.pts.length - 1;
              nextIdx = r.pts.length - 2;
            } else if (bajanteNearLast) {
              startIdx = 0;
              nextIdx = 1;
            }
            break;
          }
        }

        if (isCodoReventiladoConnection && codoEndIdx !== -1) {
          startIdx = codoEndIdx === 0 ? r.pts.length - 1 : 0;
          nextIdx = startIdx === 0 ? 1 : r.pts.length - 2;
        } else if (r.net === 'vent' && r.pts[r.pts.length - 1][0] < r.pts[0][0]) {
          startIdx = r.pts.length - 1;
          nextIdx = r.pts.length - 2;
        }
        
        const firstC = engine.toCvs(r.pts[startIdx][0], r.pts[startIdx][1]);
        const secondC = engine.toCvs(r.pts[nextIdx][0], r.pts[nextIdx][1]);
        const adx = secondC.x - firstC.x, ady = secondC.y - firstC.y;
        const alen = Math.hypot(adx, ady);
        if (alen > 2) {
          const unx = adx / alen, uny = ady / alen;
          const arrowR = 10 * engine.zoom;
          const cx = firstC.x;
          const cy = firstC.y;
          ctx.save();
          ctx.fillStyle = '#FFEB3B';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx - unx * arrowR + uny * arrowR * 0.4, cy - uny * arrowR - unx * arrowR * 0.4);
          ctx.lineTo(cx - unx * arrowR - uny * arrowR * 0.4, cy - uny * arrowR + unx * arrowR * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    if ((r.tipo === 'tributario' || r.tipo === 'ramal') && ['san', 'af', 'ac', 'gas'].includes(r.net) && r.pts.length >= 2) {
      [0, r.pts.length - 1].forEach((idx) => {
        const accType = idx === 0 ? r.accesorioInicio : r.accesorioFin;
        if (!accType) return;

        const pt = r.pts[idx];
        const c = engine.toCvs(pt[0], pt[1]);

        let dx = 0, dy = 0;
        if (idx === 0) {
          dx = r.pts[1][0] - r.pts[0][0];
          dy = r.pts[1][1] - r.pts[0][1];
        } else {
          dx = r.pts[idx][0] - r.pts[idx - 1][0];
          dy = r.pts[idx][1] - r.pts[idx - 1][1];
        }
        const len = Math.hypot(dx, dy);
        if (len > 0.01) {
          dx /= len;
          dy /= len;
        } else {
          dx = 1;
          dy = 0;
        }
        const px = -dy, py = dx;
        const outX = idx === 0 ? -dx : dx;
        const outY = idx === 0 ? -dy : dy;

        const rad = engine.realMmToCanvasPx(23);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawExtremeAccessorySymbol(ctx, engine, accType, c, dx, dy, px, py, outX, outY, rad);
        ctx.restore();
      });

    }

  });

  // Draw mid-ramal accessories (accMed*) — accessories assigned to interior vertices via right-click
  // on the body of a ramal, instead of an endpoint. Direction is the bisector of the two adjacent
  // segments (an interior vertex has both an "in" and an "out" segment, unlike an endpoint).
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if (!r.accMed || !r.pts || r.pts.length < 3) return;

    for (const key of Object.keys(r.accMed)) {
      const m = key.match(/^accMed(\d+)$/);
      if (!m) continue;
      const idx = parseInt(m[1], 10);
      if (idx <= 0 || idx >= r.pts.length - 1) continue;
      const accType = r.accMed[key];
      if (!accType) continue;

      const pt = r.pts[idx];
      const c = engine.toCvs(pt[0], pt[1]);

      const dxIn = pt[0] - r.pts[idx - 1][0], dyIn = pt[1] - r.pts[idx - 1][1];
      const lenIn = Math.hypot(dxIn, dyIn);
      const dxOut = r.pts[idx + 1][0] - pt[0], dyOut = r.pts[idx + 1][1] - pt[1];
      const lenOut = Math.hypot(dxOut, dyOut);
      const uxIn = lenIn > 0.01 ? dxIn / lenIn : 1, uyIn = lenIn > 0.01 ? dyIn / lenIn : 0;
      const uxOut = lenOut > 0.01 ? dxOut / lenOut : uxIn, uyOut = lenOut > 0.01 ? dyOut / lenOut : uyIn;

      let dx = uxIn + uxOut, dy = uyIn + uyOut;
      const bisLen = Math.hypot(dx, dy);
      if (bisLen > 0.01) { dx /= bisLen; dy /= bisLen; } else { dx = uxIn; dy = uyIn; }
      const px = -dy, py = dx;

      const rad = engine.realMmToCanvasPx(23);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawExtremeAccessorySymbol(ctx, engine, accType, c, dx, dy, px, py, px, py, rad);
      ctx.restore();
    }
  });

  // Draw all bilateral crossings (teeBilateral) - white circle with black border and '+' at perpendicular crossings
  engine.ramales.forEach((r) => {
    if (engine._hiddenNets.has(r.net)) return;
    if ((r.net === 'af' || r.net === 'ac') && r.bilateralCrossings && r.bilateralCrossings.length > 0) {
      const rad = engine.realMmToCanvasPx(23);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const cp of r.bilateralCrossings) {
        const key = `${cp[0].toFixed(2)},${cp[1].toFixed(2)}`;
        if (drawnCrossings.has(key)) continue;
        drawnCrossings.add(key);

        const c = engine.toCvs(cp[0], cp[1]);

        // Find direction vectors of the crossing
        let dir1 = { x: 1, y: 0 };
        let dir2 = { x: 0, y: 1 };
        let foundCount = 0;
        const TOL = 0.5;

        for (const rm of engine.ramales) {
          if (rm.net !== r.net) continue;
          if (!rm.pts || rm.pts.length < 2) continue;
          for (let i = 0; i < rm.pts.length - 1; i++) {
            const p1 = rm.pts[i];
            const p2 = rm.pts[i + 1];
            const dist = pointToSegmentDist(cp[0], cp[1], p1[0], p1[1], p2[0], p2[1]);
            if (dist < TOL) {
              const dx = p2[0] - p1[0];
              const dy = p2[1] - p1[1];
              const len = Math.hypot(dx, dy);
              if (len > 0.001) {
                if (foundCount === 0) {
                  dir1 = { x: dx / len, y: dy / len };
                  foundCount++;
                } else {
                  dir2 = { x: dx / len, y: dy / len };
                  foundCount++;
                  break;
                }
              }
            }
          }
          if (foundCount >= 2) break;
        }

        if (foundCount < 2) {
          dir2 = { x: -dir1.y, y: dir1.x };
        }

        const armLen = rad * 1.5;
        const capW = rad * 0.45;
        const maskW = 3.5 * engine.zoom;
        const lineW = 1.5 * engine.zoom;

        const dirs = [
          dir1,
          { x: -dir1.x, y: -dir1.y },
          dir2,
          { x: -dir2.x, y: -dir2.y }
        ];

        // 1. Draw white mask (thick lines) to clear the pipe underneath
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = maskW;
        ctx.beginPath();
        for (const d of dirs) {
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + d.x * armLen, c.y + d.y * armLen);
        }
        ctx.stroke();

        // 2. Draw black lines (thinner)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = lineW;
        ctx.beginPath();
        for (const d of dirs) {
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + d.x * armLen, c.y + d.y * armLen);
        }
        ctx.stroke();

        // 3. Draw the four T-bar caps at the ends of each arm
        ctx.beginPath();
        for (const d of dirs) {
          const endX = c.x + d.x * armLen;
          const endY = c.y + d.y * armLen;
          const perpX = -d.y;
          const perpY = d.x;
          ctx.moveTo(endX - perpX * capW, endY - perpY * capW);
          ctx.lineTo(endX + perpX * capW, endY + perpY * capW);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  });

  renderJunctions(ctx, engine);
  renderVentCodos(ctx, engine);
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n) => n.id === ar.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2 * engine.zoom;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ar.pts.length > 1) {
    drawRamalPath(ctx, ar.pts, engine, col);
  }

  ar.pts.forEach((pt: number[], idx: number) => {
    const px = pt[0], py = pt[1];
    const c = engine.toCvs(px, py);
    ctx.save();
    ctx.fillStyle = idx === 0 ? '#fff' : col;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const first = ar.pts[0];
  const last = ar.pts[ar.pts.length - 1];
  let mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const origMp = { x: mp.x, y: mp.y };
  
  let snapped = false;

  if (engine.snapMode) {
    mp = engine.snapAngle(last[0], last[1], mp.x, mp.y);
  }

  const activeRamales = engine.ramales.filter((r) => r.net === engine.activeNet);
  for (const r of activeRamales) {
    if (r.id === ar.id) continue;
    let segSp = null;
    if (engine.snapMode) {
      segSp = snapTributaryToPadre45Deg(mp.x, mp.y, last[0], last[1], r.pts, 20 / engine.zoom);
    } else {
      segSp = engine._snapToSegment(mp.x, mp.y, r.pts, 20 / engine.zoom);
    }
    if (segSp) {
      mp = segSp;
      snapped = true;
      break;
    }
  }

  if (!snapped) {
    const sp = engine.snapToExisting(mp.x, mp.y);
    if (sp) mp = sp;
  }

  const bajThresh = 20 / engine.zoom;
  const nearBaj = engine.bajantes.find((b) => {
    if (engine._hiddenNets.has(b.net) || b.net !== ar.net) return false;
    return Math.hypot(origMp.x - b.x, origMp.y - b.y) < bajThresh;
  });
  if (nearBaj) {
    mp = { x: nearBaj.x, y: nearBaj.y };
    snapped = true;
    const bc = engine.toCvs(nearBaj.x, nearBaj.y);
    ctx.save();
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(bc.x, bc.y, 12 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.15)';
    ctx.beginPath();
    ctx.arc(bc.x, bc.y, 12 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (ar.pts.length >= 3 && distFirst < SNAP_CLOSE) {
    const fc = engine.toCvs(first[0], first[1]);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2 * engine.zoom;
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10 * engine.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10 * engine.zoom, 0, Math.PI * 2);
    ctx.fill();
    mp = { x: first[0], y: first[1] };
  }

  const lc = engine.toCvs(last[0], last[1]);
  const mc = engine.toCvs(mp.x, mp.y);

  ctx.strokeStyle = col + '88';
  ctx.lineWidth = 2 * engine.zoom;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(lc.x, lc.y);
  ctx.lineTo(mc.x, mc.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const segPx = Math.hypot(mp.x - last[0], mp.y - last[1]);
  const segM = +(engine.pxToM(segPx).toFixed(2));
  const deg = Math.atan2(mp.y - last[1], mp.x - last[0]) * 180 / Math.PI;
  const cursorLabel = `${segM} m  ${Math.round(((deg % 360) + 360) % 360)}°`;
  ctx.font = `${engine.mm2cvs(engine.MM.coord * engine.labelScaleM)}px Geist, monospace`;
  const tw = ctx.measureText(cursorLabel).width;
  ctx.fillStyle = 'rgba(17,19,23,0.82)';
  ctx.fillRect(mc.x + 12, mc.y - 18, tw + 8, 16);
  ctx.fillStyle = '#e2e2e8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cursorLabel, mc.x + 16, mc.y - 10);

  ctx.restore();
}
