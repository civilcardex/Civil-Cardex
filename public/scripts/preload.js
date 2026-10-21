/**
 * Ajusta el texto de la pantalla de carga ANTES del primer paint.
 *
 * Va en un archivo (no inline) para que la CSP de producción pueda llevar
 * `script-src 'self'` sin `'unsafe-inline'`.
 */
(function () {
  // El visor abre el PDF (planos y redes); el resto de la app, un proyecto. Se ajusta antes
  // del primer paint para que esta pantalla y la de React digan lo MISMO (una sola, sin
  // cambio de texto al hidratar).
  if (location.pathname.indexOf('/visor') === 0) {
    var msg = document.getElementById('_preloadMsg');
    if (msg) msg.textContent = 'Cargando planos y redes…';
  }
})();
