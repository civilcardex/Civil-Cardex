/** Distancia del punto p al segmento a→b (px): la proyección se recorta al tramo, así que "más allá del extremo" mide hasta el extremo. Es la base de todos los hit-tests de tuberías. */
export function distToSegment(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Distancia del punto a la polilínea completa (el mínimo entre sus segmentos). @returns px; Infinity si pts está vacía. */
export function distToPolyline(p: number[], pts: number[][]): number {
  let minDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(p, pts[i], pts[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** Origen de flujo del trazo (primera/última pts según _tribReversed (flag de flujo invertido en tributario)). */
export function origenDe(r: { pts?: number[][] | null; _tribReversed?: boolean }): number[] {
  const pts = r.pts || [];
  if (pts.length < 2) return [];
  return r._tribReversed ? (pts[pts.length - 1] as number[]) : (pts[0] as number[]);
}
