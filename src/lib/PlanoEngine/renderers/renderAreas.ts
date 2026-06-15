import { NETS } from '../PlanoState';
import { rotatedRectCorners } from '../Coords';
import type { IPlanoEngineCore } from '../PlanoEngineTypes';

export function renderAreas(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
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
      const { corners: aCorners, minX, minY, maxX, maxY } = rotatedRectCorners(lx.x, lx.y - 16 + aBoxH / 2, aBoxW, aBoxH, aAngle, 2);
      a._labelBox = { cx: lx.x, cy: lx.y - 16 + aBoxH / 2, w: aBoxW, h: aBoxH, angle: aAngle, minX, minY, maxX, maxY, corners: aCorners };
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-tw / 2 - 5, -16, aBoxW, aBoxH);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (displayLabel) ctx.fillText(displayLabel, 0, areaLabel ? -aFsSub / 2 - 2 : 0);
      if (areaLabel) {
        ctx.font = `bold ${aFsSub}px Geist, monospace`;
        ctx.fillStyle = '#333';
        ctx.fillText(areaLabel, 0, displayLabel ? aFs / 2 + 2 : 0);
      }
      ctx.restore();
    } else {
      a._labelBox = null;
    }

    if (sel) {
      const arrowR = 12;
      const ox = lx.x + 20;
      ctx.fillStyle = '#FFEB3B';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(ox - arrowR, lx.y);
      ctx.lineTo(ox, lx.y - arrowR * 0.5);
      ctx.lineTo(ox, lx.y + arrowR * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  });
}

export function renderActiveArea(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
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
