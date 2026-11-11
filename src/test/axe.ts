/**
 * expectAxe(container): corre axe-core sobre el subárbol montado y FALLA el test listando
 * las violaciones con su `.help`. Alcanza para los componentes (mount con renderEnJsdom) —
 * sin vitest-axe (sin mantenimiento, axe-core directo es la vía viva).
 *
 * Nivel de exigencia: wcag2a + wcag2aa + best-practice. Las reglas excluidas son las que
 * jsdom NO puede juzgar:
 *  - color-contrast: jsdom no computa estilos (siempre falso positivo) — el contraste REAL
 *    se vigila offline en contrastTokens.test.ts (tokens de :root, ratio WCAG).
 *  - region / landmark-*: estructura de página fuera del alcance de estos tests.
 *  - aria-required-attr: falso positivo de axe sobre <canvas> sin role (landing/workarea).
 * Ej: `const { container } = await renderEnJsdom(<ConfirmModal .../>); await expectAxe(container);`
 */
import axe from 'axe-core';
import { expect } from 'vitest';

const EXCLUIDAS = new Set(['color-contrast', 'region', 'aria-required-attr']);

// Las llamadas a axe.run se SERIALIZAN con una cola de promesas a nivel de módulo:
// axe-core lanza "Axe is already running" si dos runs viven a la vez (flake en suite
// completa), así que cada expectAxe se encadena sobre el resultado del anterior.
let cola: Promise<unknown> = Promise.resolve();
const conCola = <T>(fn: () => Promise<T>): Promise<T> => (cola = cola.then(fn, fn)) as Promise<T>;

export async function expectAxe(container: HTMLElement): Promise<void> {
  const results = await conCola(() =>
    axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
    }),
  );
  const violaciones = results.violations.filter(
    (v) => !EXCLUIDAS.has(v.id) && !v.id.startsWith('landmark'),
  );
  const detalle = violaciones
    .map((v) => {
      const nodos = v.nodes
        .map((n) => `      - ${n.target.join(' ') || '(sin target)'}`)
        .join('\n');
      return `  [${v.id}] ${v.help}\n${nodos}`;
    })
    .join('\n');
  expect(violaciones, `Violaciones axe (${violaciones.length}):\n${detalle}`).toEqual([]);
}
