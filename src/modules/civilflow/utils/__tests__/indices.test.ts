import { describe, expect, it } from 'vitest';
import { indicePorId, indicePorClave, conjuntoDe } from '../indices';

/**
 * Los índices quitan las búsquedas lineales dentro de bucles (guard G8). Estos tests fijan
 * la SEMÁNTICA que debe conservarse: el primero gana, como hacía el `.find` original.
 */

interface Pieza {
  id: string;
  piso: number;
  valor?: number;
}

describe('indicePorId', () => {
  it('devuelve la pieza por su id', () => {
    const idx = indicePorId<Pieza>(
      [
        { id: 'A', piso: 1 },
        { id: 'B', piso: 1 },
      ],
      (p) => p.id,
    );
    expect(idx.get('A')?.id).toBe('A');
    expect(idx.get('B')?.id).toBe('B');
  });

  it('el PRIMERO gana si hay ids repetidos (como un .find)', () => {
    const idx = indicePorId<Pieza>(
      [
        { id: 'A', piso: 1, valor: 1 },
        { id: 'A', piso: 2, valor: 2 },
      ],
      (p) => p.id,
    );
    expect(idx.get('A')?.valor).toBe(1);
  });

  it('una pieza sin id no entra al índice', () => {
    const idx = indicePorId<Pieza>([{ id: '', piso: 1 }], (p) => p.id || null);
    expect(idx.size).toBe(0);
  });

  it('un id undefined no se indexa', () => {
    const idx = indicePorId<{ id?: string }>([{ id: undefined }, { id: 'A' }], (p) => p.id);
    expect(idx.size).toBe(1);
    expect(idx.get('A')).toBeDefined();
  });
});

describe('indicePorClave', () => {
  it('indexa por clave compuesta (piso:id)', () => {
    const idx = indicePorClave<Pieza>(
      [
        { id: 'A', piso: 1 },
        { id: 'A', piso: 2 },
      ],
      (p) => `${p.piso}:${p.id}`,
    );
    expect(idx.get('1:A')?.piso).toBe(1);
    expect(idx.get('2:A')?.piso).toBe(2);
  });
});

describe('conjuntoDe', () => {
  it('responde si un valor está (reemplaza a .includes)', () => {
    const c = conjuntoDe(['a', 'b']);
    expect(c.has('a')).toBe(true);
    expect(c.has('z')).toBe(false);
  });
});
