import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Same field a manually-placed accessory would occupy at this vertex, so we can detect
// whether a codo reventilado is already drawn there before auto-generating another one.
function accessoryAt(r: PlanoRamal, idx: number): string | undefined {
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

  const sanPointOwners: Map<string, { r: PlanoRamal; idx: number }[]> = new Map();
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
      let matchX: number | null = null;
      let matchY: number | null = null;
      let matchOwners: { r: PlanoRamal; idx: number }[] = [];

      // First try an exact vertex match (the common case when the vent snapped onto an existing
      // san point) — preserves the "already manually accessorized" dedup check below, which only
      // makes sense against a real vertex (accesorioInicio/Fin/accMed all key off a pts index).
      for (const key of sanPointOwners.keys()) {
        const [sx, sy] = key.split('_').map(Number);
        if (Math.hypot(pt[0] - sx, pt[1] - sy) < 0.5) {
          matchX = sx; matchY = sy;
          matchOwners = sanPointOwners.get(key) || [];
          break;
        }
      }

      // No vertex match — a vent riser very commonly ties into the MIDDLE of a straight san run,
      // where there is no vertex at all. Without this, the symbol never appeared for that (very
      // common) case even though the ramal visually touches the san line. Project onto every san
      // segment instead and use the closest point within tolerance.
      if (matchX === null) {
        let bestDist = 0.5;
        for (const sr of sanRamales) {
          for (let i = 0; i < sr.pts.length - 1; i++) {
            const [ax, ay] = sr.pts[i];
            const [bx, by] = sr.pts[i + 1];
            const sDx = bx - ax, sDy = by - ay;
            const sLenSq = sDx * sDx + sDy * sDy;
            if (sLenSq < 0.0001) continue;
            let t = ((pt[0] - ax) * sDx + (pt[1] - ay) * sDy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = ax + t * sDx, projY = ay + t * sDy;
            const dist = Math.hypot(pt[0] - projX, pt[1] - projY);
            if (dist < bestDist) {
              bestDist = dist;
              matchX = projX; matchY = projY;
              matchOwners = [];
            }
          }
        }
      }

      if (matchX !== null && matchY !== null) {
        const sx = matchX, sy = matchY;
        {
          const dk = `${sx.toFixed(3)}_${sy.toFixed(3)}`;
          if (drawn.has(dk)) return;

          // Already has a manually-placed codo reventilado on the sanitary side of this
          // junction point — don't double-draw.
          if (matchOwners.some((o) => accessoryAt(o.r, o.idx) === 'codoReventilado')) {
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
          // Fill the disc (same radius as the ring stroke below, no extra halo margin) so the
          // sanitaria/ventilación lines underneath don't show through into the symbol — without
          // reintroducing the thick white border that was explicitly asked to be removed.
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
          ctx.fill();

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

          ctx.beginPath();
          ctx.arc(c.x, c.y, rRad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(c.x, c.y, 0.35 * rf, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }
    });
  });
}

export { renderVentCodos };
