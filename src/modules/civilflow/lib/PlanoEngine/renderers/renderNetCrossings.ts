import { NETS } from '../PlanoState';
import type { IPlanoEngineCore } from '../PlanoState';

const NET_ORDER: Record<string, number> = {};
NETS.forEach((n, i) => {
  NET_ORDER[n.id] = i;
});

interface Hit {
  x: number;
  y: number;
}

// True crossing only — excludes hits within EPS (fraction of segment length) of either
// segment's endpoints, since those represent coincident vertices, not a real crossing.
function segCrossing(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): Hit | null {
  const r1x = bx - ax,
    r1y = by - ay;
  const r2x = dx - cx,
    r2y = dy - cy;
  const denom = r1x * r2y - r1y * r2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((cx - ax) * r2y - (cy - ay) * r2x) / denom;
  const u = ((cx - ax) * r1y - (cy - ay) * r1x) / denom;
  const EPS = 0.03;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: ax + t * r1x, y: ay + t * r1y };
}

// Draws a small break-and-hop where two ramales from DIFFERENT networks cross without
// connecting (different fluid systems never share a real junction). Runs as an additive
// pass after renderRamales — it never touches the main polyline stroking logic, it only
// erases a short capsule of the "jumping" net's own line and re-draws it as a tiny arc,
// re-stroking the other (straight-through) net's line across that same span so it stays
// fully intact regardless of crossing angle.
export function renderNetCrossings(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const ramales = engine.ramales.filter(
    (r) =>
      (r.tipo === 'ramal' || r.tipo === 'tributario') &&
      r.pts &&
      r.pts.length >= 2 &&
      !engine._hiddenNets.has(r.net),
  );
  if (ramales.length < 2) return;

  const gapR = engine.realMmToCanvasPx(7);
  const seen = new Set<string>();

  // Skip hop rendering near bajante positions (real + cross-floor ghosts)
  const bajantePts: [number, number][] = [];
  for (const b of engine.bajantes) {
    if (engine._hiddenNets.has(b.net)) continue;
    const lvl = engine.nivelActual?.label ?? '';
    const disp = b.desplazamientos?.[lvl];
    const bx = b.x + (disp?.dx || 0);
    const by = b.y + (disp?.dy || 0);
    bajantePts.push([bx, by]);
  }
  for (const g of engine.crossFloorGhosts) {
    if (engine._hiddenNets.has(g.net)) continue;
    bajantePts.push([g.x, g.y]);
  }
  const nearBajante = (x: number, y: number) =>
    bajantePts.some(([bx, by]) => Math.hypot(bx - x, by - y) < 10);

  for (let i = 0; i < ramales.length; i++) {
    const ra = ramales[i];
    for (let j = i + 1; j < ramales.length; j++) {
      const rb = ramales[j];
      if (ra.net === rb.net) continue;

      for (let a = 0; a < ra.pts.length - 1; a++) {
        for (let b = 0; b < rb.pts.length - 1; b++) {
          const hit = segCrossing(
            ra.pts[a][0],
            ra.pts[a][1],
            ra.pts[a + 1][0],
            ra.pts[a + 1][1],
            rb.pts[b][0],
            rb.pts[b][1],
            rb.pts[b + 1][0],
            rb.pts[b + 1][1],
          );
          if (!hit) continue;

          const key = `${hit.x.toFixed(1)},${hit.y.toFixed(1)}`;
          if (seen.has(key)) continue;
          if (nearBajante(hit.x, hit.y)) continue;
          seen.add(key);

          // Deterministic: whichever net sits later in NETS hops over the earlier one.
          const raIsJumper = (NET_ORDER[ra.net] ?? 99) > (NET_ORDER[rb.net] ?? 99);
          const jumper = raIsJumper ? ra : rb;
          const other = raIsJumper ? rb : ra;
          const jSeg: [number[], number[]] = raIsJumper
            ? [ra.pts[a], ra.pts[a + 1]]
            : [rb.pts[b], rb.pts[b + 1]];
          const oSeg: [number[], number[]] = raIsJumper
            ? [rb.pts[b], rb.pts[b + 1]]
            : [ra.pts[a], ra.pts[a + 1]];

          const jumperNet = NETS.find((n) => n.id === jumper.net);
          const otherNet = NETS.find((n) => n.id === other.net);
          const jCol = jumperNet ? jumperNet.col : '#e2e2e8';
          const oCol = otherNet ? otherNet.col : '#e2e2e8';

          const c = engine.toCvs(hit.x, hit.y);
          const p1 = engine.toCvs(jSeg[0][0], jSeg[0][1]);
          const p2 = engine.toCvs(jSeg[1][0], jSeg[1][1]);
          const jDx = p2.x - p1.x,
            jDy = p2.y - p1.y;
          const jLen = Math.hypot(jDx, jDy);
          if (jLen < 1) continue;
          const jux = jDx / jLen,
            juy = jDy / jLen;
          const jperpx = -juy,
            jperpy = jux;
          const r = Math.min(gapR, jLen * 0.4);

          const q1 = engine.toCvs(oSeg[0][0], oSeg[0][1]);
          const q2 = engine.toCvs(oSeg[1][0], oSeg[1][1]);
          const oDx = q2.x - q1.x,
            oDy = q2.y - q1.y;
          const oLen = Math.hypot(oDx, oDy);
          if (oLen < 1) continue;
          const oux = oDx / oLen,
            ouy = oDy / oLen;
          const oR = Math.min(gapR * 1.4, oLen * 0.4);

          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = 3 * engine.zoom;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.moveTo(c.x - jux * r, c.y - juy * r);
          ctx.lineTo(c.x + jux * r, c.y + juy * r);
          ctx.stroke();
          ctx.restore();

          // Re-stroke the straight-through net across the same span so the erase above
          // never leaves a visible nick in it, whatever angle the two lines cross at.
          ctx.save();
          ctx.strokeStyle = oCol;
          ctx.lineWidth = 2 * engine.zoom;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(c.x - oux * oR, c.y - ouy * oR);
          ctx.lineTo(c.x + oux * oR, c.y + ouy * oR);
          ctx.stroke();
          ctx.restore();

          // The jumping net's little hop over the crossing.
          ctx.save();
          ctx.strokeStyle = jCol;
          ctx.lineWidth = 2 * engine.zoom;
          ctx.lineCap = 'round';
          const bumpAngle = Math.atan2(jperpy, jperpx);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, bumpAngle - Math.PI / 2, bumpAngle + Math.PI / 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }
}
