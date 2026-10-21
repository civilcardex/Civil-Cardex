/**
 * Fija el `canonical` y el `og:url` a la URL real de la página.
 *
 * Va en un ARCHIVO (no inline en index.html) para que la CSP de producción pueda
 * llevar `script-src 'self'` sin `'unsafe-inline'`: un script inline exige
 * 'unsafe-inline', que anula por completo la restricción de script-src.
 */
(function () {
  var currentUrl = window.location.origin + window.location.pathname;
  var canonical = document.getElementById('canonical-link');
  if (canonical) canonical.setAttribute('href', currentUrl);
  var ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', currentUrl);
})();
