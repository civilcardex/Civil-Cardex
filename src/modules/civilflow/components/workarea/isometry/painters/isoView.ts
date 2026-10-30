/** Parámetros de la cámara isométrica que comparten todos los pintores: rotaciones, zoom,
 * desplazamiento y centro del lienzo. Ej: pintaCanales recibe una VistaIso y proyecta cada
 * esquina del canal con project(x, y, z, rotZ, rotX, scaleZ, zoom, offX, offY, cx, cy). */
export interface VistaIso {
  rotZ: number;
  rotX: number;
  scaleZ: number;
  zoom: number;
  offX: number;
  offY: number;
  cx: number;
  cy: number;
}
