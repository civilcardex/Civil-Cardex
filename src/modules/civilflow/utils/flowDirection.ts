import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../lib/PlanoEngine/PlanoState';

const BLOCKED_MESSAGE =
  'El bajante con dirección "baja" solo puede recibir flujo. Conecta el ramal al extremo final (no al inicio).';

/**
 * Centralized guard for "ramal endpoint ↔ bajante" flow direction. Returns true if the connection
 * is allowed, false if it would route the ramal's START (pts[0]) onto a bajante that only
 * receives flow (direccion === 'baja') — which is geometrically possible but semantically wrong:
 * a 'baja' bajante transports flow downward but never distributes it sideways at this floor.
 *
 * Centralizing here means every place that assigns r.ini = b.code or r.fin = b.code calls the
 * same rule — without this, the previous fix only guarded the auto-connect path during bajDrag
 * and silently let other paths create the same invalid association (a user dragging the ramal
 * near the bajante, or finishRamal matching by coincidence, etc.).
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
  return true;
}
