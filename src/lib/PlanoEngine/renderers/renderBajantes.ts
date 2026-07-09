import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../HitTester';
import type { IPlanoEngineCore } from '../PlanoState';
import { normalizeDnLabel } from '../../../utils/formatUtils';


const DIR_MAP: Record<string, string> = { sube: 'Sube', baja: 'Baja', continua: 'Continua' };

function getPisoCorto(v: unknown): string {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (isNaN(n)) return '';
  if (n < 0) return `S${Math.abs(n)}`;
  if (n === 99) return 'C';
  return `P${n}`;
}

function renderBajanteLabel(
  ctx: CanvasRenderingContext2D,
  engine: IPlanoEngineCore,
  b: any,
  c: { x: number; y: number },
  r: number,
  angle: number,
  offDx: number,
  offDy: number,
  line1: string,
  dirText: string,
  labelBoxProp: '_labelBox' | '_ghostLabelBox',
  alpha: number
): void {
  const hasDir = !!dirText;

  const fsCode = engine.mm2cvs(engine.MM.lblCode * engine.labelScaleM * 1.35);
  const fsDir = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * 1.35);
  const lineH = fsCode + 2;

  ctx.save();
  ctx.font = `bold ${fsCode}px Geist, monospace`;
  const tw1 = ctx.measureText(line1).width;
  const boxW = tw1 + engine.mm2cvs(4);
  const boxH = hasDir ? lineH + 2 + fsDir + engine.mm2cvs(1.5) : lineH + engine.mm2cvs(1);
  const hh2 = boxH / 2;

  const intersection = getLabelIntersection(offDx, offDy, boxW, boxH, angle);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(c.x, c.y);

  const distToLabel = Math.hypot(offDx, offDy);
  let lineStartX = 0, lineStartY = 0;
  if (distToLabel > 0.1) {
    const ux = offDx / distToLabel, uy = offDy / distToLabel;
    lineStartX = r * ux;
    lineStartY = r * uy;
  }
  ctx.beginPath();
  ctx.moveTo(lineStartX, lineStartY);
  ctx.lineTo(intersection.x, intersection.y);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.8 * engine.zoom;
  ctx.stroke();

  ctx.translate(offDx, offDy);
  ctx.rotate(angle);

  const lbCx = c.x + offDx;
  const lbCy = c.y + offDy;
  const { corners: corners2, minX, minY, maxX, maxY } = rotatedRectCorners(lbCx, lbCy - 10 + hh2, boxW, boxH, angle, 2);
  b[labelBoxProp] = { cx: lbCx, cy: lbCy - 10 + hh2, w: boxW, h: boxH, angle, minX, minY, maxX, maxY, corners: corners2 };

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-boxW / 2, -10, boxW, boxH, 0);
  ctx.fill();

  if (b.tipo === 'contador' || b.tipo === 'calentador') {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.8 * engine.zoom;
    ctx.stroke();
  }

  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(line1, 0, -10 + engine.mm2cvs(0.5));

  if (dirText) {
    ctx.font = `${fsDir}px Geist, monospace`;
    ctx.fillStyle = '#000';
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
  angle: number
): { x: number; y: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const localStartX = -offDx * cosA - offDy * sinA;
  const localStartY =  offDx * sinA - offDy * cosA;

  const xMin = -boxW / 2;
  const xMax = boxW / 2;
  const yMin = -10;
  const yMax = -10 + boxH;

  let tEnter = 0;
  let tExit = 1;

  if (localStartX !== 0) {
    const t1 = 1 - (xMin / localStartX);
    const t2 = 1 - (xMax / localStartX);
    const tMin = Math.min(t1, t2);
    const tMax = Math.max(t1, t2);
    tEnter = Math.max(tEnter, tMin);
    tExit = Math.min(tExit, tMax);
  }

  if (localStartY !== 0) {
    const t1 = 1 - (yMin / localStartY);
    const t2 = 1 - (yMax / localStartY);
    const tMin = Math.min(t1, t2);
    const tMax = Math.max(t1, t2);
    tEnter = Math.max(tEnter, tMin);
    tExit = Math.min(tExit, tMax);
  }

  tEnter = Math.max(0, Math.min(1, tEnter));

  const localIntersectX = localStartX * (1 - tEnter);
  const localIntersectY = localStartY * (1 - tEnter);

  const intersectDx = localIntersectX * cosA - localIntersectY * sinA + offDx;
  const intersectDy = localIntersectX * sinA + localIntersectY * cosA + offDy;

  return { x: intersectDx, y: intersectDy };
}

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.bajantes.forEach((b) => {
    if (engine._hiddenNets.has(b.net)) return;

    // A bajante displaced on ITS OWN level still needs its solid circle here — displacement
    // just repositions the ghost decoration elsewhere for decluttering, it doesn't replace the
    // real symbol. Only a genuine pass-through ghost on a REMOTE floor (not this bajante's own
    // pisoBase, and not explicitly displaced on this level) should skip the solid circle.
    const isDisplacedOnThisLevel = b.tipo === 'contador' || b.tipo === 'calentador' || b.tipo === 'red_publica'
      ? false
      : (!!b.desplazamientos?.[engine.nivelActual?.label ?? '']);
    const isDirectionGhost = !isDisplacedOnThisLevel && b.pisoBase !== engine.nivelActual?.label;

    const c = engine.toCvs(b.x, b.y);
    // When this bajante is a remote-floor ghost, never draw the thick yellow selection border.
    const sel = b.id === engine.selId && !engine._isGhostSel && !isDirectionGhost;
    const r = engine.realMmToCanvasPx(20);

    // Item 2: Label angle + snap constraint (Auto-rotation removed as requested)
    const angle = (b.labelAngle || 0) * Math.PI / 180;


    b._circ = { x: c.x, y: c.y, r };
    if (isDirectionGhost) return;

    // Draw green dashed lines from ramales that feed this bajante (recibeDeIds)
    if (b.recibeDeIds?.length) {
      b.recibeDeIds.forEach((rid: string) => {
        const ram = engine.ramales.find((rr) => rr.id === rid);
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
          ctx.moveTo(rc.x, rc.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    if (b.descargaEnId) {
      const parts = b.descargaEnId.includes('|') ? b.descargaEnId.split('|') : [engine._loadedPlanId, b.descargaEnId];
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
      const devW = r * 2; const devH = r * 2.4;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : '#A855F7';
      ctx.lineWidth = (sel ? 2.5 : 1.2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-devW / 2, -devH / 2, devW, devH);
      ctx.stroke();
      const dispW = devW * 0.6; const dispH = devH * 0.12;
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
      const col = netObj ? netObj.col : (b.net === 'gas' ? '#A855F7' : '#F04545');
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
      ctx.lineWidth = (sel ? 2.5 : 1.5) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const arrowCol = b.tipo === 'bajante' ? '#F04545' : '#3B82F6';
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
    } else if (b.direccion === 'sube') {
      ctx.fillStyle = arrowCol;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.direccion === 'baja') {
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
    } else if (b.direccion === 'continua') {
      ctx.fillStyle = arrowCol;
      // Sized off the circle radius (like the other direction symbols), not the independent
      // label font scale — otherwise this arrow doesn't shrink along with the real-world circle.
      ctx.font = `${r * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('➜', 0, 0);
    } else if (!b.direccion && !b.desplazamientos?.[engine.nivelActual?.label ?? '']) {
      // Default fallback if no direction and no displacement:
      // draw down arrow for bajante, up arrow for montante
      const aS = r * 0.7;
      ctx.strokeStyle = arrowCol;
      ctx.lineWidth = r * 0.15;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      if (b.tipo === 'bajante') {
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
      const ly = b.labelY ?? (b.y + 20);
      const offDx = (lx - b.x) * engine.zoom;
      let offDy = (ly - b.y) * engine.zoom;

      // Item 2: Enforce minimum perpendicular offset so label doesn't sit on the ramal
      const minPerpPx = engine.mm2cvs(3);
      if (Math.abs(offDy) < minPerpPx) {
        offDy = offDy >= 0 ? minPerpPx : -minPerpPx;
      }

      const pCorto = getPisoCorto(engine.nivelActual?.n);
      const lvlSuffix = pCorto ? `-${pCorto}` : '';
      const codeStr = (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
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
      const line1 = diamStr ? `${codeStr}  D=${diamStr}` : (codeStr || '—');
      const dirText = DIR_MAP[b.direccion ?? ''] || '';
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
    const r = engine.realMmToCanvasPx(20);
    b._ghost = { x: c.x, y: c.y, r };

    // Ghost label always horizontal
    const ghostAngle = 0;

    // Ghost circle always visible, dotted style
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.setLineDash([5 * engine.zoom, 4 * engine.zoom]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const gd = b.ghostData?.[engine.nivelActual?.label ?? ''];
    let ghostDir = b.direccion;
    if (gd && gd.direccion !== undefined) {
      ghostDir = gd.direccion;
    }
    let ghostSymbol = '';
    if (ghostDir === 'sube') ghostSymbol = '•';
    else if (ghostDir === 'baja') ghostSymbol = '⬇';
    else if (ghostDir === 'continua') ghostSymbol = '➜';
    else if (!ghostDir && b.desplazamientos?.[engine.nivelActual?.label ?? '']) ghostSymbol = '';
    else ghostSymbol = b.tipo === 'bajante' ? '⬇' : '⬆';

    if (ghostSymbol) {
      // Sized off the ghost's own circle radius, not the independent label font scale.
      ctx.font = `${r * 1.1}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (ghostSymbol === '•') {
         ctx.beginPath();
         ctx.arc(c.x, c.y, r * 0.25, 0, Math.PI * 2);
         ctx.fill();
      } else {
         ctx.fillText(ghostSymbol, c.x, c.y);
      }
    }
    ctx.restore();

    // Displacement line
    if (disp && (Math.abs(disp.dx) > 1 || Math.abs(disp.dy) > 1)) {
      const orig = engine.toCvs(b.x, b.y);
      ctx.save();
      ctx.strokeStyle = col + '66';
      ctx.lineWidth = 1 * engine.zoom;
      ctx.setLineDash([3 * engine.zoom, 3 * engine.zoom]);
      ctx.beginPath();
      ctx.moveTo(orig.x, orig.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
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
      const codeStr = (b.code ? b.code.replace(/#/g, '').toUpperCase() : '') + (b.code ? lvlSuffix : '');
      const ghostDir = gd?.direccion || b.direccion;
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
      const line1 = diamStr ? `${codeStr}  D=${diamStr}` : (codeStr || '—');
      const dirText = DIR_MAP[ghostDir ?? ''] || '';
      renderBajanteLabel(ctx, engine, b, c, r, ghostAngle, offDx, offDy, line1, dirText, '_ghostLabelBox', 0.35);
    }

  });
}
