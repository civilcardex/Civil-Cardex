import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeCanalBajanteRamalKeys,
  buildLlBajanteAssociations,
  maxRamalPulgDeBajante,
  minBajantePulgDeRamal,
} from '../rainwaterRows';
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

describe('buildLlBajanteAssociations — cajas CALL fuera', () => {
  it('caja nunca aparece como bajante asociado; el bajante real sí', () => {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        scaleM: 0.5,
        bajantes: [
          { id: 'BALL1', net: 'll', tipo: 'bajante', x: 50, y: 400 },
          { id: 'CALL1', net: 'll', tipo: 'caja_ll', x: 500, y: 400 },
        ],
        ramales: [
          // Descarga en la caja CALL1: no debe atribuirse a nadie.
          {
            id: 'R1',
            net: 'll',
            pts: [
              [600, 300],
              [501, 399],
            ],
          },
          // Descarga en BALL1: chip BALL1.
          {
            id: 'R2',
            net: 'll',
            pts: [
              [100, 300],
              [51, 399],
            ],
          },
        ],
      }),
    );
    const tramos = [
      { _key: 'BALL1-1', id: 'BALL1', code: 'BALL1', esBajante: true, planId: '1' },
      { _key: 'CALL1-1', id: 'CALL1', code: 'CALL1', esBajante: true, planId: '1' },
    ] as never[];
    const assoc = buildLlBajanteAssociations(tramos, PLANS);
    expect(assoc['R1-1']).toBeUndefined();
    expect(assoc['R2-1']).toEqual(['BALL1']);
  });

  it('ramal que SALE del canal hacia bajante también excluido', () => {
    localStorage.setItem(
      'civilflow_' + TRAZOS_PREFIX + '1',
      JSON.stringify({
        scaleM: 0.5,
        bajantes: [
          { id: 'BALL1', net: 'll', tipo: 'bajante', x: 50, y: 400 },
          { id: 'CNL1-P1', net: 'll', tipo: 'canal', x: 100, y: 100, base: 40, longitud: 300 },
        ],
        ramales: [
          // Primer punto DENTRO del rect del canal, último en BALL1: canal→bajante.
          {
            id: 'R5',
            net: 'll',
            pts: [
              [150, 120],
              [51, 399],
            ],
          },
          // Colector lejano: se queda.
          {
            id: 'R6',
            net: 'll',
            pts: [
              [2000, 2000],
              [2050, 2050],
            ],
          },
        ],
      }),
    );
    const keys = computeCanalBajanteRamalKeys(PLANS);
    expect(keys.has('R5-1')).toBe(true);
    expect(keys.has('R6-1')).toBe(false);
  });
});

describe('regla diámetro bajante >= ramales conectados', () => {
  const tramos = [
    {
      _key: 'BALL1-1',
      id: 'BALL1',
      esBajante: true,
      planId: '1',
      diamDisPulg: 4,
      recibeDeIds: ['R2', 'R3'],
    },
    { _key: 'R2-1', id: 'R2', esBajante: false, planId: '1', diamDisPulg: 3, hasta: 'BALL1' },
    { _key: 'R3-1', id: 'R3', esBajante: false, planId: '1', diamDisPulg: 4, hasta: 'BALL1' },
    { _key: 'R4-1', id: 'R4', esBajante: false, planId: '2', diamDisPulg: 8, hasta: 'BALL1' },
  ] as never[];

  it('maxRamalPulgDeBajante: máximo de los directos del mismo piso', () => {
    expect(maxRamalPulgDeBajante('BALL1', '1', tramos)).toBe(4);
  });

  it('minBajantePulgDeRamal: pulg del bajante destino', () => {
    expect(minBajantePulgDeRamal('R2', '1', tramos)).toBe(4);
    expect(minBajantePulgDeRamal('R4', '2', tramos)).toBe(0);
  });
});
