import type { IPlanoEngineCore } from '../PlanoEngineTypes';

export function renderDims(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
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
    ctx.font = `${engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM)}px Geist, monospace`;
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

export function renderDimGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
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
    ctx.font = `${engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM)}px Geist, monospace`;
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
