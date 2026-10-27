/**
 * Etiqueta de leader 3D compartida por epc3d y rci3d: flecha en la punta → codo inclinado →
 * segmento horizontal → círculo con el número. Port 1:1 del drawLabel del HTML original —
 * la geometría es idéntica; solo cambian color, grosor y fuente por módulo.
 */
export function dibujarEtiquetaLider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: string | number,
  sc: number,
  dir: number,
  ang: number,
  L1: number,
  L2: number,
  col: string,
  lw: number,
  fuente: string,
): void {
  const R = Math.round(14 * sc);
  const fs = Math.round(21 * sc);
  const as = Math.round(6 * sc);

  const rad = (ang * Math.PI) / 180;
  const sign = dir === 0 ? 1 : -1;
  // Codo: sube L2 desde la punta, inclinado ang grados hacia el lado del círculo
  const kx = x + sign * Math.sin(rad) * L2;
  const ky = y - Math.cos(rad) * L2;
  // Círculo: L1 horizontal desde el codo
  const cx = kx + sign * L1;
  const cy = ky;

  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = lw;

  // Segmento con flecha: punta → codo
  ctx.beginPath();
  ctx.moveTo(x + sign * Math.sin(rad) * as * 1.8, y - Math.cos(rad) * as * 1.8);
  ctx.lineTo(kx, ky);
  ctx.stroke();

  // Flecha en la punta
  const fx1 = x + sign * Math.sin(rad) * as * 1.8 - Math.cos(rad) * as;
  const fy1 = y - Math.cos(rad) * as * 1.8 - sign * Math.sin(rad) * as;
  const fx2 = x + sign * Math.sin(rad) * as * 1.8 + Math.cos(rad) * as;
  const fy2 = y - Math.cos(rad) * as * 1.8 + sign * Math.sin(rad) * as;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(fx1, fy1);
  ctx.lineTo(fx2, fy2);
  ctx.closePath();
  ctx.fill();

  // Segmento horizontal: codo → borde del círculo
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(cx - sign * R, cy);
  ctx.stroke();

  // Círculo + número
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = fuente.replace('{fs}', String(fs));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id), cx, cy);
}
