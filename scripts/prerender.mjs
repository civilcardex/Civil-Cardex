// Prerender post-build: escribe dist/<ruta>/index.html para las rutas públicas usando el
// bundle SSR (dist-ssr/prerenderEntrada.js, generado con `vite build --ssr`).
// SIN dependencias nuevas. Fallo = warning + exit 0: el dist preexistente sigue siendo válido.
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
  const ssr = await import(pathToFileURL(join(ROOT, 'dist-ssr', 'prerenderEntrada.js')).href);
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
      // en vez de publicar 13 rutas con metas de la home.
      const swap = (re, reemplazo, tag) => {
        if (!re.test(out)) {
          const n = (out.match(/<link rel="canonical"/g) || []).length;
          throw new Error(`head: no matchea ${tag} (canonical en out: ${n}, len out: ${out.length})`);
        }
        out = out.replace(re, reemplazo);
      };
      swap(/<title>[\s\S]*?<\/title>/s, `<title>${title}</title>`, 'title');
      swap(
        /<meta name="description" content="[^"]*"/,
        `<meta name="description" content="${meta.description.replace(/"/g, '&quot;')}"`,
        'description',
      );
      swap(
        /<meta property="og:title" content="[^"]*"/,
        `<meta property="og:title" content="${title}"`,
        'og:title',
      );
      swap(
        /<meta property="og:description" content="[^"]*"/,
        `<meta property="og:description" content="${meta.description.replace(/"/g, '&quot;')}"`,
        'og:description',
      );
      swap(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`, 'og:url');
      swap(/<link rel="canonical" [^>]*href="[^"]*"/, `<link rel="canonical" id="canonical-link" href="${url}"`, 'canonical');
      swap(
        /<meta name="twitter:title" content="[^"]*"/,
        `<meta name="twitter:title" content="${title}"`,
        'twitter:title',
      );
      swap(
        /<meta name="twitter:description" content="[^"]*"/,
        `<meta name="twitter:description" content="${meta.description.replace(/"/g, '&quot;')}"`,
        'twitter:description',
      );
      // 3) BreadcrumbList por ruta (inicio → sección)
      const secciones = {
        '/pricing': 'Precios',
        '/docs': 'Documentación',
        '/civilflow': 'Civil Flow',
        '/civilstructure': 'Estructuras',
        '/civilterrain': 'Terreno',
        '/civilbim': 'BIM',
        '/civilmanager': 'Civil Manager',
        '/civilmep': 'MEP',
        '/civilroads': 'Vías',
        '/terminos': 'Términos y Condiciones',
        '/privacidad': 'Política de Privacidad',
        '/cookies': 'Política de Cookies',
      };
      if (secciones[meta.path]) {
        const crumb = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL + '/' },
            { '@type': 'ListItem', position: 2, name: secciones[meta.path], item: url },
          ],
        });
        out = out.replace(
          '</body>',
          `<script type="application/ld+json">${crumb}</script></body>`,
        );
      }
      // 4) destino: '/' sobrescribe dist/index.html; resto dist/<ruta>/index.html
      const destino = meta.path === '/' ? DIST : join(DIST, meta.path);
      mkdirSync(destino, { recursive: true });
      writeFileSync(join(destino, 'index.html'), out);
      ok++;
    } catch (e) {
      fallos.push(`${meta.path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

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
