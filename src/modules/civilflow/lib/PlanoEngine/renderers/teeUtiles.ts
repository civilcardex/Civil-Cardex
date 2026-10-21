/** Cómo decidir hacia qué lado dibuja la ramita de una T — separado de renderRamales. */
import type { IPlanoEngineCore } from '../PlanoEstado.ts';
import { pointToSegmentDist } from '../ImpactoProbador.ts';

/** Hacia qué lado sale la ramita de la T: apunta al ramal REAL que se cruza en la unión (dentro
 *  de 0.5 px); si no hay cruce, usa el cálculo clásico. */
export function pickTeeBranchDir(
  engine: IPlanoEngineCore,
  ownId: string,
  net: string,
  pt: number[],
  throughDx: number,
  throughDy: number,
  fallbackPx: number,
  fallbackPy: number,
): { px: number; py: number } {
  const px = fallbackPx;
  const py = fallbackPy;
  const pxAlt = -fallbackPx;
  const pyAlt = -fallbackPy;
  const CROSS_TOL = 0.5;
  let crossDir: { x: number; y: number } | null = null;
  let bestPerp = 2;
  for (const cr of engine.ramales) {
    if (cr.net !== net || cr.id === ownId) continue;
    if (!cr.pts || cr.pts.length < 2) continue;
    for (let ci = 0; ci < cr.pts.length - 1; ci++) {
      if (
        pointToSegmentDist(
          pt[0],
          pt[1],
          cr.pts[ci][0],
          cr.pts[ci][1],
          cr.pts[ci + 1][0],
          cr.pts[ci + 1][1],
        ) < CROSS_TOL
      ) {
        // Debe apuntar DESDE la unión HACIA el cuerpo real del ramal rama — la dirección cruda
        // del segmento ci->ci+1 depende del orden arbitrario de puntos de ese ramal (p. ej. si
        // `pt` es el propio punto final de ese segmento, ci->ci+1 apunta hacia adelante pasando
        // el punto final hacia la nada, al revés de donde está el material real de la tubería),
        // lo que elegía el lado equivocado abajo cuando el ramal cruzado quedaba dibujado
        // "lejos-y-vuelta". Anclar en el que sea de los dos extremos del segmento que queda MÁS
        // LEJOS de `pt` es independiente del orden.
        const dToCi = Math.hypot(cr.pts[ci][0] - pt[0], cr.pts[ci][1] - pt[1]);
        const dToCiNext = Math.hypot(cr.pts[ci + 1][0] - pt[0], cr.pts[ci + 1][1] - pt[1]);
        const farPt = dToCi >= dToCiNext ? cr.pts[ci] : cr.pts[ci + 1];
        const cdx = farPt[0] - pt[0];
        const cdy = farPt[1] - pt[1];
        const clen = Math.hypot(cdx, cdy);
        if (clen <= 0.01) continue;
        const ux = cdx / clen;
        const uy = cdy / clen;
        const d = Math.abs(ux * throughDx + uy * throughDy);
        if (d < bestPerp) {
          bestPerp = d;
          crossDir = { x: ux, y: uy };
        }
      }
    }
  }
  if (crossDir) {
    const dotP = px * crossDir.x + py * crossDir.y;
    const dotA = pxAlt * crossDir.x + pyAlt * crossDir.y;
    if (dotA > dotP) {
      return { px: pxAlt, py: pyAlt };
    }
    return { px, py };
  }
  // Respaldo: normalizar hacia arriba de pantalla si la perpendicular es casi horizontal, o
  // hacia la derecha si es casi vertical (convención clásica de dibujo).
  const PERP_EPS = 0.1;
  if (py > PERP_EPS) {
    return { px: -px, py: -py };
  }
  if (Math.abs(py) <= PERP_EPS && px < 0) {
    return { px: -px, py: -py };
  }
  return { px, py };
}
