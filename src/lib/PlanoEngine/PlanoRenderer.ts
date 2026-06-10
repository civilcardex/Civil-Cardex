import { NETS } from './PlanoState';

export function renderDims(ctx: CanvasRenderingContext2D, engine: any) {
  engine.dims.forEach((d: any) => {
    const c1 = engine.toCvs(d.x1, d.y1);
    const c2 = engine.toCvs(d.x2, d.y2);
    ctx.save();
    ctx.strokeStyle = '#F5A623';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const dx = c2.x - c1.x, dy = c2.y - c1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) { ctx.restore(); return; }
    const nx = -dy / len, ny = dx / len;
    const mk = 9;
    [c1, c2].forEach((pt: any) => {
      ctx.beginPath();
      ctx.moveTo(pt.x - nx * mk, pt.y - ny * mk);
      ctx.lineTo(pt.x + nx * mk, pt.y + ny * mk);
      ctx.stroke();
    });

    const mx = (c1.x + c2.x) / 2, my = (c1.y + c2.y) / 2;
    const txt = `${d.L}m`;
    ctx.font = `${engine.mm2cvs(engine.MM.lblInfo)}px Geist, monospace`;
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(17,19,23,0.75)';
    ctx.fillRect(mx - tw / 2 - 4, my - 8, tw + 8, 16);
    ctx.fillStyle = '#F5A623';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, mx, my);
    ctx.restore();
  });
}

