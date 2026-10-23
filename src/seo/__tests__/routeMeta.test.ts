import { describe, expect, it } from 'vitest';
import { ROUTE_META, metaDeRuta } from '../routeMeta.ts';

/**
 * Las metas de las rutas públicas salen de UNA sola tabla (routeMeta.ts): el prerender la
 * consume para el HTML y las páginas la consumen en el cliente. Si divergen, el crawler ve
 * una cosa y el navegador otra.
 */

describe('ROUTE_META', () => {
  it('cada ruta tiene título, descripción, changefreq y prioridad', () => {
    for (const m of ROUTE_META) {
      expect(m.path.startsWith('/'), `${m.path} debe empezar con /`).toBe(true);
      expect(m.title.length, `${m.path} sin título`).toBeGreaterThan(0);
      expect(m.description.length, `${m.path} sin descripción`).toBeGreaterThan(50);
      expect(['monthly', 'weekly', 'yearly']).toContain(m.changefreq);
      expect(m.priority).toMatch(/^(0\.\d|1\.0)$/);
    }
  });

  it('no hay rutas repetidas', () => {
    const paths = ROUTE_META.map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('las rutas privadas (login, registro, visor) NO se prerenderizan', () => {
    const paths = ROUTE_META.map((m) => m.path);
    for (const privada of ['/login', '/register', '/restablecer', '/visor', '/perfil']) {
      expect(paths).not.toContain(privada);
    }
  });
});

describe('metaDeRuta', () => {
  it('devuelve título y descripción de la ruta', () => {
    const meta = metaDeRuta('/pricing');
    expect(meta?.title).toBeTruthy();
    expect(meta?.description.length).toBeGreaterThan(50);
  });

  it('acepta la ruta con barra final', () => {
    expect(metaDeRuta('/pricing/')?.title).toBe(metaDeRuta('/pricing')?.title);
  });

  it('la raíz es "/"', () => {
    expect(metaDeRuta('/')?.title).toBeTruthy();
  });

  it('una ruta desconocida devuelve null (la página define sus propias metas)', () => {
    expect(metaDeRuta('/ruta-que-no-existe')).toBe(null);
  });
});
