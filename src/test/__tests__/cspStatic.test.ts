import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard estático de la CSP de estilos: la política de producción debe ser `style-src 'self'`
 * (sin 'unsafe-inline') y el HTML de entrada no puede traer bloques <style> ni style="...".
 * Ej: si alguien vuelve a pegar el CSS crítico inline en index.html, este test lo caza antes
 * del build (el check de dist/ corre después de compilar).
 */

const ROOT = process.cwd();
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const VERCEL = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

/** Contenido de la CSP del <meta http-equiv> de index.html. */
function cspMeta(): string {
  const m = HTML.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  expect(m, 'index.html debe declarar la CSP en un <meta http-equiv>').toBeTruthy();
  return m![1];
}

/** CSP del header HTTP de vercel.json (la que manda en producción). */
function cspHeader(): string {
  const global = VERCEL.headers.find((h) => h.source === '/(.*)');
  const csp = global?.headers.find((h) => h.key === 'Content-Security-Policy');
  expect(csp, 'vercel.json debe declarar Content-Security-Policy').toBeTruthy();
  return csp!.value;
}

/** Directiva style-src de una política CSP. */
function styleSrc(csp: string): string {
  const directiva = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('style-src'));
  expect(directiva, 'la CSP debe declarar style-src').toBeTruthy();
  return directiva!;
}

describe('CSP estricta de estilos', () => {
  it("index.html y vercel.json usan style-src 'self' sin 'unsafe-inline'", () => {
    for (const csp of [cspMeta(), cspHeader()]) {
      expect(styleSrc(csp)).toBe("style-src 'self'");
    }
  });

  it('index.html no trae bloques <style> ni atributos style inline', () => {
    // Los comentarios de rationale pueden nombrar las etiquetas; se ignoran.
    const sinComentarios = HTML.replace(/<!--[\s\S]*?-->/g, '');
    expect(sinComentarios).not.toMatch(/<style\b/i);
    expect(sinComentarios).not.toMatch(/\sstyle\s*=\s*["']/i);
  });

  it('el CSS crítico se sirve como archivo propio', () => {
    expect(HTML).toContain('href="/styles/critical.css"');
    const critical = readFileSync(join(ROOT, 'public', 'styles', 'critical.css'), 'utf8');
    expect(critical).toContain('#root');
  });
});
