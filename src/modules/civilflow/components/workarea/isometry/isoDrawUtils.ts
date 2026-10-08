// Helpers de dibujo isométrico extraídos de useIsometryRender (puros, sin estado).
import { ISO_SCALE } from './geometry';

export interface IsoPt {
  sx: number;
  sy: number;
}

export function shadeHex(col: string, f: number): string {
  const n = parseInt(col.replace('#', ''), 16);
  if (!Number.isFinite(n)) return col;
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

export function hexA(col: string, a: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(col)) return col;
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Vectores unitarios ortográficos en espacio de pantalla para los ejes del mundo en un punto iso
 *  dado — cada paso equivale a UN METRO MUNDIAL (ISO_SCALE unidades iso), de modo que el código
 *  que lo invoca puede dimensionar elementos directamente en metros. */
export function isoAxisVecs(
  proj: (x: number, y: number, z: number) => IsoPt,
  bx: number,
  by: number,
  z: number,
): { vX: IsoPt; vY: IsoPt; vZ: IsoPt } {
  const O = proj(bx, by, z);
  const pX = proj(bx + ISO_SCALE, by, z);
  const pY = proj(bx, by + ISO_SCALE, z);
  const pZ = proj(bx, by, z + ISO_SCALE);
  return {
    vX: { sx: pX.sx - O.sx, sy: pX.sy - O.sy },
    vY: { sx: pY.sx - O.sx, sy: pY.sy - O.sy },
    vZ: { sx: pZ.sx - O.sx, sy: pZ.sy - O.sy },
  };
}

/**
 * Dibuja un cuboide isométrico SÓLIDO (las 6 caras, ordenadas por profundidad de pintado) con su
 * base centrada en (bx, by, z), huella w x d y altura h — dimensiones en metros mundiales. Se usa
 * para los equipos calentador/contador, para que se lean como equipos 3D cerrados.
 */
export function drawIsoCuboid(
  ctx: CanvasRenderingContext2D,
  proj: (x: number, y: number, z: number) => IsoPt,
  bx: number,
  by: number,
  z: number,
  w: number,
  d: number,
  h: number,
  fill: string,
  stroke: string,
  hl = false,
): void {
  const { vX, vY, vZ } = isoAxisVecs(proj, bx, by, z);
  const O = proj(bx, by, z);
  const P = (dx: number, dy: number, dz: number): IsoPt => ({
    sx: O.sx + vX.sx * dx + vY.sx * dy + vZ.sx * dz,
    sy: O.sy + vX.sy * dx + vY.sy * dy + vZ.sy * dz,
  });
  const o0 = P(0, 0, 0);
  const px = P(w, 0, 0);
  const py = P(0, d, 0);
  const pxy = P(w, d, 0);
  const t0 = P(0, 0, h);
  const tx = P(w, 0, h);
  const ty = P(0, d, h);
  const txy = P(w, d, h);
  // Las 6 caras; ordenadas por pintado según el promedio de y en pantalla (en esta proyección
  // ortográfica una cara más abajo en pantalla queda al frente — ver project(): sy mayor = más
  // cerca de la cámara), de modo que las caras traseras quedan cubiertas por las delanteras sin
  // importar rotZ/rotX — la caja siempre se lee como cerrada/sólida.
  const faces: { pts: IsoPt[]; shade: number }[] = [
    { pts: [o0, px, pxy, py], shade: 0.42 },
    { pts: [t0, tx, txy, ty], shade: 1 },
    { pts: [o0, px, tx, t0], shade: 0.8 },
    { pts: [py, pxy, txy, ty], shade: 0.55 },
    { pts: [o0, py, ty, t0], shade: 0.68 },
    { pts: [px, pxy, txy, tx], shade: 0.88 },
  ];
  faces.sort(
    (a, b) =>
      a.pts.reduce((s, p) => s + p.sy, 0) / a.pts.length -
      b.pts.reduce((s, p) => s + p.sy, 0) / b.pts.length,
  );
  const quad = (pts: IsoPt[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    ctx.lineTo(pts[1].sx, pts[1].sy);
    ctx.lineTo(pts[2].sx, pts[2].sy);
    ctx.lineTo(pts[3].sx, pts[3].sy);
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = hl ? 2.4 : 1.2;
  for (const f of faces) {
    ctx.fillStyle = shadeHex(fill, f.shade);
    quad(f.pts);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
