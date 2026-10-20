import { describe, it, expect } from 'vitest';
import { tamanoLienzoDibujo } from '../planoCamera';

// El lienzo de DIBUJO debe cubrir el área visible, no solo la caja de la hoja: con zoom > 1
// el fondo se sale de la hoja (lo recorta el contenedor) y un lienzo medido como la hoja
// cortaba el TRAZO en su borde — el "recuadro" que limitaba la vista de PF (orig. usuario:
// los trazos de los laterales y de arriba quedaban recortados).
describe('tamanoLienzoDibujo', () => {
  it('sin hoja conocida: el lienzo cubre el área visible', () => {
    const t = tamanoLienzoDibujo({ visW: 1200, visH: 800, pageW: 0, pageH: 0, zoom: 1 });
    expect(t).toEqual({ w: 1200, h: 800 });
  });

  it('con zoom 1: la hoja manda si es mayor que el área visible', () => {
    const t = tamanoLienzoDibujo({ visW: 800, visH: 600, pageW: 1600, pageH: 1100, zoom: 1 });
    expect(t).toEqual({ w: 1600, h: 1100 });
  });

  it('con zoom 2: el lienzo cubre la hoja ampliada (el trazo no se corta en el borde de la hoja)', () => {
    const t = tamanoLienzoDibujo({ visW: 800, visH: 600, pageW: 1600, pageH: 1100, zoom: 2 });
    expect(t).toEqual({ w: 3200, h: 2200 });
  });

  it('con zoom < 1 manda el área visible', () => {
    const t = tamanoLienzoDibujo({ visW: 1200, visH: 900, pageW: 1600, pageH: 1100, zoom: 0.5 });
    expect(t).toEqual({ w: 1200, h: 900 });
  });
});
