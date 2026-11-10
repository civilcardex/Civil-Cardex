/** Distancia mínima ramal↔muro (NFPA 13, RCI): un ramal no puede quedar pegado ni cruzar
 *  un muro. Única copia — la comparten el chequeo EN VIVO del visor y la verificación de
 *  tabla del módulo RCI (si difirieran, el mismo trazo pasaría en el dibujo y fallaría en
 *  la tabla). Ej: distSegSeg(muro, ramal) < MIN_MURO_M → violación. */
export const MIN_MURO_M = 0.1;

/** Distancia mínima entre dos segmentos AB y CD (en las unidades que vengan). Punto-a-
 *  segmento en ambos sentidos + test de cruce (se cruzan → 0). Ej: un muro que atraviesa el
 *  ramal queda a 0 m aunque sus extremos estén lejos (verificación ramales↔muros del RCI). */
export function distSegSeg(a: number[], b: number[], c: number[], d: number[]): number {
  const cross = (o: number[], p: number[], q: number[]): number =>
    (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return 0;
  const dPuntoSeg = (p: number[], s: number[], e: number[]): number => {
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dy));
  };
  return Math.min(dPuntoSeg(a, c, d), dPuntoSeg(b, c, d), dPuntoSeg(c, a, b), dPuntoSeg(d, a, b));
}

/** ¿El punto cae dentro del polígono (ray casting)? Los vértices deben estar en orden de
 *  recorrido (el polígono de un área dibujada lo es). Única copia — la usan el conteo de
 *  rociadores del rectángulo de fuego (RCIDesign), el canvas (RCISvgCanvas) y su banner.
 *  Ej: puntoEnPoligono([2,3], [[0,0],[10,0],[10,10],[0,10]]) → true. */
export function puntoEnPoligono(p: number[], poly: number[][]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as [number, number];
    const [xj, yj] = poly[j] as [number, number];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi)
      c = !c;
  }
  return c;
}

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
