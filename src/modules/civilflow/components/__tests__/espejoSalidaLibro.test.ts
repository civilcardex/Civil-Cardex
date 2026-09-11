import { describe, it, expect } from 'vitest';
import { libroHeredadoSumado, aggParaEspejoSalida } from '../fixturesStorage';

// El ramal que SALE de un bajante espeja lo que el bajante MUESTRA: con asociación
// cross-floor el panel muestra el LIBRO heredado (ucAplicado), no el árbol — antes el
// espejo usaba solo el árbol y la salida quedaba en 0 con el bajante lleno (ej: 2 UDs).

describe('libroHeredadoSumado', () => {
  it('suma por aparato todas las entradas del libro', () => {
    expect(
      libroHeredadoSumado({
        ucAplicado: { RS1: { inodoro: 1 }, RS2: { inodoro: 1, lavamanos: 2 } },
      }),
    ).toEqual({ inodoro: 2, lavamanos: 2 });
  });
  it('sin libro → vacío', () => {
    expect(libroHeredadoSumado({})).toEqual({});
    expect(libroHeredadoSumado({ ucAplicado: {} })).toEqual({});
  });
});

describe('aggParaEspejoSalida', () => {
  it('bajante con libro (2 UDs heredadas) y árbol vacío → espeja el libro', () => {
    expect(aggParaEspejoSalida({}, { inodoro: 2 })).toEqual({ inodoro: 2 });
  });
  it('sin libro → espeja el agregado del árbol', () => {
    expect(aggParaEspejoSalida({ lavamanos: 1 }, {})).toEqual({ lavamanos: 1 });
  });
  it('con libro Y árbol → manda el libro (igual que el display del bajante)', () => {
    expect(aggParaEspejoSalida({ lavamanos: 1 }, { inodoro: 2 })).toEqual({ inodoro: 2 });
  });
  it('ambos vacíos → null (no escribir)', () => {
    expect(aggParaEspejoSalida({}, {})).toBeNull();
  });
  it('devuelve copia (mutar el espejo no toca las fuentes)', () => {
    const libro = { inodoro: 2 };
    const espejo = aggParaEspejoSalida({}, libro);
    expect(espejo).not.toBe(libro);
    espejo!.inodoro = 99;
    expect(libro).toEqual({ inodoro: 2 });
  });
});
