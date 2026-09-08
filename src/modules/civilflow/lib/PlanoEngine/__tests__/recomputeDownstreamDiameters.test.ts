import { describe, it, expect } from 'vitest';
import { recomputeDownstreamDiameters } from '../drawingUtils';

// Ítems 5+6: el ramal receptor toma el MAYOR diámetro de los ramales que llegan a él, y cada
// cambio (suba o baje) re-dispara el cálculo aguas abajo desde la topología actual.
type N = {
  id: string;
  net: string;
  pts?: number[][];
  diametro?: string;
  mergesFrom?: string[];
  _tribReversed?: boolean;
};

const R = (o: Partial<N> & { id: string }): N => ({
  net: 'san',
  pts: [
    [0, 0],
    [40, 0],
  ],
  diametro: '',
  ...o,
});

describe('recomputeDownstreamDiameters — receptor = max(alimentadores)', () => {
  it('A2" + B3" + C4" llegan a D → D = 4"', () => {
    const ramales: N[] = [
      R({
        id: 'A',
        diametro: '2"',
        pts: [
          [20, -40],
          [20, 0],
        ],
      }),
      R({
        id: 'B',
        diametro: '3"',
        pts: [
          [60, -40],
          [60, 0],
        ],
      }),
      R({
        id: 'C',
        diametro: '4"',
        pts: [
          [100, -40],
          [100, 0],
        ],
      }),
      R({
        id: 'D',
        pts: [
          [0, 0],
          [120, 0],
        ],
      }),
    ];
    recomputeDownstreamDiameters(ramales, 'C');
    expect(ramales.find((r) => r.id === 'D')?.diametro).toBe('4"');
  });

  it('al bajar C de 4" a 3", D recalcula a 3" (sin caché del valor anterior)', () => {
    const ramales: N[] = [
      R({
        id: 'A',
        diametro: '2"',
        pts: [
          [20, -40],
          [20, 0],
        ],
      }),
      R({
        id: 'B',
        diametro: '3"',
        pts: [
          [60, -40],
          [60, 0],
        ],
      }),
      R({
        id: 'C',
        diametro: '3"',
        pts: [
          [100, -40],
          [100, 0],
        ],
      }),
      R({
        id: 'D',
        diametro: '4"',
        pts: [
          [0, 0],
          [120, 0],
        ],
      }),
    ];
    recomputeDownstreamDiameters(ramales, 'C');
    expect(ramales.find((r) => r.id === 'D')?.diametro).toBe('3"');
  });

  it('propaga en cadena aguas abajo (D receptor alimenta a E)', () => {
    const ramales: N[] = [
      R({
        id: 'A',
        diametro: '4"',
        pts: [
          [20, -40],
          [20, 0],
        ],
      }),
      R({
        id: 'D',
        pts: [
          [0, 0],
          [120, 0],
        ],
      }),
      R({
        id: 'E',
        diametro: '2"',
        pts: [
          [120, 0],
          [170, 0],
        ],
      }),
    ];
    recomputeDownstreamDiameters(ramales, 'A');
    expect(ramales.find((r) => r.id === 'D')?.diametro).toBe('4"');
    expect(ramales.find((r) => r.id === 'E')?.diametro).toBe('4"');
  });

  it('hijo mergesFrom sigue al mayor de sus padres, también al bajar', () => {
    const ramales: N[] = [
      R({ id: 'RS1', diametro: '2"' }),
      R({ id: 'T1', diametro: '4"' }),
      R({ id: 'RS2', diametro: '2"', mergesFrom: ['RS1', 'T1'] }),
    ];
    recomputeDownstreamDiameters(ramales, 'T1');
    expect(ramales.find((r) => r.id === 'RS2')?.diametro).toBe('4"');
    ramales.find((r) => r.id === 'T1')!.diametro = '2"';
    recomputeDownstreamDiameters(ramales, 'T1');
    expect(ramales.find((r) => r.id === 'RS2')?.diametro).toBe('2"');
  });

  it('el tramo aguas arriba NO sube: el tributario descarga en su extremo final', () => {
    // RS1 termina en la junta [40,0]; T1 (4") descarga ahí y sigue por RS2. RS1 no recibe
    // ese caudal (no continúa aguas abajo del punto) y conserva su 2".
    const ramales: N[] = [
      R({
        id: 'RS1',
        diametro: '2"',
        pts: [
          [0, 0],
          [40, 0],
        ],
      }),
      R({
        id: 'T1',
        diametro: '4"',
        pts: [
          [40, 40],
          [40, 0],
        ],
      }),
      R({
        id: 'RS2',
        diametro: '',
        pts: [
          [40, 0],
          [80, 0],
        ],
      }),
    ];
    recomputeDownstreamDiameters(ramales, 'T1');
    expect(ramales.find((r) => r.id === 'RS1')?.diametro).toBe('2"');
    expect(ramales.find((r) => r.id === 'RS2')?.diametro).toBe('4"');
  });

  it('no toca ramales de otra red ni hermanos del mismo split', () => {
    const ramales: N[] = [
      R({
        id: 'A',
        net: 'af',
        diametro: '4"',
        pts: [
          [20, -40],
          [20, 0],
        ],
      }),
      R({
        id: 'D',
        net: 'san',
        diametro: '2"',
        pts: [
          [0, 0],
          [120, 0],
        ],
      }),
    ];
    recomputeDownstreamDiameters(ramales, 'A');
    expect(ramales.find((r) => r.id === 'D')?.diametro).toBe('2"');
  });
});
