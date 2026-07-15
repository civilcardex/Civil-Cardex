import type { IPlanoEngineCore } from '../PlanoState';

// Same field a manually-placed accessory would occupy at this vertex, so we can detect
// whether a codo reventilado is already drawn there before auto-generating another one.
function accessoryAt(r: any, idx: number): string | undefined {
  if (idx === 0) return r.accesorioInicio;
  if (idx === r.pts.length - 1) return r.accesorioFin;
  return r.accMed ? r.accMed[`accMed${idx}`] : undefined;
}

function renderVentCodos(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  if (engine._hiddenNets.has('vent')) return;

  const ventRamales = engine.ramales.filter((r) => r.net === 'vent');
  if (ventRamales.length === 0) return;

  const sanRamales = engine.ramales.filter((r) => r.net === 'san');
  if (sanRamales.length === 0) return;

  const sanPointOwners: Map<string, { r: any; idx: number }[]> = new Map();
  sanRamales.forEach((r) => {
    r.pts.forEach((pt: number[], idx: number) => {
      const key = `${pt[0].toFixed(3)}_${pt[1].toFixed(3)}`;
      if (!sanPointOwners.has(key)) sanPointOwners.set(key, []);
      sanPointOwners.get(key)!.push({ r, idx });
    });
  });

  const drawn = new Set<string>();

  ventRamales.forEach((r) => {
    [0, r.pts.length - 1].forEach((idx: number) => {
      // Already has a manually-placed codo reventilado at this vent endpoint — don't double-draw.
      if (accessoryAt(r, idx) === 'codoReventilado') return;

      const pt = r.pts[idx];
      for (const key of sanPointOwners.keys()) {
        const [sx, sy] = key.split('_').map(Number);
        const dist = Math.hypot(pt[0] - sx, pt[1] - sy);
        if (dist < 0.5) {
          const dk = `${sx.toFixed(3)}_${sy.toFixed(3)}`;
          if (drawn.has(dk)) return;

          // Already has a manually-placed codo reventilado on the sanitary side of this
          // junction point — don't double-draw.
          const owners = sanPointOwners.get(dk) || [];
          if (owners.some((o) => accessoryAt(o.r, o.idx) === 'codoReventilado')) {
            drawn.add(dk);
            return;
          }

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
          // Same real-world-scaled sizing as the manually-placed codoReventilado accessory
          // symbol (renderRamales.ts), so both look identical regardless of drawing scale.
          const radBase = engine.realMmToCanvasPx(23);
          const rf = radBase / 1.6;
          const rRad = 1.2 * rf;
          const vLen = 1.6 * rf;
          const offset = rRad + 0.5 * rf;

          ctx.save();
          ctx.lineCap = 'round';

          const cx1 = c.x - dx * offset, cy1 = c.y - dy * offset;
          const cx2 = c.x + dx * offset, cy2 = c.y + dy * offset;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3.5 * engine.zoom;
          ctx.beginPath();
          ctx.moveTo(cx1 - px * vLen, cy1 - py * vLen);
          ctx.lineTo(cx1 + px * vLen, cy1 + py * vLen);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx2 - px * vLen, cy2 - py * vLen);
          ctx.lineTo(cx2 + px * vLen, cy2 + py * vLen);
          ctx.stroke();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1.5 * engine.zoom;
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
          ctx.arc(c.x, c.y, rRad + 0.2 * rf, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 0.35 * rf, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
          break;
        }
      }
    });
  });
}

export { renderVentCodos };
