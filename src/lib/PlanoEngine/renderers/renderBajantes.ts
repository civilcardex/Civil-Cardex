import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../Coords';
import type { IPlanoEngineCore } from '../PlanoEngineTypes';

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.bajantes.forEach((b: any) => {
    if (engine._hiddenNets.has(b.net)) return;
    const net = NETS.find((n: any) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const c = engine.toCvs(b.x, b.y);
    const sel = b.id === engine.selId;
    const r = Math.max(4, 4 * engine.zoom);
    const angle = (b.labelAngle || 0) * Math.PI / 180;
    b._circ = { x: c.x, y: c.y, r: Math.max(50, r + 10) };

    if (b.recibeDeIds?.length) {
      b.recibeDeIds.forEach((rid: string) => {
        const ram = engine.ramales.find((rr: any) => rr.id === rid);
        if (ram) {
          const last = ram.pts[ram.pts.length - 1];
          const rc = engine.toCvs(last[0], last[1]);
          ctx.save();
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
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
          const first = ram.pts[0];
          const rc = engine.toCvs(first[0], first[1]);
          ctx.save();
          ctx.strokeStyle = '#0ECC7A';
          ctx.lineWidth = 2;
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
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.tipo === 'bajante' ? '#F04545' : '#3B82F6';
    ctx.lineWidth = sel ? 4.5 : 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    if (b.net === 'san' && b.direccion) {
      if (b.direccion === 'sube') {
        ctx.fillStyle = b.tipo === 'bajante' ? '#F04545' : '#3B82F6';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.tipo === 'bajante') {
      const aS = r * 0.7;
      ctx.strokeStyle = '#F04545';
      ctx.lineWidth = r * 0.15;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(0, aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#F04545';
      ctx.beginPath();
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(-aS * 0.4, aS * 0.3);
      ctx.lineTo(aS * 0.4, aS * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
      const aS = r * 0.7;
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = r * 0.15;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(0, -aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(-aS * 0.4, -aS * 0.3);
      ctx.lineTo(aS * 0.4, -aS * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    // Yellow selection arrow (same style as ramales)
    if (sel) {
      const arrowR = 16;
      const ox = r + 14;
      ctx.save();
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, 0);
      ctx.lineTo(ox, -arrowR * 0.5);
      ctx.lineTo(ox, arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (b.code || b.code === '') {
      const offDx = (b.labelX - b.x) * engine.zoom;
      const offDy = (b.labelY - b.y) * engine.zoom;
      
      // Leader line
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(offDx, offDy);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(offDx, offDy);
      const fsCode = engine.mm2cvs(engine.MM.lblCode * engine.labelScaleM);
      const fsDir = engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM);
      const lineH = fsCode + 2;
      
      const codeStr = (b.code || '').replace(/#/g, '');
      let diamStr = '';
      if (b.diametro) {
        diamStr = b.diametro.split(' — ')[0];
      } else if (b.dNominal && b.dNominal !== '0') {
        const v = String(b.dNominal).trim();
        if (v.includes('"') || v.includes('mm')) {
          diamStr = v;
        } else {
          const numV = Number(v);
          if (!isNaN(numV)) {
            // Si es menor a 20, asumimos que son pulgadas (ej. 2, 4, 6)
            diamStr = numV < 20 ? `${numV}"` : `${numV}mm`;
          } else {
            diamStr = v;
          }
        }
      }
      const line1 = diamStr ? `${codeStr}  ${diamStr}` : (codeStr || '—');
      
      // Direction line for sanitary
      const dirText = b.net === 'san' && b.direccion === 'sube' ? 'Sube' : b.net === 'san' && b.direccion === 'baja' ? 'Baja' : '';
      const hasDir = !!dirText;
      
      ctx.font = `bold ${fsCode}px Geist, monospace`;
      const tw1 = ctx.measureText(line1).width;
      const boxW = tw1 + engine.mm2cvs(4);
      const boxH = hasDir ? lineH + 2 + fsDir + engine.mm2cvs(1.5) : lineH + engine.mm2cvs(1);
      const hh2 = boxH / 2;
      
      const lbCx = c.x + offDx * Math.cos(angle) - offDy * Math.sin(angle);
      const lbCy = c.y + offDx * Math.sin(angle) + offDy * Math.cos(angle);
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
      
      // Separator line
      const sepY = -10 + lineH + 1;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-boxW / 2, sepY);
      ctx.lineTo(boxW / 2, sepY);
      ctx.stroke();
      
      // Direction text below line
      if (hasDir) {
        ctx.font = `${fsDir}px Geist, monospace`;
        ctx.fillStyle = '#000';
        ctx.fillText(dirText, 0, sepY + 2);
      }
      ctx.restore();
    } else {
      b._labelBox = null;
    }

    ctx.restore();
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
    const r = Math.max(5, 5 * engine.zoom);
    b._ghost = { x: c.x, y: c.y, r: Math.max(40, r + 10) };

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = `${engine.mm2cvs(engine.MM.flowEmoji * engine.labelScaleM)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.tipo === 'bajante' ? '⬇' : '⬆', c.x, c.y);
    ctx.setLineDash([]);
    ctx.restore();

    if (disp && (Math.abs(disp.dx) > 1 || Math.abs(disp.dy) > 1)) {
      const orig = engine.toCvs(b.x, b.y);
      ctx.save();
      ctx.strokeStyle = col + '66';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(orig.x, orig.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();
    }
  });
}
