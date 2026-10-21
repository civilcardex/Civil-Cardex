import { describe, expect, it } from 'vitest';
import { detectarFocosEnFuente, contarFocosPorArchivo, totalFocos } from '../complexity';

/**
 * El detector de focos (G8) decide qué se vigila: si el detector se equivoca, el guard miente.
 * Estos tests fijan qué cuenta y qué NO cuenta.
 */

describe('detectarFocosEnFuente — qué es un foco', () => {
  it('una búsqueda lineal dentro de un bucle ES un foco', () => {
    const src = `
      for (const r of ramales) {
        const b = bajantes.find((x) => x.id === r.id);
      }
    `;
    expect(detectarFocosEnFuente(src)).toHaveLength(1);
  });

  it('una búsqueda lineal FUERA de un bucle no cuenta', () => {
    const src = `
      const b = bajantes.find((x) => x.id === 'B1');
    `;
    expect(detectarFocosEnFuente(src)).toHaveLength(0);
  });

  it('una búsqueda sobre un literal inline no cuenta (no escala)', () => {
    const src = `
      for (const r of ramales) {
        const ok = ['a', 'b', 'c'].includes(r.net);
      }
    `;
    expect(detectarFocosEnFuente(src)).toHaveLength(0);
  });

  it('cuenta los seis métodos de búsqueda lineal', () => {
    const metodos = ['find', 'findIndex', 'some', 'filter', 'indexOf', 'includes'];
    for (const m of metodos) {
      const src = `for (const r of xs) { const y = xs.${m}((z) => z); }`;
      expect(detectarFocosEnFuente(src)).toHaveLength(1);
    }
  });

  it('el código comentado no cuenta', () => {
    const src = `
      for (const r of ramales) {
        // const b = bajantes.find((x) => x.id === r.id);
        const b = bajantes.find((x) => x.id === r.id);
      }
    `;
    expect(detectarFocosEnFuente(src)).toHaveLength(1);
  });

  it('reporta la línea del bucle (no la de la búsqueda)', () => {
    const src = `for (const r of ramales) {\n  const b = bajantes.find((x) => x.id);\n}`;
    expect(detectarFocosEnFuente(src)[0].linea).toBe(1);
  });

  it('una búsqueda en la CABECERA del bucle no cuenta (se evalúa una vez)', () => {
    const src = `
      for (const r of ramales.filter((x) => x.net === 'san')) {
        use(r);
      }
    `;
    expect(detectarFocosEnFuente(src)).toHaveLength(0);
  });

  it('una búsqueda dentro de un forEach/map/filter CUENTA (el callback es el bucle)', () => {
    const src = `
      xs.forEach((r) => {
        const b = ys.find((x) => x.id === r.id);
      });
    `;
    expect(detectarFocosEnFuente(src)).toHaveLength(1);
  });

  it('detecta el bucle en un for...of y en un while', () => {
    const ofSrc = `for (const r of xs) { ys.find((z) => z); }`;
    const whileSrc = `while (i < n) { ys.find((z) => z); }`;
    expect(detectarFocosEnFuente(ofSrc)).toHaveLength(1);
    expect(detectarFocosEnFuente(whileSrc)).toHaveLength(1);
  });
});

describe('contarFocosPorArchivo', () => {
  it('devuelve solo los archivos con focos', () => {
    const conteo = contarFocosPorArchivo({
      'a.ts': 'for (const r of xs) { ys.find((z) => z); }',
      'b.ts': 'const y = ys.find((z) => z);',
    });
    expect(conteo).toEqual({ 'a.ts': 1 });
  });

  it('totalFocos suma el conteo', () => {
    expect(totalFocos({ 'a.ts': 3, 'b.ts': 4 })).toBe(7);
  });
});
