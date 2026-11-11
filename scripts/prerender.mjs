// Prerender post-build: escribe dist/<ruta>/index.html para las rutas públicas usando el
// bundle SSR (dist-ssr/prerenderEntry.js, generado con `vite build --ssr`).
// SIN dependencias nuevas. Fallo = exit 1 (build rojo en Vercel); el dist preexistente
// no se corrompe — solo se sobreescribe lo prerenderizado con éxito.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// ── Stubs de browser ANTES de cargar el bundle SSR (crawlers y node no tienen DOM) ──
const storageStub = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
};
const localStorage = storageStub();
const matchMedia = () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
});
globalThis.window = globalThis;
// Flag para seeds de estado que en SSR deben nacer "listo" (ej. hero del landing:
// sin JS no hay timer de 250 ms — el HTML debe traer el hero, no el skeleton).
globalThis.__CIVILCARDEX_PRERENDER__ = true;
globalThis.localStorage = localStorage;
globalThis.sessionStorage = storageStub();
globalThis.matchMedia = matchMedia;
globalThis.location = globalThis.location ?? { hash: '', pathname: '/', origin: 'https://civilcardex.com', href: 'https://civilcardex.com/', search: '' };
try { globalThis.navigator = globalThis.navigator ?? { userAgent: 'civilcardex-prerender' }; } catch { /* getter-only en node moderno */ }
globalThis.document = globalThis.document ?? {
  createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
};

async function main() {
  const ssr = await import(pathToFileURL(join(ROOT, 'dist-ssr', 'prerenderEntry.js')).href);
  const { renderPage } = ssr;
  const { ROUTE_META, SITE_URL } = ssr;

  const template = readFileSync(join(DIST, 'index.html'), 'utf8');
  const ROOT_OPEN = '<div id="root">';
  const BODY_CLOSE = '</body>';

  let ok = 0;
  const fallos = [];
  for (const meta of ROUTE_META) {
    try {
      const html = renderPage(meta.path);
      if (!html || html.length < 200) throw new Error(`render vacío o sospechoso (${html.length}B)`);
      const url = SITE_URL + meta.path;
      const title = `${meta.title} | Civil Cardex`;
      let out = template;
      // 1) contenido del #root: preload → HTML prerenderizado
      const a = out.indexOf(ROOT_OPEN);
      const b = out.indexOf(BODY_CLOSE, a);
      if (a < 0 || b < 0) throw new Error('plantilla sin #root o </body>');
      out = out.slice(0, a + ROOT_OPEN.length) + html + out.slice(b);
      // 2) head por ruta (title/description/canonical/og/twitter) — mismos formatos que
      // usePageMeta. CADA replace se aserta: si el template cambia, falla RUIDOSO (A-2)
      // en vez de publicar 14 rutas con metas de la home.
      const swap = (re, reemplazo, tag) => {
        if (!re.test(out)) {
          const n = (out.match(/<link rel="canonical"/g) || []).length;
          throw new Error(`head: no matchea ${tag} (canonical en out: ${n}, len out: ${out.length})`);
        }
        out = out.replace(re, reemplazo);
      };
      // [regex, contenido, tag] — cada entrada se aserta como las swap individuales de antes.
      const desc = meta.description.replace(/"/g, '&quot;');
      for (const [re, contenido, tag] of [
        [/<title>[\s\S]*?<\/title>/s, `<title>${title}</title>`, 'title'],
        [/<meta name="description" content="[^"]*"/, `<meta name="description" content="${desc}"`, 'description'],
        [/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${title}"`, 'og:title'],
        [/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${desc}"`, 'og:description'],
        [/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`, 'og:url'],
        [/<link rel="canonical" [^>]*href="[^"]*"/, `<link rel="canonical" id="canonical-link" href="${url}"`, 'canonical'],
        [/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${title}"`, 'twitter:title'],
        [/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${desc}"`, 'twitter:description'],
      ]) {
        swap(re, contenido, tag);
      }
      // 3) Article JSON-LD SOLO para rutas de contenido editorial (ROUTE_META.articulo):
      // mismo mecanismo del breadcrumb (script antes de </body>). Los datos salen de la
      // fuente única — el prerender no vuelve a declarar autor ni fecha.
      if (meta.articulo) {
        const articulo = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: meta.title,
          description: meta.articulo.descripcion || meta.description,
          author: { '@type': 'Person', name: meta.articulo.autor },
          datePublished: meta.articulo.fechaPublicacion,
          inLanguage: 'es-CO',
        });
        out = out.replace(
          '</body>',
          `<script type="application/ld+json">${articulo}</script></body>`,
        );
      }
      // 4) BreadcrumbList por ruta (inicio → sección)
      // El nombre de la sección es el title de la ruta (fuente única: ROUTE_META).
      // La HOME no lleva breadcrumb: un BreadcrumbList que apunta a sí misma
      // («Inicio → Inicio») es schema ruidoso/inválido para el crawler.
      if (meta.path !== '/' && meta.title) {
        const crumb = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL + '/' },
            { '@type': 'ListItem', position: 2, name: meta.title, item: url },
          ],
        });
        out = out.replace(
          '</body>',
          `<script type="application/ld+json">${crumb}</script></body>`,
        );
      }
      // 5) destino: '/' sobrescribe dist/index.html; resto dist/<ruta>/index.html
      const destino = meta.path === '/' ? DIST : join(DIST, meta.path);
      mkdirSync(destino, { recursive: true });
      writeFileSync(join(destino, 'index.html'), out);
      ok++;
    } catch (e) {
      fallos.push(`${meta.path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4) sitemap.xml desde ROUTE_META (path/changefreq/priority/lastmod — lastmod lo edita el
  // diseñador al cambiar contenido, JAMÁS la fecha de build: lastmod inflado pierde la señal).
  const fila = (m) =>
    `  <url>\n    <loc>${SITE_URL}${m.path}</loc>\n    <lastmod>${m.lastmod}</lastmod>\n    <changefreq>${m.changefreq}</changefreq>\n    <priority>${m.priority}</priority>\n  </url>\n`;
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ROUTE_META.map(fila).join('') +
    '</urlset>\n';
  writeFileSync(join(ROOT, 'dist', 'sitemap.xml'), sitemap, 'utf8');

  if (fallos.length) {
    console.warn(`[prerender] ${fallos.length}/${ROUTE_META.length} rutas fallaron (dist intacto para el resto):`);
    for (const f of fallos) console.warn('  -', f);
  } else {
    console.log(`[prerender] ${ok}/${ROUTE_META.length} rutas prerenderizadas ✓`);
  }
  return { fallos, total: ROUTE_META.length };
}

main()
  .then(({ fallos, total }) => {
    // Exit code honesto (A-1): prerender roto = build rojo (visible en Vercel),
    // sin corromper el dist preexistente.
    if (fallos.length) {
      console.error(`[prerender] FALLÓ en ${fallos.length}/${total} rutas — build rojo`);
      process.exitCode = 1;
    }
  })
  .catch((e) => {
    console.error('[prerender] FALLÓ (dist sigue siendo válido):', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => {
    // El bundle SSR registra timers (herencias de módulos de cliente): forzar salida.
    process.exit(process.exitCode || 0);
  });
