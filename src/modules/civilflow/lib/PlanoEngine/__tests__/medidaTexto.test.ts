import { describe, it, expect } from 'vitest';
import { anchoTexto } from '../renderers/medidaTexto.ts';

/**
 * Memoria de `measureText` (el render medía el mismo texto con la misma fuente varias veces
 * por ramal en cada frame). Los tests fijan que el ancho sea el mismo que devuelve el canvas,
 * que la fuente forme parte de la clave y que el mapa no crezca sin límite.
 */

/** Contexto falso que cuenta las medidas reales y ensancha con la fuente. */
function ctxFalso() {
  const contador = { llamadas: 0 };
  const ctx = {
    font: 'bold 12px Geist, monospace',
    measureText(texto: string) {
      contador.llamadas++;
      // El ancho depende del texto y de la fuente, como en un canvas real.
      return { width: texto.length * (this.font.includes('bold') ? 7 : 5) };
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, contador };
}

describe('anchoTexto', () => {
  it('mide una sola vez el mismo texto con la misma fuente', () => {
    const { ctx, contador } = ctxFalso();
    expect(anchoTexto(ctx, 'RAF1 1/2"')).toBe(9 * 7);
    expect(anchoTexto(ctx, 'RAF1 1/2"')).toBe(9 * 7);
    expect(contador.llamadas).toBe(1);
  });

  it('la fuente es parte de la clave: otro grosor se vuelve a medir', () => {
    const { ctx, contador } = ctxFalso();
    const anchoBold = anchoTexto(ctx, 'RAC3');
    ctx.font = '600 12px Geist, monospace';
    const anchoNormal = anchoTexto(ctx, 'RAC3');
    expect(contador.llamadas).toBe(2);
    expect(anchoBold).toBeGreaterThan(anchoNormal);
  });

  it('textos distintos no comparten medida', () => {
    const { ctx } = ctxFalso();
    expect(anchoTexto(ctx, 'AA')).toBe(2 * 7);
    expect(anchoTexto(ctx, 'AAAA')).toBe(4 * 7);
  });

  it('el mapa no crece sin límite: al pasar el tope se vacía y sigue midiendo bien', () => {
    const { ctx, contador } = ctxFalso();
    for (let i = 0; i < 4001; i++) anchoTexto(ctx, `X${i}`);
    expect(contador.llamadas).toBe(4001);
    // Tras el vaciado, el primer texto se vuelve a medir (y da el mismo ancho).
    expect(anchoTexto(ctx, 'X0')).toBe(2 * 7);
    expect(contador.llamadas).toBe(4002);
  });
});
