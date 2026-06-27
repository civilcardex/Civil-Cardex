import type { IPlanoEngineCore } from '../PlanoState';

function renderVentCodos(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (engine._hiddenNets.has('vent')) return;

  const ventRamales = engine.ramales.filter((r: any) => r.net === 'vent');
  if (ventRamales.length === 0) return;

  const sanRamales = engine.ramales.filter((r: any) => r.net === 'san');
  if (sanRamales.length === 0) return;

  const sanPoints: Set<string> = new Set();
  sanRamales.forEach((r: any) => {
    r.pts.forEach((pt: number[]) => {
      sanPoints.add(`${pt[0].toFixed(3)}_${pt[1].toFixed(3)}`);
    });
  });

  const drawn = new Set<string>();

  ventRamales.forEach((r: any) => {
    [0, r.pts.length - 1].forEach((idx: number) => {
      const pt = r.pts[idx];
      for (const key of sanPoints) {
        const [sx, sy] = key.split('_').map(Number);
        const dist = Math.hypot(pt[0] - sx, pt[1] - sy);
        if (dist < 0.5) {
          const dk = `${sx.toFixed(3)}_${sy.toFixed(3)}`;
          if (drawn.has(dk)) return;
          drawn.add(dk);

          let dx = 0, dy = 0;
          if (idx === 0 && r.pts.length >= 2) {
            dx = r.pts[1][0] - r.pts[0][0];
            dy = r.pts[1][1] - r.pts[0][1];
          } else if (idx === r.pts.length - 1 && r.pts.length >= 2) {
            dx = r.pts[idx][0] - r.pts[idx - 1][0];
            dy = r.pts[idx][1] - r.pts[idx - 1][1];
          }
          const len = Math.hypot(dx, dy);
          if (len < 0.01) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
          const px = -dy, py = dx;

          const c = engine.toCvs(sx, sy);
          const rad = engine.mm2cvs(2.0);
          const vLen = engine.mm2cvs(2.5);

          ctx.save();
          ctx.lineCap = 'round';

          const offset = rad + engine.mm2cvs(0.8);
          const cx1 = c.x - dx * offset, cy1 = c.y - dy * offset;
          const cx2 = c.x + dx * offset, cy2 = c.y + dy * offset;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx1 - px * vLen, cy1 - py * vLen);
          ctx.lineTo(cx1 + px * vLen, cy1 + py * vLen);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx2 - px * vLen, cy2 - py * vLen);
          ctx.lineTo(cx2 + px * vLen, cy2 + py * vLen);
          ctx.stroke();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx1 - px * vLen, cy1 - py * vLen);
          ctx.lineTo(cx1 + px * vLen, cy1 + py * vLen);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx2 - px * vLen, cy2 - py * vLen);
          ctx.lineTo(cx2 + px * vLen, cy2 + py * vLen);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(c.x, c.y, rad + engine.mm2cvs(0.3), 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(c.x, c.y, engine.mm2cvs(0.5), 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
          break;
        }
      }
    });
  });
}

export { renderVentCodos };
