import { describe, it, expect, beforeEach } from 'vitest';
import { computeCanalBajanteRamalKeys } from '../rainwaterRows';
import type { PlanItem } from '../../context/PlansContext';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';

// Los ramales que pertenecen al canal recolectora (esCanalId, o extremo dentro del rectángulo
// del canal) NO son colectores de diseño: fuera de Diseño de red aguas lluvias.

const PLANS = [{ id: '1', nivel: 0, status: 'confirmed' }] as unknown as PlanItem[];

function seed(ramales: Array<Record<string, unknown>>, canal: Record<string, unknown>): void {
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      scaleM: 0.5,
      bajantes: [
        {
          id: 'CNL1-P1',
          net: 'll',
          tipo: 'canal',
          x: 100,
          y: 100,
          base: 40,
          longitud: 300,
          ...canal,
        },
        { id: 'BALL1', net: 'll', tipo: 'bajante', x: 50, y: 400 },
      ],
      ramales,
    }),
  );
}

beforeEach(() => localStorage.clear());

describe('computeCanalBajanteRamalKeys', () => {
  it('marca ramales con esCanalId y los que caen dentro del rectángulo del canal', () => {
    seed(
      [
        // Con esCanalId: fuera sin importar geometría.
        {
          id: 'R1',
          net: 'll',
          pts: [
            [500, 500],
            [600, 600],
          ],
          esCanalId: 'CNL1-P1',
        },
        // Extremo dentro del rect (100..100+300*0.5*96/2.54≈100+56.7, 100..100+7.56 + pad 4).
        {
          id: 'R2',
          net: 'll',
          pts: [
            [140, 108],
            [200, 300],
          ],
        },
        // Colector real: lejos del canal — se queda.
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
            [120, 105],
            [300, 300],
          ],
          esCanalId: 'CNL1-P1',
        },
      ],
      {},
    );
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
              [120, 120],
            ],
            esCanalId: 'X',
          },
        ],
      }),
    );
    expect(computeCanalBajanteRamalKeys(PLANS).size).toBe(0);
  });
});
