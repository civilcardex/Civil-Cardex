import { describe, it, expect } from 'vitest';
import { computeComponentTotals, computeDirectedTotals } from '../../lib/shared/connectionGraph';

const mkTramos = (items: [string, number][]) => items.map(([k, p]) => ({ _key: k, partial: p }));

describe('computeComponentTotals', () => {
  it('suma parciales dentro del mismo componente conectado', () => {
    const tramos = mkTramos([
      ['A', 10],
      ['B', 20],
      ['C', 5],
    ]);
    const adj: Record<string, string[]> = {
      A: ['B'],
      B: ['A', 'C'],
      C: ['B'],
    };
    const result = computeComponentTotals(
      tramos,
      (t) => t._key,
      adj,
      (t) => t.partial,
    );
    expect(result['A']).toBe(35);
    expect(result['B']).toBe(35);
    expect(result['C']).toBe(35);
  });

  it('cada componente aislado suma solo sus propios valores', () => {
    const tramos = mkTramos([
      ['X', 5],
      ['Y', 10],
    ]);
    const adj: Record<string, string[]> = {};
    const result = computeComponentTotals(
      tramos,
      (t) => t._key,
      adj,
      (t) => t.partial,
    );
    expect(result['X']).toBe(5);
    expect(result['Y']).toBe(10);
  });

  it('ignora tramos sin key', () => {
    const tramos = mkTramos([
      ['A', 7],
      ['B', 3],
    ]);
    const result = computeComponentTotals(
      tramos,
      () => undefined,
      {},
      (t) => t.partial,
    );
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('computeDirectedTotals', () => {
  it('acumula en raiz los parciales de sus hijos (topologia arbol)', () => {
    const tramos = mkTramos([
      ['cont', 0],
      ['A', 10],
      ['B', 20],
      ['C', 5],
    ]);
    const adj: Record<string, string[]> = {
      cont: ['A'],
      A: ['cont', 'B'],
      B: ['A', 'C'],
      C: ['B'],
    };
    const result = computeDirectedTotals(
      tramos,
      (t) => t._key,
      adj,
      (t) => t.partial,
      'cont',
    );
    expect(result['cont']).toBe(35);
    expect(result['A']).toBe(35);
    expect(result['B']).toBe(25);
    expect(result['C']).toBe(5);
  });

  it('cae de vuelta en undirected si root no existe', () => {
    const tramos = mkTramos([
      ['X', 10],
      ['Y', 20],
    ]);
    const adj = { X: ['Y'], Y: ['X'] };
    const result = computeDirectedTotals(
      tramos,
      (t) => t._key,
      adj,
      (t) => t.partial,
      'no_existe',
    );
    expect(result['X']).toBe(30);
    expect(result['Y']).toBe(30);
  });

  it('nodos hoja mantienen su propio parcial', () => {
    const tramos = mkTramos([
      ['root', 0],
      ['leaf', 15],
    ]);
    const adj = { root: ['leaf'], leaf: ['root'] };
    const result = computeDirectedTotals(
      tramos,
      (t) => t._key,
      adj,
      (t) => t.partial,
      'root',
    );
    expect(result['leaf']).toBe(15);
  });
});
