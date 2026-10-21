import { describe, it, expect } from 'vitest';
import { direccionDeEtiquetaGhost } from '../renderers/bajanteGhosts.ts';

/**
 * La etiqueta del fantasma (anillo del bajante de otro piso) se aparta del original para no quedar encima.
 * Ej: original con etiqueta a la derecha -> fantasma la pinta a la izquierda, en un vector unitario.
 */
describe('direcci\u00f3n de la etiqueta del fantasma', () => {
  it('se aleja de la etiqueta del original', () => {
    // El original tiene su etiqueta a la derecha del anillo: la del fantasma debe ir a la
    // izquierda.
    const dir = direccionDeEtiquetaGhost({ labelX: 110, labelY: 100 }, 100, 100);
    expect(dir.x).toBeLessThan(0);
    expect(Math.abs(dir.y)).toBeLessThan(0.001);
  });

  it('si el original no tiene etiqueta, va al lado (como antes)', () => {
    expect(direccionDeEtiquetaGhost(undefined, 100, 100)).toEqual({ x: 1, y: 0 });
  });

  it('si el original tiene la etiqueta en el mismo punto, va al lado', () => {
    expect(direccionDeEtiquetaGhost({ labelX: 100, labelY: 100 }, 100, 100)).toEqual({
      x: 1,
      y: 0,
    });
  });

  it('el vector es unitario', () => {
    const dir = direccionDeEtiquetaGhost({ labelX: 130, labelY: 140 }, 100, 100);
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1, 9);
  });
});
