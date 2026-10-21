import { describe, it, expect } from 'vitest';
import { otrosPorToque } from './useWaterRedGrafo.ts';

// Caso RAC3-P2 (orig. usuario): mergesFrom stale nombraba al anfitrión ancestral RAC1
// (a 250px del empalme) y la columna mostraba [RAC1][RAC2]. Solo quienes tocan listan.
describe('otrosPorToque', () => {
  const ramales = [
    {
      id: 'RAC3',
      pts: [
        [150, 0],
        [0, 0],
      ],
    },
    {
      id: 'RAC2',
      pts: [
        [150, 0],
        [150, 200],
      ],
    },
    {
      id: 'RAC4',
      pts: [
        [400, 0],
        [150, 0],
      ],
    },
    {
      id: 'RAC1',
      pts: [
        [400, 0],
        [600, 0],
      ],
    },
  ];
  it('excluye al anfitrión ancestral que ya no toca el empalme', () => {
    expect(otrosPorToque(ramales, 'RAC3', 'P2').sort()).toEqual(['RAC2-P2', 'RAC4-P2']);
  });
  it('sin piezas tocando devuelve vacío (celda "—" honesta)', () => {
    expect(
      otrosPorToque(
        [
          {
            id: 'RAC1',
            pts: [
              [400, 0],
              [600, 0],
            ],
          },
        ],
        'RAC1',
        'P2',
      ),
    ).toEqual([]);
  });
  it('nunca se lista a sí misma', () => {
    const got = otrosPorToque(ramales, 'RAC2', 'P2');
    expect(got).not.toContain('RAC2-P2');
    expect(got).toContain('RAC3-P2');
  });
});
