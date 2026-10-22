/**
 * Promueve los <link rel="preload" as="style"> de Google Fonts a rel="stylesheet".
 *
 * Va en un archivo (no inline) porque la CSP de producción lleva `script-src 'self'`
 * sin `'unsafe-inline'`: el atributo onload de los <link> era un event handler inline
 * que el navegador rechazaba y las fuentes (Hanken Grotesk, Geist, Material Symbols)
 * jamás se activaban en producción — en dev el CSP se relaja y por eso allí sí veían.
 */
(function () {
  var enlaces = document.querySelectorAll('link[rel="preload"][as="style"]');
  for (var i = 0; i < enlaces.length; i++) {
    enlaces[i].rel = 'stylesheet';
  }
})();
