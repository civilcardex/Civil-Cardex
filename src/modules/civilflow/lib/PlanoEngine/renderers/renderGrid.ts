import type { IPlanoEngineCore } from '../PlanoState';

// Real-world spacing between grid lines — 0.5m, small enough to actually be useful as a drawing
// aid at typical architectural scales (1:50, 1:75, 1:100...). Was 1000 (1m), squares too big.
const GRID_SPACING_MM = 500;

export function renderGrid(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  // mm2cvs() expects PAPER mm, not real-world mm — realMmToCanvasPx() does the real→paper
  // conversion first (dividing by the drawing scale) before calling it, same as every other
  // real-world-sized symbol in the engine (accessory glyphs, bajante radii, etc). Calling
  // mm2cvs(1000) directly here treated 1000 as paper mm — a full paper-space METER — spacing grid
  // lines roughly 50x too far apart at common scales, so in practice none ever fell on-screen.
  const stepPx = engine.realMmToCanvasPx(GRID_SPACING_MM);
  if (!Number.isFinite(stepPx) || stepPx < 4) return; // too zoomed out — lines would just be noise

  // engine.cw.clientWidth/clientHeight (live DOM layout) instead of canv.width/dpr — the canvas
  // attribute dimensions can lag a beat behind the actual viewport right after a PDF underlay
  // loads/resizes the drawing area, which silently starved the grid's loop bounds to near-zero
  // while every other renderer (offX/zoom-based, no dependency on canv.width) kept working fine.
  const dpr = engine.dpr || 1;
  const wCss = engine.cw?.clientWidth || engine.canv.width / dpr;
  const hCss = engine.cw?.clientHeight || engine.canv.height / dpr;

  // Snap the first line to a grid-aligned canvas position so the grid stays anchored to the plane
  // origin (doesn't "swim" while panning) instead of always starting at the viewport edge.
  const startX = engine.offX % stepPx;
  const startY = engine.offY % stepPx;

  ctx.save();
  // Was 0.14 — too faint to register against the PDF underlay/busy drawing, easy to miss
  // entirely at normal working opacity. Bumped up so the grid is actually usable as a drawing
  // aid, plus a bolder line every 5th step (5m) as a coarse reference.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120,150,165,0.35)';
  ctx.beginPath();
  let i = 0;
  for (let x = startX; x < wCss; x += stepPx, i++) {
    if (i % 5 === 0) continue;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, hCss);
  }
  i = 0;
  for (let y = startY; y < hCss; y += stepPx, i++) {
    if (i % 5 === 0) continue;
    ctx.moveTo(0, y);
    ctx.lineTo(wCss, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(120,150,165,0.55)';
  ctx.beginPath();
  i = 0;
  for (let x = startX; x < wCss; x += stepPx, i++) {
    if (i % 5 !== 0) continue;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, hCss);
  }
  i = 0;
  for (let y = startY; y < hCss; y += stepPx, i++) {
    if (i % 5 !== 0) continue;
    ctx.moveTo(0, y);
    ctx.lineTo(wCss, y);
  }
  ctx.stroke();
  ctx.restore();
}
