export interface Point {
  x: number;
  y: number;
}

/**
 * Matemática de coordenadas y snap de ángulo del motor CAD, como funciones puras sobre el
 * fragmento de cámara/escala que usan (zoom/offX/offY/scaleM/definedScaleM). La clase
 * PlanoEngine conserva métodos delegadores de una línea — la firma pública no cambia.
 */

export interface Camara {
  zoom: number;
  offX: number;
  offY: number;
}

/** px de plano → px de canvas (cámara: zoom + pan). */
export function toCvs(cam: Camara, px: number, py: number): Point {
  return { x: px * cam.zoom + cam.offX, y: py * cam.zoom + cam.offY };
}

/** px de canvas → px de plano (inversa). */
export function toPlane(cam: Camara, cx: number, cy: number): Point {
  return { x: (cx - cam.offX) / cam.zoom, y: (cy - cam.offY) / cam.zoom };
}

/** px de plano → metros reales con la escala del plano. */
export function pxToM(scaleM: number, px: number): number {
  return +((px / 96) * 2.54 * scaleM).toFixed(3);
}

/** mm de papel → px de canvas (a la escala de la hoja). */
export function mm2cvs(mm: number, zoom: number): number {
  return ((mm * 96) / 25.4) * zoom;
}

/** Inversa de pxToM: longitud REAL en cm → px de coordenada de plano (independiente de
 *  zoom/pan). El rectángulo de base/altura de un canal escala con la escala real igual que
 *  totalL de un ramal. */
export function cmToPlanePx(scaleM: number, cm: number): number {
  return ((cm / 100) * 96) / (2.54 * (scaleM || 0.5));
}

/** cmToPlanePx aplicado a la transformación actual — solo render; nunca guardar geometría. */
export function cmToCanvasPx(p: { scaleM: number; zoom: number }, cm: number): number {
  return cmToPlanePx(p.scaleM, cm) * p.zoom;
}

/** mm REALES del edificio → px de canvas, respetando la escala definida (o la del doc) y con
 *  piso mínimo de 1 mm de papel: en escalas arquitectónicas comunes estos símbolos deben caber
 *  en una pared de ~15 cm (≈3 mm de papel a 1:50) — un piso generoso los haría imprecisos. */
export function realMmToCanvasPx(
  p: { definedScaleM: number; scaleM: number; zoom: number },
  realRadiusMm: number,
): number {
  const MIN_PAPER_MM = 1;
  const defScale = p.definedScaleM || p.scaleM || 0.5;
  const paperMm = realRadiusMm / (100 * defScale);
  return mm2cvs(Math.max(MIN_PAPER_MM, paperMm), p.zoom);
}

/** Escala de las etiquetas del plano: 0.5/escala definida, acotada a [0.1, 3]. */
export function labelScaleM(p: { definedScaleM: number; scaleM: number }): number {
  const defScale = p.definedScaleM || p.scaleM;
  return Math.max(0.1, Math.min(3.0, 0.5 / defScale));
}

/** Pega el extremo (x1,y1) a la orientación permitida de la red: tributarios de af/ac caen en
 *  cuadrícula de 90° (ver checkRamalAngles); todo lo demás (incl. san/ll) en la más laxa de
 *  45° — pegar a 45° nunca produce un ángulo inválido. Conserva la distancia al origen. */
export function snapAngle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  net?: string,
  tipo?: string,
): Point {
  const dx = x1 - x0,
    dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return { x: x1, y: y1 };
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const isTributarioAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';
  const allowed = isTributarioAcAf ? [0, 90, 180, -90] : [0, 45, 90, 135, 180, -135, -90, -45];
  let best = 0,
    minDiff = 999;
  allowed.forEach((a) => {
    const diff = Math.abs(((deg - a + 540) % 360) - 180);
    if (diff < minDiff) {
      minDiff = diff;
      best = a;
    }
  });
  const sr = (best * Math.PI) / 180;
  return { x: x0 + dist * Math.cos(sr), y: y0 + dist * Math.sin(sr) };
}
