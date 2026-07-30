import type { IPlanoEngineCore } from '../PlanoState';
import { rotatedRectCorners } from '../HitTester';

// Guide lines are a pure drafting aid — dashed, thin, muted gray — so they never get mistaken for
// a real ramal at a glance, whether selected or not (selection just switches to a slightly bolder
// dash, not a solid line, to keep that distinction visible even while editing).
export function renderGuideLines(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.guideLines.forEach((g) => {
    const [p1, p2] = g.pts;
    const c1 = engine.toCvs(p1[0], p1[1]);
    const c2 = engine.toCvs(p2[0], p2[1]);
    const selected = engine.selId === g.id;

    ctx.save();
    ctx.strokeStyle = selected ? '#000000' : '#888888';
    ctx.lineWidth = (selected ? 1.5 : 1) * engine.zoom;
    ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Hit-test box for right-click/selection: a thin rect around the segment, generous enough
    // for an easy click without needing pixel-perfect precision on the dashed line itself.
    const cx = (c1.x + c2.x) / 2;
    const cy = (c1.y + c2.y) / 2;
    const w = Math.hypot(c2.x - c1.x, c2.y - c1.y);
    const h = 16 * engine.zoom;
    const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
    const rect = rotatedRectCorners(cx, cy, w, h, angle);
    g._labelBox = { cx, cy, w, h, angle, ...rect };
  });
}

export function renderGuideGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine._guideStart || engine.tool !== 'guide') return;
  const s = engine.toCvs(engine._guideStart.x, engine._guideStart.y);
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const e = engine.toCvs(mp.x, mp.y);

  ctx.save();
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 1 * engine.zoom;
  ctx.setLineDash([6 * engine.zoom, 4 * engine.zoom]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
