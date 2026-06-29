import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../Coords';
import type { IPlanoEngineCore } from '../PlanoState';

const DIR_MAP: Record<string, string> = { sube: 'Sube', baja: 'Baja', continua: 'Continua' };

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.bajantes.forEach((b: any) => {
    if (engine._hiddenNets.has(b.net)) return;

    const c = engine.toCvs(b.x, b.y);
    const sel = b.id === engine.selId;
    const r = 10 * engine.zoom;

    // Item 2: Label angle + snap constraint (Auto-rotation removed as requested)
    const angle = (b.labelAngle || 0) * Math.PI / 180;


    b._circ = { x: c.x, y: c.y, r: Math.max(22 * engine.zoom, r + 8) };

    if (b.recibeDeIds?.length) {
      b.recibeDeIds.forEach((rid: string) => {
        const ram = engine.ramales.find((rr: any) => rr.id === rid);
        if (ram) {
          const pStart = ram.pts[0];
          const pEnd = ram.pts[ram.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - b.x, pStart[1] - b.y);
          const distEnd = Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y);
          const bestPt = distStart < distEnd ? pStart : pEnd;
          const rc = engine.toCvs(bestPt[0], bestPt[1]);
          ctx.save();
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.setLineDash([4 * engine.zoom, 3 * engine.zoom]);
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

      // Only draw line to ramal if the target ramal is on the CURRENT floor
      if (String(targetPlanId) === String(engine._loadedPlanId)) {
        const ram = engine.ramales.find((rr: any) => rr.id === targetId);
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
      }
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#ffffff';
    if (b.tipo === 'red_publica' || b.tipo === 'contador') {
      const netObj = NETS.find((n: any) => n.id === (b.net === 'gas' ? 'gas' : 'af'));
      const col = netObj ? netObj.col : (b.net === 'gas' ? '#A855F7' : '#4D8FF7');
      ctx.fillStyle = b.tipo === 'red_publica' ? '#64748b' : col;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : (b.tipo === 'red_publica' ? '#475569' : col);
      ctx.lineWidth = (sel ? 4.5 : 2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else if (b.tipo === 'calentador') {
      const netObj = NETS.find((n: any) => n.id === (b.net === 'gas' ? 'gas' : 'ac'));
      const col = netObj ? netObj.col : (b.net === 'gas' ? '#A855F7' : '#F04545');
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.fill();
      ctx.strokeStyle = sel ? '#FFEB3B' : col;
      ctx.lineWidth = (sel ? 4.5 : 2) * engine.zoom;
      ctx.beginPath();
      ctx.rect(-r, -r, r * 2, r * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = b.tipo === 'bajante' ? '#F04545' : '#3B82F6';
      ctx.lineWidth = (sel ? 4.5 : 3.5) * engine.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const arrowCol = b.tipo === 'bajante' ? '#F04545' : '#3B82F6';
    if (b.tipo === 'red_publica') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RP', 0, 0);
    } else if (b.tipo === 'contador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 0);

      // Draw arrow entering from the bottom of the box, saying "Red Pública"
      ctx.save();
      const zoom = engine.zoom;
      const arrowColor = '#64748b'; // grey color
      ctx.strokeStyle = arrowColor;
      ctx.fillStyle = arrowColor;
      ctx.lineWidth = 2.5 * zoom; // thicker line

      // Vertical line: from (0, r + 24 * zoom) to (0, r + 5 * zoom)
      ctx.beginPath();
      ctx.moveTo(0, r + 24 * zoom);
      ctx.lineTo(0, r + 5 * zoom);
      ctx.stroke();

      // Arrow head pointing up at (0, r + 3 * zoom)
      ctx.beginPath();
      ctx.moveTo(0, r + 3 * zoom);
      ctx.lineTo(-5 * zoom, r + 11 * zoom);
      ctx.lineTo(5 * zoom, r + 11 * zoom);
      ctx.closePath();
      ctx.fill();

      // Text "Red Pública" centered under the arrow
      ctx.font = `bold ${r * 0.7}px sans-serif`; // larger text
      ctx.textBaseline = 'top';
      ctx.fillText('Red Pública', 0, r + 28 * zoom);
      ctx.restore();
    } else if (b.tipo === 'calentador') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${r * 0.9}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', 0, 0);
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
      ctx.font = `${engine.mm2cvs(engine.MM.flowEmoji * engine.labelScaleM)}px sans-serif`;
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
      const arrowR = 12 * engine.zoom;
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

    if (b.code || b.code === '') {
      const offDx = (b.labelX - b.x) * engine.zoom;
      let offDy = (b.labelY - b.y) * engine.zoom;

      // Item 2: Enforce minimum perpendicular offset so label doesn't sit on the ramal
      const minPerpPx = engine.mm2cvs(3);
      if (Math.abs(offDy) < minPerpPx) {
        offDy = offDy >= 0 ? minPerpPx : -minPerpPx;
      }

      ctx.save();
      ctx.translate(c.x, c.y);

      // Leader line from circle edge to label (shortest distance)
      const distToLabel = Math.hypot(offDx, offDy);
      let lineStartX = 0, lineStartY = 0;
      if (distToLabel > 0.1) {
        const ux = offDx / distToLabel, uy = offDy / distToLabel;
        lineStartX = r * ux;
        lineStartY = r * uy;
      }
      ctx.beginPath();
      ctx.moveTo(lineStartX, lineStartY);
      ctx.lineTo(offDx, offDy);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.stroke();

      ctx.translate(offDx, offDy);
      ctx.rotate(angle);
      const fsCode = engine.mm2cvs(engine.MM.lblCode * engine.labelScaleM * 1.35);
      const fsDir = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * 1.35);
      const lineH = fsCode + 2;
      
      const codeStr = (b.code || '').replace(/#/g, '');
      let diamStr = '';
      if (b.dNominal && b.dNominal !== '0') {
        const v = String(b.dNominal).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = v;
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = v;
          }
        }
      } else if (b.diametro) {
        diamStr = b.diametro.split(' — ')[0];
      }
      if (b.net === 'gas' && diamStr && !diamStr.endsWith('"')) {
        diamStr += '"';
      }
      const line1 = diamStr ? `${codeStr}  D=${diamStr}` : (codeStr || '—');
      
      // Direction text
      const dirText = DIR_MAP[b.direccion] || '';
      const hasDir = !!dirText;
      
      ctx.font = `bold ${fsCode}px Geist, monospace`;
      const tw1 = ctx.measureText(line1).width;
      const boxW = tw1 + engine.mm2cvs(4);
      const boxH = hasDir ? lineH + 2 + fsDir + engine.mm2cvs(1.5) : lineH + engine.mm2cvs(1);
      const hh2 = boxH / 2;
      
      const lbCx = c.x + offDx;
      const lbCy = c.y + offDy;
      const { corners: corners2, minX, minY, maxX, maxY } = rotatedRectCorners(lbCx, lbCy - 10 + hh2, boxW, boxH, angle, 2);
      b._labelBox = { cx: lbCx, cy: lbCy - 10 + hh2, w: boxW, h: boxH, angle, minX, minY, maxX, maxY, corners: corners2 };
      
      // Background (White)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -10, boxW, boxH, 2);
      ctx.fill();

      // Line 1: code + diameter
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(line1, 0, -10 + engine.mm2cvs(0.5));

      // Direction text (no separator line — drawn directly below code)
      if (dirText) {
        ctx.font = `${fsDir}px Geist, monospace`;
        ctx.fillStyle = '#000';
        ctx.fillText(dirText, 0, -10 + lineH + engine.mm2cvs(1));
      }
      ctx.restore();
    } else {
      b._labelBox = null;
    }
  });
}

export function renderGhosts(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const fg = engine.getBajantesFantasma();
  fg.forEach((b: any) => {
    const net = NETS.find((n: any) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
    const gx = b.x + (disp ? disp.dx : 0);
    const gy = b.y + (disp ? disp.dy : 0);
    const c = engine.toCvs(gx, gy);
    const r = 8 * engine.zoom;
    b._ghost = { x: c.x, y: c.y, r: Math.max(24, r + 10) };

    // Item 6: Label angle + snap constraint (Auto-rotation removed as requested)
    const ghostAngle = (b.labelAngle || 0) * Math.PI / 180;

    // Ghost circle + symbol
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5 * engine.zoom;
    ctx.setLineDash([5 * engine.zoom, 4 * engine.zoom]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
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
      ctx.font = `${engine.mm2cvs(engine.MM.flowEmoji * engine.labelScaleM)}px sans-serif`;
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
    ctx.setLineDash([]);
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
      const arrowR = 12 * engine.zoom;
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

    // Item 6: Ghost label — only for displacement-based ghosts (not direction-only)
    const isDespGhost = b.isFantasma || (b.desplazamientos && Object.keys(b.desplazamientos).length > 0);
    if (isDespGhost && (b.code || b.code === '')) {
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

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.translate(c.x, c.y);

      const ghostR = 8 * engine.zoom;
      const ghostDist = Math.hypot(offDx, offDy);
      let gLineStartX = 0, gLineStartY = 0;
      if (ghostDist > 0.1) {
        const ux = offDx / ghostDist, uy = offDy / ghostDist;
        gLineStartX = ghostR * ux;
        gLineStartY = ghostR * uy;
      }
      ctx.beginPath();
      ctx.moveTo(gLineStartX, gLineStartY);
      ctx.lineTo(offDx, offDy);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5 * engine.zoom;
      ctx.stroke();

      ctx.translate(offDx, offDy);
      ctx.rotate(ghostAngle);
      const fsCode = engine.mm2cvs(engine.MM.lblCode * engine.labelScaleM * 1.35);
      const fsDir = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * 1.35);
      const lineH = fsCode + 2;

      const codeStr = (b.code || '').replace(/#/g, '');
      const ghostDir = gd?.direccion || b.direccion;
      const ghostDNom = gd?.dNominal || b.dNominal;
      let diamStr = '';
      if (b.diametro) {
        diamStr = b.diametro.split(' — ')[0];
      } else if (ghostDNom && ghostDNom !== '0') {
        const v = String(ghostDNom).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = v;
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = v;
          }
        }
      }
      if (b.net === 'gas' && diamStr && !diamStr.endsWith('"')) {
        diamStr += '"';
      }
      const line1 = diamStr ? `${codeStr}  D=${diamStr}` : (codeStr || '—');

      const dirText = DIR_MAP[ghostDir] || '';
      const hasDir = !!dirText;

      ctx.font = `bold ${fsCode}px Geist, monospace`;
      const tw1 = ctx.measureText(line1).width;
      const boxW = tw1 + engine.mm2cvs(4);
      const boxH = hasDir ? lineH + 2 + fsDir + engine.mm2cvs(1.5) : lineH + engine.mm2cvs(1);
      const hh2 = boxH / 2;

      const lbCx = c.x + offDx;
      const lbCy = c.y + offDy;
      const { corners: corners2, minX, minY, maxX, maxY } = rotatedRectCorners(lbCx, lbCy - 10 + hh2, boxW, boxH, ghostAngle, 2);
      b._ghostLabelBox = { cx: lbCx, cy: lbCy - 10 + hh2, w: boxW, h: boxH, angle: ghostAngle, minX, minY, maxX, maxY, corners: corners2 };

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -10, boxW, boxH, 2);
      ctx.fill();

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
    }
  });
}
