/**
 * Valida la FORMA del doc de un plano antes de dejarlo entrar al motor.
 *
 * Por qué: el doc viene de `localStorage` (JSON.parse sin esquema) o de la BD, y puede
 * ser de una era vieja o estar truncado (escritura interrumpida, cuota al límite). Sin
 * validación:
 *   - `ramales` como objeto en vez de array → `dedupPorId` itera los VALORES y el motor
 *     recibe piezas sin `id` con `pts` posiblemente undefined;
 *   - `bajantes` ausente → `engine.bajantes = []` → el piso aparece VACÍO, sin error y sin
 *     aviso (el usuario cree que guardó y el piso queda vacío en la BD).
 *
 * @param raw contenido crudo del doc (ya parseado o sin parsear).
 * @returns el doc si tiene la forma esperada; `null` si no la tiene.
 */
export function validaDocTrazos(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  let d: unknown = raw;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== 'object') return null;
  const doc = d as Record<string, unknown>;
  for (const k of ['ramales', 'bajantes', 'areas', 'dims', 'textAnnots', 'guideLines'] as const) {
    const v = doc[k];
    // AUSENTE es tolerable (un piso puede no tener áreas); presente pero no-array, no.
    if (v != null && !Array.isArray(v)) return null;
  }
  return doc;
}
