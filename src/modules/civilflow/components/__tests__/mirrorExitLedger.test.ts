import { describe, it, expect } from 'vitest';
import { libroHeredado, aggParaEspejoSalida, stableStringify } from '../fixturesStorage';
import { flowTailEnd } from '../pdfViewer/drawingElementContextMenu/ramalMenuHelpers';

// El ramal que SALE de un bajante espeja lo que el bajante MUESTRA: con asociación
// cross-floor el panel muestra el LIBRO heredado (ucAplicado), no el árbol — antes el
// espejo usaba solo el árbol y la salida quedaba en 0 con el bajante lleno (ej: 2 UDs).

describe('libroHeredado', () => {
  it('MÁXIMO por aparato entre entradas (la herencia se cuenta UNA vez, no N×)', () => {
    // El libro guarda una entrada por clave destino (+ la del Ldesvio), todas con el MISMO
    // agregado aplicado — sumarlas mostraba 2×/3× (orig. usuario: 12 → 24).
    expect(
      libroHeredado({
        ucAplicado: {
          RS1: { inodoro: 1, lavamanos: 1 },
          RS2: { inodoro: 1, lavamanos: 2 },
          LD_X: { inodoro: 1, lavamanos: 2 },
        },
      }),
    ).toEqual({ inodoro: 1, lavamanos: 2 });
  });
  it('sin libro → vacío', () => {
    expect(libroHeredado({})).toEqual({});
    expect(libroHeredado({ ucAplicado: {} })).toEqual({});
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

describe('stableStringify (recarga guardada anti-loop)', () => {
  it('mismo contenido con distinto orden → igual', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ k: { y: 1, x: 2 } })).toBe(stableStringify({ k: { x: 2, y: 1 } }));
  });
  it('distinto contenido → distinto', () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
    expect(stableStringify({})).not.toBe(stableStringify({ a: 1 }));
  });
});

describe('flowTailEnd (codo sube en la cola de flujo)', () => {
  it('flujo termina en fin → cola en inicio (0)', () => {
    expect(flowTailEnd(false, true)).toBe(0);
  });
  it('flujo termina en inicio (reverso) → cola en fin (1)', () => {
    expect(flowTailEnd(true, false)).toBe(1);
  });
  it('ambiguo (ambos o ninguno) → -1', () => {
    expect(flowTailEnd(true, true)).toBe(-1);
    expect(flowTailEnd(false, false)).toBe(-1);
  });
});
