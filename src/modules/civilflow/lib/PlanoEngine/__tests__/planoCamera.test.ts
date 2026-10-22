import { describe, it, expect } from 'vitest';
import { tamanoLienzoDibujo } from '../planoCamera.ts';

// El lienzo de DIBUJO mide SOLO el área visible (2026-10-22). Antes cubría `max(viewport,
// hoja×zoom)`: a zoom 3 con dpr 2 eran ~50 MP que se limpiaban y repintaban en cada frame del
// paneo (el "trabado"). El contenedor recorta en el mismo sitio, así que el resultado visual
// no cambia: solo deja de rasterizar fuera de la vista.
describe('tamanoLienzoDibujo', () => {
  it('mide el área visible', () => {
    expect(tamanoLienzoDibujo({ visW: 1200, visH: 800 })).toEqual({ w: 1200, h: 800 });
  });

  it('no crece con la hoja ni con el zoom (el contenedor ya recorta)', () => {
    const a = tamanoLienzoDibujo({ visW: 800, visH: 600 });
    const b = tamanoLienzoDibujo({ visW: 800, visH: 600 });
    expect(a).toEqual(b);
    expect(a).toEqual({ w: 800, h: 600 });
  });

  it('con área sin medir (contenedor oculto) devuelve 0: el motor no pinta', () => {
    expect(tamanoLienzoDibujo({ visW: 0, visH: 0 })).toEqual({ w: 0, h: 0 });
  });
});
