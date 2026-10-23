/**
 * Valida la FORMA del doc de un plano antes de dejarlo entrar al motor (viene de localStorage
 * o BD, sin esquema, y puede estar truncado): ramales como objeto → piezas sin id; bajantes
 * ausente → piso VACÍO sin error (el usuario cree que guardó).
 * @param raw contenido crudo del doc (ya parseado o sin parsear).
 * @returns el doc si tiene la forma esperada; null si no la tiene.
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
