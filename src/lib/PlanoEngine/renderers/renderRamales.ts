import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../Coords';
import type { IPlanoEngineCore } from '../PlanoEngineTypes';

export function renderRamales(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const isTributarioMode = engine.tipoTramo === 'tributario' && engine.tool === 'line';
  const padreId = engine.padreTributario;
  engine.ramales.forEach((r: any) => {
    if (engine._hiddenNets.has(r.net)) return;
    const net = NETS.find((n: any) => n.id === r.net);
    const col = net ? net.col : '#e2e2e8';
    const sel = r.id === engine.selId;
    const isPadre = r.id === padreId;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = sel ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (r.pts.length > 1) {
      if (isPadre && isTributarioMode) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 3;
        ctx.strokeStyle = col;
        ctx.beginPath();
        const f = engine.toCvs(r.pts[0][0], r.pts[0][1]);
        ctx.moveTo(f.x, f.y);
        for (let i = 1; i < r.pts.length; i++) {
          const c = engine.toCvs(r.pts[i][0], r.pts[i][1]);
          ctx.lineTo(c.x, c.y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (r.tipo === 'tributario') {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        const f = engine.toCvs(r.pts[0][0], r.pts[0][1]);
        ctx.moveTo(f.x, f.y);
        for (let i = 1; i < r.pts.length; i++) {
          const c = engine.toCvs(r.pts[i][0], r.pts[i][1]);
          ctx.lineTo(c.x, c.y);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        const f = engine.toCvs(r.pts[0][0], r.pts[0][1]);
        ctx.moveTo(f.x, f.y);
        for (let i = 1; i < r.pts.length; i++) {
          const c = engine.toCvs(r.pts[i][0], r.pts[i][1]);
          ctx.lineTo(c.x, c.y);
        }
        ctx.stroke();
      }
    }

    r.pts.forEach(([px, py]: [number, number]) => {
      const c = engine.toCvs(px, py);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    if (isPadre && isTributarioMode && !engine.activeRamal && r.pts.length >= 2) {
      const mp = engine.snapPreviewToPadre(engine.mouseX, engine.mouseY);
      if (mp) {
        const c = engine.toCvs(mp.x, mp.y);
        ctx.save();
        ctx.fillStyle = col;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    if (r.pts.length >= 2) {
      const cStart = engine.toCvs(r.pts[0][0], r.pts[0][1]);
      const cEnd = engine.toCvs(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1]);
      const drawEndMarker = (c: any, label: string) => {
        if (!label) return;
        ctx.save();
        ctx.font = `bold ${engine.mm2cvs(1.6)}px Geist, monospace`;
        const tw = ctx.measureText(label).width;
        const pad = 3;
        const w = tw + pad * 2;
        const h = engine.mm2cvs(2.4) + pad * 2;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(c.x + 6, c.y - h / 2, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, c.x + 6 + pad, c.y);
        ctx.restore();
      };
      drawEndMarker(cStart, r.ini);
      drawEndMarker(cEnd, r.fin);
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
      const VERT_THRESH = 10;
      const isVertical = Math.abs(flowDx) < VERT_THRESH && flowLen > 12;
      const arrowSize = showFlow && flowLen > 12 ? 46 : 0;
      const lbl = r.label || '';
      const matPart = r.material || '';
      const dPart = r.diametro ? `D=${r.diametro.split(' — ')[0]}` : '';
      const pPart = r.pendiente ? `S=${r.pendiente}%` : '';
      const showPend = (r.net === 'san' || r.net === 'll');
      const pendPart = showPend && pPart ? pPart : '';
      const lblPart = r.totalL ? `L=${r.totalL.toFixed(2)}m` : '';

      const fsName = engine.mm2cvs(engine.MM.lblName);
      const fsInfo = engine.mm2cvs(engine.MM.lblInfo);
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
        ctx.font = s!.bold ? `bold ${fsName}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
        s!.w = ctx.measureText(s!.text).width;
      }
      const totalInfoW = infoSegs.reduce((sum: number, s, i) => sum + s!.w + (i < infoSegs.length - 1 ? sepW : 0), 0);

      ctx.font = `bold ${fsName}px Geist, monospace`;
      const nameW = lbl ? ctx.measureText(lbl).width : 0;
      const contentW = Math.max(nameW, totalInfoW);
      const boxW = contentW + boxPadX * 2;
      const boxH = (lbl ? lineHName : 0) + (infoSegs.length > 0 ? lineHInfo : 0) + boxPadY * 2;
      let drawX: number, drawY: number;
      drawX = lc.x;
      drawY = lc.y;
      const labelAngle = (r.labelAngle || 0) * Math.PI / 180;
      const cosA = Math.cos(labelAngle), sinA = Math.sin(labelAngle);

      const { corners, minX, minY, maxX, maxY } = rotatedRectCorners(drawX, drawY, boxW, boxH, labelAngle);
      r._labelBox = { cx: drawX, cy: drawY, w: boxW, h: boxH, angle: labelAngle, minX, minY, maxX, maxY, corners };

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(labelAngle);
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
          ctx.font = s!.bold ? `bold ${fsName}px Geist, monospace` : `600 ${fsInfo}px Geist, monospace`;
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

      if (showFlow && flowLen > 12) {
        const arrowGap = -8;
        const arrowY = boxH / 2 + arrowGap + arrowSize / 2;
        ctx.save();
        ctx.translate(0, arrowY);
        const dot = flowDx * cosA + flowDy * sinA;
        const dir = dot >= 0 ? 1 : -1;
        const halfSize = arrowSize * 1.4;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-halfSize * dir, 0);
        ctx.lineTo(halfSize * dir, 0);
        ctx.stroke();
        const aSize = 10;
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
      r._labelBox = null;
    }

    ctx.restore();

    if (r.id === engine.selId && r.pts.length >= 2) {
      const firstC = engine.toCvs(r.pts[0][0], r.pts[0][1]);
      const secondC = engine.toCvs(r.pts[1][0], r.pts[1][1]);
      const adx = secondC.x - firstC.x, ady = secondC.y - firstC.y;
      const alen = Math.hypot(adx, ady);
      if (alen > 2) {
        const unx = adx / alen, uny = ady / alen;
        const arrowR = 18;
        const cx = firstC.x - unx * arrowR * 0.3;
        const cy = firstC.y - uny * arrowR * 0.3;
        ctx.save();
        ctx.fillStyle = '#FFEB3B';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(cx + unx * arrowR, cy + uny * arrowR);
        ctx.lineTo(cx + uny * arrowR * 0.5, cy - unx * arrowR * 0.5);
        ctx.lineTo(cx - uny * arrowR * 0.5, cy + unx * arrowR * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  });
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine.activeRamal) return;
  const ar = engine.activeRamal;
  const net = NETS.find((n: any) => n.id === ar.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ar.pts.length > 1) {
    ctx.beginPath();
    const f = engine.toCvs(ar.pts[0][0], ar.pts[0][1]);
    ctx.moveTo(f.x, f.y);
    for (let i = 1; i < ar.pts.length; i++) {
      const c = engine.toCvs(ar.pts[i][0], ar.pts[i][1]);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
  }

  ar.pts.forEach((pt: number[], idx: number) => {
    const px = pt[0], py = pt[1];
    const c = engine.toCvs(px, py);
    ctx.fillStyle = idx === 0 ? '#fff' : col;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  const first = ar.pts[0];
  const last = ar.pts[ar.pts.length - 1];
  let mp = engine.toPlane(engine.mouseX, engine.mouseY);
  if (engine.snapMode) mp = engine.snapAngle(last[0], last[1], mp.x, mp.y);
  const sp = engine.snapToExisting(mp.x, mp.y);
  if (sp) mp = sp;

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (ar.pts.length >= 3 && distFirst < SNAP_CLOSE) {
    const fc = engine.toCvs(first[0], first[1]);
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.25)';
    ctx.beginPath();
    ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
    ctx.fill();
    mp = { x: first[0], y: first[1] };
  }

  const lc = engine.toCvs(last[0], last[1]);
  const mc = engine.toCvs(mp.x, mp.y);

  ctx.strokeStyle = col + '88';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(lc.x, lc.y);
  ctx.lineTo(mc.x, mc.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (sp) {
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mc.x, mc.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  const segPx = Math.hypot(mp.x - last[0], mp.y - last[1]);
  const segM = engine.pxToM(segPx);
  const deg = Math.atan2(mp.y - last[1], mp.x - last[0]) * 180 / Math.PI;
  const cursorLabel = `${segM}m  ${Math.round(((deg % 360) + 360) % 360)}°`;
  ctx.font = `${engine.mm2cvs(engine.MM.coord)}px Geist, monospace`;
  const tw = ctx.measureText(cursorLabel).width;
  ctx.fillStyle = 'rgba(17,19,23,0.82)';
  ctx.fillRect(mc.x + 12, mc.y - 18, tw + 8, 16);
  ctx.fillStyle = '#e2e2e8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(cursorLabel, mc.x + 16, mc.y - 10);

  ctx.restore();
}