export function renderTexts(ctx: CanvasRenderingContext2D, engine: any) {
  engine.textAnnots.forEach((t: any) => {
    const c = engine.toCvs(t.x + (t.lblOffX || 0), t.y + (t.lblOffY || 0));
    const sel = t.id === engine.selId;
    const fs = engine.mm2cvs(t.fontMm || 2.5);
    const angle = (t.textAngle || 0) * Math.PI / 180;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);
    ctx.font = `${fs}px Geist, monospace`;
    const tw = t.boxW > 0 ? t.boxW * engine.zoom : ctx.measureText(t.text).width;
    const pad = 5;
    const boxW = tw + pad * 2;
    const boxH = fs + pad * 2;

    ctx.fillStyle = 'rgba(17,19,23,0.85)';
    ctx.strokeStyle = sel ? '#4D8FF7' : '#3a494a';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.rect(-pad, -fs - pad, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    if (sel) {
      ctx.fillStyle = '#4D8FF7';
      ctx.beginPath();
      ctx.arc(-pad + boxW, -fs / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#e2e2e8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(t.text, 0, -fs);
    ctx.restore();

    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    t._box = {
      x: c.x - (boxW * cos + boxH * sin) / 2,
      y: c.y - (boxH * cos + boxW * sin) / 2,
      w: boxW * cos + boxH * sin,
      h: boxH * cos + boxW * sin,
    };
  });
}

export function renderAreas(ctx: CanvasRenderingContext2D, engine: any) {
  engine.areas.forEach((a: any) => {
    if (engine._hiddenNets.has(a.net)) return;
    if (a.pts.length < 3) return;
    const sel = a.id === engine.selId;
    const pts = a.pts.map((p: number[]) => engine.toCvs(p[0], p[1]));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = a.color || 'rgba(0,220,229,0.12)';
    ctx.fill();
    ctx.strokeStyle = sel ? '#00dce5' : (a.color || 'rgba(0,220,229,0.5)').replace('0.2', '0.7').replace('33', 'aa');
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.setLineDash(sel ? [] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    pts.forEach((p: any) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    a._polyBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

    const lx = engine.toCvs(a.labelX, a.labelY);

    if (a.label || a.areaM2) {
      ctx.save();
      ctx.translate(lx.x, lx.y);
      const aAngle = (a.labelAngle || 0) * Math.PI / 180;
      ctx.rotate(aAngle);
      const displayLabel = a.label || '';
      const areaLabel = a.areaM2 ? `${a.areaM2} m²` : '';
      const aFs = engine.mm2cvs(engine.MM.lblName);
      const aFsSub = engine.mm2cvs(engine.MM.lblInfo);
      ctx.font = `bold ${aFs}px Geist, monospace`;
      const tw = Math.max(ctx.measureText(displayLabel).width, ctx.measureText(areaLabel).width);
      const aBoxW = tw + 10, aBoxH = areaLabel ? aFs + aFsSub + 10 : aFs + 8;
      const aCosA = Math.cos(aAngle), aSinA = Math.sin(aAngle);
      const aCorners = [
        { x: lx.x + aCosA * (-aBoxW / 2) - aSinA * (-16 - aBoxH / 2), y: lx.y + aSinA * (-aBoxW / 2) + aCosA * (-16 - aBoxH / 2) },
        { x: lx.x + aCosA * (aBoxW / 2) - aSinA * (-16 - aBoxH / 2), y: lx.y + aSinA * (aBoxW / 2) + aCosA * (-16 - aBoxH / 2) },
        { x: lx.x + aCosA * (aBoxW / 2) - aSinA * (-16 + aBoxH / 2), y: lx.y + aSinA * (aBoxW / 2) + aCosA * (-16 + aBoxH / 2) },
        { x: lx.x + aCosA * (-aBoxW / 2) - aSinA * (-16 + aBoxH / 2), y: lx.y + aSinA * (-aBoxW / 2) + aCosA * (-16 + aBoxH / 2) },
      ];
      a._labelBox = {
        cx: lx.x, cy: lx.y - 16 + aBoxH / 2, w: aBoxW, h: aBoxH, angle: aAngle,
        minX: Math.min(...aCorners.map((c: any) => c.x)) - 2,
        minY: Math.min(...aCorners.map((c: any) => c.y)) - 2,
        maxX: Math.max(...aCorners.map((c: any) => c.x)) + 2,
        maxY: Math.max(...aCorners.map((c: any) => c.y)) + 2,
        corners: aCorners
      };
      ctx.fillStyle = 'rgba(17,19,23,0.82)';
      ctx.fillRect(-tw / 2 - 5, -16, aBoxW, aBoxH);
      ctx.fillStyle = sel ? '#00dce5' : '#e2e2e8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (displayLabel) ctx.fillText(displayLabel, 0, areaLabel ? -aFsSub / 2 - 2 : 0);
      if (areaLabel) {
        ctx.font = `bold ${aFsSub}px Geist, monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(areaLabel, 0, displayLabel ? aFs / 2 + 2 : 0);
      }
      ctx.restore();
    } else {
      a._labelBox = null;
    }

    if (sel) {
      ctx.strokeStyle = '#4D8FF7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx.x - 14, lx.y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#4D8FF7';
      ctx.fill();
    }

    ctx.restore();
  });
}

export function renderActiveArea(ctx: CanvasRenderingContext2D, engine: any) {
  if (!engine.activeArea || engine.activeArea.pts.length < 1) return;
  const pts = engine.activeArea.pts.map((p: number[]) => engine.toCvs(p[0], p[1]));
  const col = NETS.find((n: any) => n.id === engine.activeNet)?.col || '#00dce5';

  ctx.save();
  ctx.fillStyle = col + '22';
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (pts.length >= 3) {
    ctx.closePath();
    ctx.fill();
  }
  ctx.stroke();
  ctx.setLineDash([]);

  pts.forEach((p: any, idx: number) => {
    ctx.fillStyle = idx === 0 ? '#fff' : col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (pts.length >= 1) {
    let mp = engine.toPlane(engine.mouseX, engine.mouseY);
    const last = engine.activeArea.pts[engine.activeArea.pts.length - 1];
    if (engine.snapMode) mp = engine.snapAngle(last[0], last[1], mp.x, mp.y);
    const mc = engine.toCvs(mp.x, mp.y);
    ctx.strokeStyle = col + '88';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.lineTo(mc.x, mc.y);
    if (pts.length >= 2) {
      ctx.lineTo(pts[0].x, pts[0].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const first = engine.activeArea.pts[0];
    const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
    const SNAP_CLOSE = 12 / engine.zoom;
    if (engine.activeArea.pts.length >= 3 && distFirst < SNAP_CLOSE) {
      const fc = engine.toCvs(first[0], first[1]);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(34,211,238,0.25)';
      ctx.fill();
    }
  }

  ctx.restore();
}

export function renderRamales(ctx: CanvasRenderingContext2D, engine: any) {
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
      const VERT_THRESH = 8;
      const isVertical = Math.abs(flowDx) < VERT_THRESH && flowLen > 12;
      const arrowSize = showFlow && flowLen > 12 ? 34 : 0;
      const lbl = (r.tipo === 'tributario')
        ? (() => {
            const padre = r.padre ? engine.ramales.find((p: any) => p.id === r.padre) : null;
            return padre ? (padre.label || padre.id) : (r.label || '');
          })()
        : (r.label || '');
      const matPart = r.material || '';
      const dPart = r.diametro ? `D=${r.diametro}` : '';
      const lblPart = r.totalL ? `${r.totalL.toFixed(2)}m` : '';
      const pPart = r.pendiente ? `S=${r.pendiente}%` : '';
      const showPend = (r.net === 'san' || r.net === 'll');
      const pendPart = showPend && pPart ? pPart : '';

      const fsName = engine.mm2cvs(engine.MM.lblName);
      const fsInfo = engine.mm2cvs(engine.MM.lblInfo);
      const lineHName = fsName + 2;
      const lineHInfo = fsInfo + 4;
      const boxPadX = engine.mm2cvs(1.0);
      const boxPadY = engine.mm2cvs(0.6);

      const infoSegs: Array<{ text: string; bold: boolean; w: number } | null> = [
        matPart ? { text: matPart, bold: false, w: 0 } : null,
        dPart ? { text: dPart, bold: true, w: 0 } : null,
        lblPart ? { text: lblPart, bold: false, w: 0 } : null,
        pendPart ? { text: pendPart, bold: false, w: 0 } : null,
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
      const RIGHT_GAP = 10;
      const ARROW_GAP = 8;
      let drawX: number, drawY: number;
      if (isVertical) {
        const arrowSpace = showFlow ? arrowSize + ARROW_GAP : 0;
        drawX = lc.x + RIGHT_GAP + arrowSpace + boxW / 2;
        drawY = lc.y;
      } else {
        drawX = lc.x;
        drawY = lc.y - (boxH / 2 + 4);
      }
      const labelAngle = (r.labelAngle || 0) * Math.PI / 180;

      const cosA = Math.cos(labelAngle), sinA = Math.sin(labelAngle);
      const hw = boxW / 2, hh = boxH / 2;
      const corners = [
        { x: drawX + cosA * (-hw) - sinA * (-hh), y: drawY + sinA * (-hw) + cosA * (-hh) },
        { x: drawX + cosA * (hw) - sinA * (-hh), y: drawY + sinA * (hw) + cosA * (-hh) },
        { x: drawX + cosA * (hw) - sinA * (hh), y: drawY + sinA * (hw) + cosA * (hh) },
        { x: drawX + cosA * (-hw) - sinA * (hh), y: drawY + sinA * (-hw) + cosA * (hh) },
      ];
      r._labelBox = {
        cx: drawX, cy: drawY, w: boxW, h: boxH, angle: labelAngle,
        minX: Math.min(...corners.map((c: any) => c.x)),
        minY: Math.min(...corners.map((c: any) => c.y)),
        maxX: Math.max(...corners.map((c: any) => c.x)),
        maxY: Math.max(...corners.map((c: any) => c.y)),
        corners
      };

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
        const arrowGap = 6;
        const arrowY = boxH / 2 + arrowGap + arrowSize / 2;
        ctx.save();
        ctx.translate(0, arrowY);
        const dot = flowDx * cosA + flowDy * sinA;
        const dir = dot >= 0 ? 1 : -1;
        const halfSize = arrowSize / 2;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-halfSize * dir, 0);
        ctx.lineTo(halfSize * dir, 0);
        ctx.stroke();
        const aSize = 9;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(halfSize * dir, 0);
        ctx.lineTo(halfSize * dir - dir * aSize, -aSize * 0.5);
        ctx.lineTo(halfSize * dir - dir * aSize, aSize * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else {
      r._labelBox = null;
    }

    ctx.restore();
  });
}

export function renderBajantes(ctx: CanvasRenderingContext2D, engine: any) {
  engine.bajantes.forEach((b: any) => {
    if (engine._hiddenNets.has(b.net)) return;
    const net = NETS.find((n: any) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const c = engine.toCvs(b.x, b.y);
    const sel = b.id === engine.selId;
    const r = 14 * engine.zoom;
    const angle = (b.labelAngle || 0) * Math.PI / 180;
    b._circ = { x: c.x, y: c.y, r };

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
      const ram = engine.ramales.find((rr: any) => rr.id === b.descargaEnId);
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

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F04545';
    ctx.lineWidth = sel ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    if (b.tipo === 'bajante') {
      const aS = r * 0.7;
      ctx.strokeStyle = '#F04545';
      ctx.lineWidth = r * 0.15;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(0, aS * 0.9);
      ctx.lineTo(0, -aS * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#F04545';
      ctx.beginPath();
      ctx.moveTo(0, -aS * 0.9);
      ctx.lineTo(-aS * 0.4, -aS * 0.3);
      ctx.lineTo(aS * 0.4, -aS * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
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
    }

    if (b.code || b.code === '') {
      const offDx = (b.labelX - b.x) * engine.zoom;
      const offDy = (b.labelY - b.y) * engine.zoom;
      ctx.save();
      ctx.translate(offDx, offDy);
      const fsCode = engine.mm2cvs(engine.MM.lblCode);
      const fsBInfo = engine.mm2cvs(engine.MM.lblInfo);
      const lineH = fsBInfo + 2;
      ctx.font = `bold ${fsCode}px Geist, monospace`;
      const displayCode = b.code || '—';
      const tw = ctx.measureText(displayCode).width;
      const boxW = tw + engine.mm2cvs(2);
      const boxH = lineH * (1 + (b.hVert !== undefined ? 1 : 0) + (b.dNominal !== undefined ? 1 : 0)) + engine.mm2cvs(1.2);
      const lbCx = c.x + offDx * Math.cos(angle) - offDy * Math.sin(angle);
      const lbCy = c.y + offDx * Math.sin(angle) + offDy * Math.cos(angle);
      const cosA2 = Math.cos(angle), sinA2 = Math.sin(angle);
      const hw2 = boxW / 2, hh2 = boxH / 2;
      const corners2 = [
        { x: lbCx + cosA2 * (-hw2) - sinA2 * (-10 - hh2), y: lbCy + sinA2 * (-hw2) + cosA2 * (-10 - hh2) },
        { x: lbCx + cosA2 * (hw2) - sinA2 * (-10 - hh2), y: lbCy + sinA2 * (hw2) + cosA2 * (-10 - hh2) },
        { x: lbCx + cosA2 * (hw2) - sinA2 * (-10 + hh2), y: lbCy + sinA2 * (hw2) + cosA2 * (-10 + hh2) },
        { x: lbCx + cosA2 * (-hw2) - sinA2 * (-10 + hh2), y: lbCy + sinA2 * (-hw2) + cosA2 * (-10 + hh2) },
      ];
      b._labelBox = {
        cx: lbCx, cy: lbCy - 10 + hh2, w: boxW, h: boxH, angle,
        minX: Math.min(...corners2.map((c2: any) => c2.x)) - 2,
        minY: Math.min(...corners2.map((c2: any) => c2.y)) - 2,
        maxX: Math.max(...corners2.map((c2: any) => c2.x)) + 2,
        maxY: Math.max(...corners2.map((c2: any) => c2.y)) + 2,
        corners: corners2
      };
      ctx.fillStyle = 'rgba(17,19,23,0.82)';
      ctx.fillRect(-tw / 2 - 4, -10, boxW, boxH);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayCode, 0, -boxH / 2 + lineH / 2 + 2);
      let labelY = -boxH / 2 + lineH * 1.5 + 2;
      if (b.hVert !== undefined) {
        ctx.font = `${fsBInfo}px Geist, monospace`;
        ctx.fillStyle = '#849495';
        ctx.fillText(`H=${b.hVert}m`, 0, labelY);
        labelY += lineH;
      }
      if (b.dNominal !== undefined) {
        ctx.font = `${fsBInfo}px Geist, monospace`;
        ctx.fillStyle = '#849495';
        ctx.fillText(`D=${b.dNominal && b.dNominal !== '0' ? b.dNominal : ''}mm`, 0, labelY);
      }
      if (sel) {
        ctx.strokeStyle = '#4D8FF7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-14, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#4D8FF7';
        ctx.fill();
      }
      ctx.restore();
    } else {
      b._labelBox = null;
    }

    ctx.restore();
  });
}

export function renderGhosts(ctx: CanvasRenderingContext2D, engine: any) {
  const fg = engine.getBajantesFantasma();
  fg.forEach((b: any) => {
    const net = NETS.find((n: any) => n.id === b.net);
    const col = net ? net.col : '#e2e2e8';
    const disp = b.desplazamientos?.[engine.nivelActual?.label];
    const gx = b.x + (disp ? disp.dx : 0);
    const gy = b.y + (disp ? disp.dy : 0);
    const c = engine.toCvs(gx, gy);
    const r = 14 * engine.zoom;
    b._ghost = { x: c.x, y: c.y, r };

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = `${engine.mm2cvs(engine.MM.flowEmoji)}px sans-serif`;
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

export function renderDimGhost(ctx: CanvasRenderingContext2D, engine: any) {
  if (!engine._dimStart || engine.tool !== 'dim') return;
  const s = engine.toCvs(engine._dimStart.x, engine._dimStart.y);
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const e = engine.toCvs(mp.x, mp.y);

  ctx.save();
  ctx.strokeStyle = '#F5A623';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const dx = e.x - s.x, dy = e.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    const nx = -dy / len, ny = dx / len;
    const mk = 9;
    [s, e].forEach((pt: any) => {
      ctx.beginPath();
      ctx.moveTo(pt.x - nx * mk, pt.y - ny * mk);
      ctx.lineTo(pt.x + nx * mk, pt.y + ny * mk);
      ctx.stroke();
    });

    const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2;
    const px = Math.hypot(mp.x - engine._dimStart.x, mp.y - engine._dimStart.y);
    const txt = `${engine.pxToM(px).toFixed(2)}m`;
    ctx.font = `${engine.mm2cvs(engine.MM.lblInfo)}px Geist, monospace`;
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(17,19,23,0.75)';
    ctx.fillRect(mx - tw / 2 - 4, my - 8, tw + 8, 16);
    ctx.fillStyle = '#F5A623';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, mx, my);
  }

  ctx.fillStyle = '#F5A623';
  ctx.beginPath();
  ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function renderActiveRamal(ctx: CanvasRenderingContext2D, engine: any) {
  if (!engine.activeRamal) return;
  const net = NETS.find((n: any) => n.id === engine.activeRamal.net);
  const col = net ? net.col : '#e2e2e8';

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (engine.activeRamal.pts.length > 1) {
    ctx.beginPath();
    const f = engine.toCvs(engine.activeRamal.pts[0][0], engine.activeRamal.pts[0][1]);
    ctx.moveTo(f.x, f.y);
    for (let i = 1; i < engine.activeRamal.pts.length; i++) {
      const c = engine.toCvs(engine.activeRamal.pts[i][0], engine.activeRamal.pts[i][1]);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();
  }

  engine.activeRamal.pts.forEach(([px, py]: [number, number], idx: number) => {
    const c = engine.toCvs(px, py);
    ctx.fillStyle = idx === 0 ? '#fff' : col;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  const first = engine.activeRamal.pts[0];
  const last = engine.activeRamal.pts[engine.activeRamal.pts.length - 1];
  let mp = engine.toPlane(engine.mouseX, engine.mouseY);
  if (engine.snapMode) mp = engine.snapAngle(last[0], last[1], mp.x, mp.y);
  const sp = engine.snapToExisting(mp.x, mp.y);
  if (sp) mp = sp;

  const distFirst = Math.hypot(mp.x - first[0], mp.y - first[1]);
  const SNAP_CLOSE = 12 / engine.zoom;
  if (engine.activeRamal.pts.length >= 3 && distFirst < SNAP_CLOSE) {
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
