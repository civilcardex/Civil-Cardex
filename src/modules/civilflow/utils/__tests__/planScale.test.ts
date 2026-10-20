import { describe, it, expect } from 'vitest';
import {
  escalaDeDoc,
  filaRender,
  guardarPaginaDeDoc,
  paginaDeDoc,
  type RenderReq,
} from '../planScale';

// F1: el fondo del PDF se rasteriza con la ESCALA DEL DOC — si se usa otro factor, la
// lámina y el dibujo quedan en escalas distintas (34% corrido con doc a 0.669).
// F2: un re-raster pedido durante un render en vuelo se ENCOLA, no se descarta.

describe('escalaDeDoc', () => {
  it('devuelve la scaleM del doc guardado', () => {
    localStorage.setItem('civilflow_trazos_9', JSON.stringify({ scaleM: 0.669 }));
    expect(escalaDeDoc('9')).toBe(0.669);
  });

  it('null sin doc, con id vacío, o con scaleM inválido', () => {
    expect(escalaDeDoc('404')).toBeNull();
    expect(escalaDeDoc(null)).toBeNull();
    expect(escalaDeDoc('')).toBeNull();
    localStorage.setItem('civilflow_trazos_8', JSON.stringify({ scaleM: 0 }));
    expect(escalaDeDoc('8')).toBeNull();
  });
});

describe('filaRender (F2: el re-raster en vuelo se encola, no se tira)', () => {
  const req: RenderReq = { pageNum: 1, sc: 0.669 };

  it('sin render en vuelo: arranca ya (y deja la cola como estaba)', () => {
    const r = filaRender(false, null, req);
    expect(r.arranca).toBe(true);
    expect(r.pendiente).toBeNull();
  });

  it('en vuelo: se encola y corre después (la última petición gana)', () => {
    const vieja: RenderReq = { pageNum: 1, sc: 0.5 };
    const r = filaRender(true, vieja, req);
    expect(r.arranca).toBe(false);
    expect(r.pendiente).toEqual(req);
  });
});

// El tamaño de la lámina se guarda para dimensionar el lienzo ANTES de que llegue el PDF:
// sin él, el dibujo se pinta en un lienzo de 300×150 y al llegar la lámina el contenedor se
// re-centra — el "salto" del visor (orig. usuario).
describe('tamaño de la lámina por plano', () => {
  it('guarda y devuelve el tamaño', () => {
    guardarPaginaDeDoc('7', 1600, 1100);
    expect(paginaDeDoc('7')).toEqual({ w: 1600, h: 1100 });
  });

  it('null si el plano no se ha rasterizado todavía o el tamaño es inválido', () => {
    expect(paginaDeDoc('404')).toBeNull();
    expect(paginaDeDoc(null)).toBeNull();
    guardarPaginaDeDoc('6', 0, 100);
    expect(paginaDeDoc('6')).toBeNull();
  });
});
