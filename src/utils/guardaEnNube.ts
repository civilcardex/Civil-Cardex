import { devError } from './desarrolloError.ts';

/** Nombre del evento de ventana con el que se avisa de un fallo de guardado en la nube.
 *  Contrato compartido: lo emiten los servicios de guardado y lo escucha el proveedor
 *  global de alertas (GlobalAlertaDialogoProveedor), que es el único que lo muestra. */
export const EVENTO_ERROR_GUARDADO = 'civilflow_bd_save_error';

/** Avisa a toda la app de que un guardado en la nube falló.
 *  Ej: el RPC de planos falló -> sale el diálogo "No se pudo guardar en la nube".
 *  @param reason etiqueta corta del guardado que falló (p. ej. 'planos').
 *  @param message detalle del error (mensaje de Supabase o excepción).
 */
export function emitErrorGuardado(reason: string, message: string): void {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_ERROR_GUARDADO, { detail: { reason, message } }));
  } catch {
    /* sin window (tests en node) */
  }
}

/** Ejecuta un guardado en la nube reintentando ante fallo y avisa si no se logra.
 *  Sin este reintento, un 5xx puntual en una subida (idempotente) dejaba el plano sin
 *  binario en la nube y el usuario lo descubría en otro dispositivo, sin aviso.
 *  @param etiqueta nombre corto para los logs y el aviso (p. ej. 'pdf-plano').
 *  @param fn operación de guardado a ejecutar.
 *  @param intentos número máximo de intentos (por defecto 3).
 *  @returns el resultado de la operación, o null si falló en todos los intentos.
 */
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
