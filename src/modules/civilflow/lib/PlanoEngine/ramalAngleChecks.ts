// Punto-en-caja y chequeo de ángulos excluyendo conexiones (lineTool, drag, finishRamal).
// Extraído verbatim de junctionAutoSplit (des-monolitización 2026-10-06).

import type { PlanoRamal, IPlanoEngineCore } from './PlanoState';
import { esCaja } from './bajanteRules';
import { checkRamalAngles } from './drawingAngles';

/** ¿El punto cae dentro del cuadro exterior (100×100cm a escala) de una caja de la red? Test a escala real vía cmToPlanePx. */
export function puntoEnCaja(
  engine: Pick<IPlanoEngineCore, 'bajantes' | 'cmToPlanePx'>,
  ep: number[],
  net: string,
): boolean {
  // Cuadrado axis-aligned (la caja nunca rota) + margen de snap. Fallback sin el helper
  // (mocks viejos de tests) ≈ semilado a escala por defecto.
  const half = typeof engine.cmToPlanePx === 'function' ? engine.cmToPlanePx(100) / 2 + 2.0 : 40;
  for (const b of engine.bajantes) {
    if (b.net !== net || !esCaja(b)) continue;
    if (b.x == null || b.y == null) continue;
    if (Math.abs(ep[0] - b.x) <= half && Math.abs(ep[1] - b.y) <= half) return true;
  }
  return false;
}

/** Bug #7: valida los ángulos de un ramal EXCLUYENDO los segmentos de conexión — un extremo que
 *  pega a otro ramal existente (o a un bajante) tiene el ángulo dictado por la geometría del
 *  ramal existente, no por la cuadrícula de 45°/90°. Devuelve true si los segmentos libres son
 *  válidos. Usado por finishRamal y handleDragUp. */
export function checkRamalAnglesExcludingConnections(
  engine: IPlanoEngineCore,
  r: PlanoRamal,
): boolean {
  if (!r.pts || r.pts.length < 2) return true;
  const TOL = 0.5;
  const pointOnSeg = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return Math.hypot(p[0] - a[0], p[1] - a[1]) < TOL;
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    if (t < 0.02 || t > 0.98) return false;
    const px = a[0] + t * dx,
      py = a[1] + t * dy;
    return Math.hypot(p[0] - px, p[1] - py) < TOL;
  };
  const touchesAny = (ep: number[]): boolean => {
    // Llegada a caja: exenta siempre (test a escala, sin depender de `_circ`).
    if (puntoEnCaja(engine, ep, r.net)) return true;
    for (const o of engine.ramales) {
      if (o.id === r.id || !o.pts || o.pts.length < 2) continue;
      const sameGroup =
        o.net === r.net ||
        ((o.net === 'san' || o.net === 'vent') && (r.net === 'san' || r.net === 'vent'));
      if (!sameGroup) continue;
      if (
        o.pts.some((p) => Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL) ||
        o.pts.some((_, i) => i < o.pts!.length - 1 && pointOnSeg(ep, o.pts![i], o.pts![i + 1]))
      )
        return true;
    }
    for (const b of engine.bajantes) {
      if (b.net !== r.net || esCaja(b)) continue;
      if (Math.hypot(b.x - ep[0], b.y - ep[1]) < 8 / (engine.zoom || 1)) return true;
    }
    return false;
  };
  const lastIdx = r.pts.length - 1;
  const startConnects = r.pts.length >= 2 && touchesAny(r.pts[0]);
  const endConnects = r.pts.length >= 2 && touchesAny(r.pts[lastIdx]);
  let ptsToCheck: number[][] = r.pts;
  if (startConnects && endConnects) ptsToCheck = r.pts.slice(1, lastIdx);
  else if (endConnects) ptsToCheck = r.pts.slice(0, lastIdx);
  else if (startConnects) ptsToCheck = r.pts.slice(1);
  if (ptsToCheck.length < 2) return true;
  return checkRamalAngles(ptsToCheck, r.net, r.tipo, engine.snapMode);
}
