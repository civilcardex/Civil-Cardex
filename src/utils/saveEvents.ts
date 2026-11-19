/** Constantes de eventos de guardado compartidas por TODO el árbol (GlobalAlertDialog en
 *  el entry las escucha) — archivo mínimo para que el entry no arrastre el chunk completo
 *  de saveToCloud (guardaConReintento y deps) como modulepreload de la HOME. */
/** Nombre del evento de ventana con el que se avisa de un fallo de guardado en la nube.
 *  Contrato compartido: lo emiten los servicios de guardado y lo escucha el proveedor
 *  global de alertas (GlobalAlertaDialogoProveedor), que es el único que lo muestra. */
export const EVENTO_ERROR_GUARDADO = 'civilflow_bd_save_error';

/** Avisa a toda la app de que un guardado en la nube falló. Ej: el RPC de planos falló -> sale el diálogo "No se pudo guardar en la nube". */
export function emitErrorGuardado(reason: string, message: string): void {
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_ERROR_GUARDADO, { detail: { reason, message } }));
  } catch {
    /* sin window (tests en node) */
  }
}
