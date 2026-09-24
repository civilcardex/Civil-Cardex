import { describe, it, expect, beforeEach } from 'vitest';
import { computeCanalBajanteRamalKeys } from '../rainwaterRows';
import type { PlanItem } from '../../context/PlansContext';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';

// Ramales DE los canales fuera de diseño: marcados esCanalId O que descargan en el
// canal (último punto dentro del rectángulo). Colectores reales se quedan.

const PLANS = [{ id: '1', nivel: 0, status: 'confirmed' }] as unknown as PlanItem[];

function seed(ramales: Array<Record<string, unknown>>): void {
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      scaleM: 0.5,
      bajantes: [
        { id: 'CNL1-P1', net: 'll', tipo: 'canal', x: 100, y: 100, base: 40, longitud: 300 },
      ],
      ramales,
    }),
  );
}

beforeEach(() => localStorage.clear());

describe('computeCanalBajanteRamalKeys (llegadas al canal)', () => {
  it('excluye esCanalId y llegadas; colector lejano se queda', () => {
    seed([
      // Llega: último punto dentro del rect (100..~667, 100..~760+pad).
      {
        id: 'R1',
        net: 'll',
        pts: [
          [200, 300],
          [140, 108],
        ],
      },
      // esCanalId: ramal DEL canal — fuera.
      {
        id: 'R2',
        net: 'll',
        pts: [
          [140, 108],
          [3000, 3000],
        ],
        esCanalId: 'CNL1-P1',
      },
      // Colector lejano.
      {
        id: 'R3',
        net: 'll',
        pts: [
          [2000, 2000],
          [2050, 2050],
        ],
      },
      // Otra red: nunca.
      {
        id: 'R4',
        net: 'san',
        pts: [
          [140, 108],
          [300, 300],
        ],
      },
    ]);
    const keys = computeCanalBajanteRamalKeys(PLANS);
    expect(keys.has('R1-1')).toBe(true);
    expect(keys.has('R2-1')).toBe(true);
    expect(keys.has('R3-1')).toBe(false);
    expect(keys.has('R4-1')).toBe(false);
  });

  it('sin canal en el piso no marca nada', () => {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        scaleM: 0.5,
        bajantes: [{ id: 'BALL1', net: 'll', tipo: 'bajante', x: 50, y: 400 }],
        ramales: [
          {
            id: 'R1',
            net: 'll',
            pts: [
              [100, 100],
              [140, 108],
            ],
          },
        ],
      }),
    );
    expect(computeCanalBajanteRamalKeys(PLANS).size).toBe(0);
  });
});
