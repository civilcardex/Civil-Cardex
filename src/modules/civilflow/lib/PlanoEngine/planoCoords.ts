/** Vocabulario de medidas del motor: la misma distancia se puede contar en tres unidades (papel del
 *  PDF, píxeles del plano y metros reales del edificio) y aquí se traduce entre ellas.
 *  Ej: a escala 0.05 (0.05 m de edificio por píxel de plano), 100 px del plano son 0.13 m reales. */

export interface Point {
  x: number;
  y: number;
}

export interface Camara {
  zoom: number;
  offX: number;
  offY: number;
}

/** Pone un punto del plano en la pantalla: le aplica el zoom y el desplazamiento (pan) de la
 *  cámara. Ej: con zoom 2 y sin pan, el punto (10,20) del plano se pinta en (20,40). */
export function toCvs(cam: Camara, px: number, py: number): Point {
  return { x: px * cam.zoom + cam.offX, y: py * cam.zoom + cam.offY };
}

/** Al revés de {@link toCvs}: traduce un clic de la pantalla al punto del dibujo donde cayó.
 *  Ej: con zoom 2, un clic en (20,40) es el punto (10,20) del plano. */
export function toPlane(cam: Camara, cx: number, cy: number): Point {
  return { x: (cx - cam.offX) / cam.zoom, y: (cy - cam.offY) / cam.zoom };
}

/** Convierte una longitud medida en píxeles del plano a metros reales del edificio.
 *  Ej: 100 px a escala 0.05 dan 0.13 m. */
export function pxToM(scaleM: number, px: number): number {
  return +((px / 96) * 2.54 * scaleM).toFixed(3);
}

/** Pasa milímetros de papel (la medida tal como viene en la lámina PDF) a píxeles de pantalla:
 *  el papel son 96 píxeles por pulgada. Ej: un codo de 15 mm a zoom 1 ocupa ~57 px de pantalla. */
export function mm2cvs(mm: number, zoom: number): number {
  return ((mm * 96) / 25.4) * zoom;
}

/** Pasa centímetros reales del edificio a píxeles del plano, la dirección inversa de {@link pxToM}.
 *  Ej: 100 cm a escala 0.05 ocupan 756 px del plano. */
export function cmToPlanePx(scaleM: number, cm: number): number {
  return ((cm / 100) * 96) / (2.54 * (scaleM || 0.5));
}

/** Como {@link cmToPlanePx} pero ya en píxeles de pantalla. Úsala solo para pintar: lo que se guarda
 *  del dibujo va en píxeles del plano, para que no dependa del zoom con el que se vio. */
export function cmToCanvasPx(p: { scaleM: number; zoom: number }, cm: number): number {
  return cmToPlanePx(p.scaleM, cm) * p.zoom;
}

/** Pinta un objeto de tamaño REAL (una tubería de 15 cm) con el tamaño que le toca en la hoja. Si
 *  saldría diminuto (plano muy alejado), se dibuja al menos con 1 mm de papel para que no
 *  desaparezca. Ej: 15 cm reales a escala 0.05 son 3 mm de papel. */
export function realMmToCanvasPx(
  p: { definedScaleM: number; scaleM: number; zoom: number },
  realRadiusMm: number,
): number {
  const MIN_PAPER_MM = 1;
  const defScale = p.definedScaleM || p.scaleM || 0.5;
  const paperMm = realRadiusMm / (100 * defScale);
  return mm2cvs(Math.max(MIN_PAPER_MM, paperMm), p.zoom);
}

/** Cuánto se agranda el texto de las etiquetas: en planos muy alejados las letras crecen para que se
 *  sigan leyendo. Siempre entre 0.1 y 3. Ej: a escala 0.01 se dibujan 3 veces más grandes. */
export function labelScaleM(p: { definedScaleM: number; scaleM: number }): number {
  const defScale = p.definedScaleM || p.scaleM;
  return Math.max(0.1, Math.min(3.0, 0.5 / defScale));
}

/** Corrige el último punto del trazo para que el tramo salga a un ángulo de regla: 45° o 90° (los
 *  ramalitos de af (Agua Fría) y ac (Agua Caliente), solo a 90°), y el remate a escuadra.
 *  Ej: un ramal dibujado a 43° se ajusta a 45° — la punta se mueve, la longitud no cambia. */
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
