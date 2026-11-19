import { devError } from './devError.ts';
import { EVENTO_ERROR_GUARDADO, emitErrorGuardado } from './saveEvents.ts';
export { EVENTO_ERROR_GUARDADO, emitErrorGuardado };

/** Ejecuta un guardado en la nube reintentando ante fallo y avisa si no se logra. Sin el
 *  reintento, un 5xx puntual dejaba el plano sin binario en la nube y sin aviso. */
export async function guardaConReintento<T>(
  etiqueta: string,
  fn: () => Promise<T>,
  intentos = 3,
): Promise<T | null> {
  for (let i = 1; i <= intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      devError(`${etiqueta} intento ${i}:`, e);
      if (i === intentos) {
        emitErrorGuardado(etiqueta, e instanceof Error ? e.message : String(e));
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (i - 1)));
    }
  }
  return null;
}
