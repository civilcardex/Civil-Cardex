/**
 * Marca de navegación INTERNA de la propia app (switch de proyecto, checkout de pago).
 *
 * El signOut de "no recordar" escucha `pagehide`, que se dispara en TODA descarga del
 * documento — incluidos los reloads que la app provoca. Sin la marca, cambiar de proyecto
 * cerraba la sesión en carrera con la navegación (logout aleatorio; y volver del checkout
 * sin sesión mataba la verificación del pago). sessionStorage: una marca por navegación,
 * muere sola al cerrar la pestaña.
 */
export function marcarNavInterna(): void {
  try {
    sessionStorage.setItem('cf_nav_interna', '1');
  } catch {
    /* storage bloqueado: el pagehide hará signOut — comportamiento viejo */
  }
  // TTL de seguridad: si la navegación marcada se interrumpe (redirect bloqueado,
  // beforeunload cancelado), la marca huérfana haría que el PRÓXIMO pagehide real
  // (cierre de pestaña con "no recordar") se saltara el signOut una vez. 15 s cubre
  // de sobra el replace/assign; una navegación viva ya consumió la marca antes.
  setTimeout(() => limpiarNavInterna(), 15000);
}

/** ¿El pagehide en curso es una navegación que la propia app disparó? */
export function esNavInterna(): boolean {
  try {
    return sessionStorage.getItem('cf_nav_interna') === '1';
  } catch {
    return false;
  }
}

/** Consume la marca (una navegación = un uso). */
export function limpiarNavInterna(): void {
  try {
    sessionStorage.removeItem('cf_nav_interna');
  } catch {
    /* ignore */
  }
}
