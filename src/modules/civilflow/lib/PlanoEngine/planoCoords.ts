export interface Point {
  x: number;
  y: number;
}

/** Utilidades de coordenadas: convertir entre píxeles del plano, píxeles de pantalla y metros reales, y pegar ángulos. scaleM (escala metros reales por píxel del plano) viaja en cada llamada. Ej: a escala 0.05, 100 px del plano son 0.13 m. */

export interface Camara {
  zoom: number;
  offX: number;
  offY: number;
}

/** Pasa un punto del plano a la pantalla aplicando zoom y desplazamiento (pan) de la cámara. Ej: zoom 2 y sin pan, el punto (10,20) se pinta en (20,40). */
export function toCvs(cam: Camara, px: number, py: number): Point {
  return { x: px * cam.zoom + cam.offX, y: py * cam.zoom + cam.offY };
}

/** Inversa de toCvs: pasa un punto de pantalla a coordenadas del plano. Úsala para saber en qué punto del dibujo se hizo clic. Ej: con zoom 2, un clic en (20,40) es el punto (10,20) del plano. */
export function toPlane(cam: Camara, cx: number, cy: number): Point {
  return { x: (cx - cam.offX) / cam.zoom, y: (cy - cam.offY) / cam.zoom };
}

/** Convierte una medida tomada en píxeles del plano a metros reales del edificio. Ej: 100 px con scaleM 0.05 = 0.13 m. */
export function pxToM(scaleM: number, px: number): number {
  return +((px / 96) * 2.54 * scaleM).toFixed(3);
}

/** mm de papel → px de canvas (a la escala de la hoja). */
export function mm2cvs(mm: number, zoom: number): number {
  return ((mm * 96) / 25.4) * zoom;
}

/** Inversa de pxToM: cm reales a px de plano (independe de zoom/pan).
 *  @param scaleM (escala metros por pixel) del plano; @param cm longitud en cm; @returns px de plano. */
export function cmToPlanePx(scaleM: number, cm: number): number {
  return ((cm / 100) * 96) / (2.54 * (scaleM || 0.5));
}

/** cmToPlanePx aplicado a la transformación actual — solo render; nunca guardar geometría. */
export function cmToCanvasPx(p: { scaleM: number; zoom: number }, cm: number): number {
  return cmToPlanePx(p.scaleM, cm) * p.zoom;
}

/** mm del edificio a px de canvas (piso 1 mm papel, cabe en pared 15 cm a 1:50).
 *  @param p escalas y zoom; @param realRadiusMm radio en mm; @returns px de canvas. */
export function realMmToCanvasPx(
  p: { definedScaleM: number; scaleM: number; zoom: number },
  realRadiusMm: number,
): number {
  const MIN_PAPER_MM = 1;
  const defScale = p.definedScaleM || p.scaleM || 0.5;
  const paperMm = realRadiusMm / (100 * defScale);
  return mm2cvs(Math.max(MIN_PAPER_MM, paperMm), p.zoom);
}

/** Qué tan grandes se ven los textos de las etiquetas: si el plano está a escala chica, las letras
 *  crecen para que sigan leyéndose. Siempre entre 0.1 y 3. */
export function labelScaleM(p: { definedScaleM: number; scaleM: number }): number {
  const defScale = p.definedScaleM || p.scaleM;
  return Math.max(0.1, Math.min(3.0, 0.5 / defScale));
}

/** Imán de ángulos del trazo: solo se dibuja a 45°/90° (y los ramalitos de af (Agua Fría) y ac
 *  (Agua Caliente) a 90° justos), para que las tuberías queden rectas o en escuadra.
 *  @param x0 coord X del origen; @param net red activa; @returns punto pegado al ángulo legal. */
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
