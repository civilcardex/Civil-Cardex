import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../lib/PlanoEngine/PlanoState';

const BLOCKED_MESSAGE =
  'El bajante con dirección "baja" solo puede recibir flujo. Conecta el ramal al extremo final (no al inicio).';

const SUBE_BLOCKED_MESSAGE =
  'El bajante con dirección "sube" solo puede entregar flujo. Conecta el ramal al extremo inicial (no al final).';

/**
 * Centralized guard for "ramal endpoint ↔ bajante" flow direction. Returns true if the connection
 * is allowed, false if it would route flow the wrong way across the bajante:
 * - a ramal START (pts[0]) on a 'baja' bajante (would make a receive-only bajante emit), or
 * - a ramal FIN (pts[last]) on a 'sube' bajante (would make an emit-only bajante receive).
 *
 * Centralizing here means every place that assigns r.ini = b.code or r.fin = b.code calls the
 * same rule — without this, a fix that only guarded one path would silently let other paths
 * create the same invalid association (a user dragging the ramal near the bajante, or
 * finishRamal matching by coincidence, etc.).
 *
 * @param engine  Engine core instance.
 * @param r       Ramal whose endpoint is being connected.
 * @param epIdx   Which endpoint: 0 for pts[0] (START — the origin side), lastIdx for pts[fin].
 * @param b       Bajante being connected to.
 * @returns true if the connection is fine; false if it should be blocked.
 */
export function isRamalBajanteConnectionAllowed(
  engine: IPlanoEngineCore,
  _r: PlanoRamal,
  epIdx: 0 | number,
  b: PlanoBajante,
): boolean {
  if (epIdx === 0 && b.direccion === 'baja') {
    if (engine.triggerAlert) {
      engine.triggerAlert('Dirección de flujo inconsistente', BLOCKED_MESSAGE);
    }
    return false;
  }
  if (b.direccion === 'sube' && epIdx !== 0) {
    if (engine.triggerAlert) {
      engine.triggerAlert('Dirección de flujo inconsistente', SUBE_BLOCKED_MESSAGE);
    }
    return false;
  }
  return true;
}

/**
 * AF/AC/gas junction validation: unlike san/vent/ll (single trunk direction, enforced by a
 * separate "must match main's direction" check elsewhere), an af/ac/gas supply main legitimately
 * branches in several directions from one point — so there's no single direction to match.
 * Instead every junction must have at least one ramal actually flowing OUT of it (a point where
 * every touching ramal only flows IN is a dead end with no supply, invalid plumbing). Returns
 * true if `pt` is not actually a junction (fewer than 2 ramales touch it) or has an outgoing ramal.
 */
export function junctionHasOutgoingFlow(
  ramales: Pick<PlanoRamal, 'net' | 'pts' | '_tribReversed'>[],
  net: string,
  pt: number[],
  tol = 0.5,
): boolean {
  let touching = 0;
  let hasOutgoing = false;
  for (const r of ramales) {
    if (r.net !== net || !r.pts || r.pts.length < 2) continue;
    const p0 = r.pts[0];
    const p1 = r.pts[r.pts.length - 1];
    const originPt = r._tribReversed ? p1 : p0;
    const destPt = r._tribReversed ? p0 : p1;
    const atOrigin = Math.hypot(originPt[0] - pt[0], originPt[1] - pt[1]) < tol;
    const atDest = Math.hypot(destPt[0] - pt[0], destPt[1] - pt[1]) < tol;
    let bodyTouch = false;
    if (!atOrigin && !atDest) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [ax, ay] = r.pts[i];
        const [bx, by] = r.pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 0.0001) continue;
        const t = ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / lenSq;
        if (t < 0 || t > 1) continue;
        const px = ax + t * dx;
        const py = ay + t * dy;
        if (Math.hypot(pt[0] - px, pt[1] - py) < tol) {
          bodyTouch = true;
          break;
        }
      }
    }
    if (!atOrigin && !atDest && !bodyTouch) continue;
    touching++;
    // A ramal passing THROUGH pt mid-body (not ending there) continues past the junction in its
    // own flow direction — that continuation is itself an outgoing leg, same as a ramal whose own
    // origin sits exactly at pt. Only a ramal whose flow DESTINATION (and nothing past it) lands
    // at pt contributes no outgoing leg here.
    if (atOrigin || bodyTouch) hasOutgoing = true;
  }
  if (touching < 2) return true;
  return hasOutgoing;
}
