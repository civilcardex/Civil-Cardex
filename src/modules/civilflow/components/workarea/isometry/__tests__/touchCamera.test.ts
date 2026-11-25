import { describe, expect, it } from 'vitest';
import { marcoPunteros, zoomAnclado } from '../useIsometryInteraction.ts';

describe('gestos de la isometría', () => {
  it('al levantar un dedo el nuevo origen es el dedo restante', () => {
    const puntos = new Map([
      [1, { x: 20, y: 30 }],
      [2, { x: 60, y: 30 }],
    ]);
    expect(marcoPunteros(puntos.values())).toEqual({ centro: { x: 40, y: 30 }, distancia: 40 });
    puntos.delete(1);
    expect(marcoPunteros(puntos.values())).toEqual({ centro: { x: 60, y: 30 }, distancia: 0 });
    puntos.clear();
    expect(marcoPunteros(puntos.values())).toBeNull();
  });

  it('pellizca alrededor del punto entre los dedos, no del centro del lienzo', () => {
    const camara = { zoom: 1, offX: 10, offY: -5 };
    expect(zoomAnclado(camara, 2, { x: 80, y: 20 }, { x: 10, y: 5 })).toEqual({
      zoom: 2,
      offX: -50,
      offY: -25,
    });
  });

  it('dos dedos juntos aún desplazan cuando se alcanza el zoom máximo', () => {
    // El techo es 2 (200 %), el mismo que el deslizador de IsometriaToolbar.
    expect(
      zoomAnclado({ zoom: 2, offX: 10, offY: 5 }, 2, { x: 40, y: 20 }, { x: 4, y: -3 }),
    ).toEqual({ zoom: 2, offX: 14, offY: 2 });
  });
});
