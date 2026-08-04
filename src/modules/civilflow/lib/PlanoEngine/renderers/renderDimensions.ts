import type { IPlanoEngineCore } from '../PlanoState';

export function renderDims(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  engine.dims.forEach((d) => {
    const c1 = engine.toCvs(d.x1, d.y1);
    const c2 = engine.toCvs(d.x2, d.y2);
    ctx.save();
    // Dimension lines must NOT compete with real pipes/annotations: render at reduced
    // opacity and a thinner stroke than regular network lines (1.5px → 1px). The text label
    // stays full-black below so measurements remain readable; only the line/ticks fade.
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1 * engine.zoom;
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();

    const dx = c2.x - c1.x,
      dy = c2.y - c1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      ctx.restore();
      return;
    }
    const ux = dx / len,
      uy = dy / len;
    const nx = -uy,
      ny = ux;
    // 45°-rotated tick, crossed with the perpendicular one — the classic architectural
    // dimension-line terminator (a "+" made of a witness-line tick and a diagonal slash).
    const cos45 = Math.SQRT1_2,
      sin45 = Math.SQRT1_2;
    const dxr = ux * cos45 - uy * sin45,
      dyr = ux * sin45 + uy * cos45;
    const mk = 4 * engine.zoom;
    [c1, c2].forEach((pt) => {
      ctx.beginPath();
      ctx.moveTo(pt.x - nx * mk, pt.y - ny * mk);
      ctx.lineTo(pt.x + nx * mk, pt.y + ny * mk);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pt.x - dxr * mk, pt.y - dyr * mk);
      ctx.lineTo(pt.x + dxr * mk, pt.y + dyr * mk);
      ctx.stroke();
    });

    const mx = (c1.x + c2.x) / 2,
      my = (c1.y + c2.y) / 2;
    const txt = `${d.L.toFixed(2)}m`;
    ctx.font = `${engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * 1.5)}px Geist, monospace`;
    let lx: number, ly: number;
    if (d.lblX != null && d.lblY != null) {
      const pos = engine.toCvs(d.lblX, d.lblY);
      lx = pos.x;
      ly = pos.y;
    } else {
      let onx = nx,
        ony = ny;
      if (ony > 0) {
        onx = -nx;
        ony = -ny;
      }
      const offset = mk + 3 * engine.zoom;
      lx = mx + onx * offset;
      ly = my + ony * offset;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 2.5 * engine.zoom;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(txt, lx, ly);
    ctx.fillStyle = '#000000';
    ctx.fillText(txt, lx, ly);
    d._labelPos = { x: lx, y: ly };
    ctx.restore();
  });
}

export function renderDimGhost(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (!engine._dimStart || engine.tool !== 'dim') return;
  const s = engine.toCvs(engine._dimStart.x, engine._dimStart.y);
  const mp = engine.toPlane(engine.mouseX, engine.mouseY);
  const e = engine.toCvs(mp.x, mp.y);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1 * engine.zoom;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();

  const dx = e.x - s.x,
    dy = e.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    const ux = dx / len,
      uy = dy / len;
    const nx = -uy,
      ny = ux;
    const cos45 = Math.SQRT1_2,
      sin45 = Math.SQRT1_2;
    const dxr = ux * cos45 - uy * sin45,
      dyr = ux * sin45 + uy * cos45;
    const mk = 4 * engine.zoom;
    [s, e].forEach((pt) => {
      ctx.beginPath();
      ctx.moveTo(pt.x - nx * mk, pt.y - ny * mk);
      ctx.lineTo(pt.x + nx * mk, pt.y + ny * mk);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pt.x - dxr * mk, pt.y - dyr * mk);
      ctx.lineTo(pt.x + dxr * mk, pt.y + dyr * mk);
      ctx.stroke();
    });

    const mx = (s.x + e.x) / 2,
      my = (s.y + e.y) / 2;
    const px = Math.hypot(mp.x - engine._dimStart.x, mp.y - engine._dimStart.y);
    const txt = `${engine.pxToM(px).toFixed(2)}m`;
    ctx.font = `${engine.mm2cvs(engine.MM.lblInfo * engine.labelScaleM * 1.5)}px Geist, monospace`;
    let onx = nx,
      ony = ny;
    if (ony > 0) {
      onx = -nx;
      ony = -ny;
    }
    const offset = mk + 3 * engine.zoom;
    const lx = mx + onx * offset,
      ly = my + ony * offset;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3 * engine.zoom;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(txt, lx, ly);
    ctx.fillStyle = '#000000';
    ctx.fillText(txt, lx, ly);
  }

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(s.x, s.y, 4 * engine.zoom, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
