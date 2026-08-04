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
