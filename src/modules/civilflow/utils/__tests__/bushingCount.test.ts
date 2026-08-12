import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
});

import { computeBushingCounts, computeAccesoriosTable } from '../sanAccesoriosRows';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

// Bug 2: el conteo de bushings debe ser REAL (una conexión menor→mayor = un bushing), no un
// 1 fijo por combinación de diámetros. Un menor puede conectar a un ramal mayor (cuerpo o
// vértice) o a un bajante/montante de mayor diámetro. Misma tol 0.5 del resto de detección de
// uniones del módulo.

describe('computeBushingCounts', () => {
  it('extremo de ramal menor sobre el CUERPO de un ramal mayor cuenta 1 bushing', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '4',
        pts: [
          [0, 50],
          [20, 50],
        ],
      },
    ];
    const majors = [
      {
        id: 'R1',
        diametro: '6',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
    ];
    expect(computeBushingCounts(minors, majors, [])).toEqual({ '6_4': 1 });
  });

  it('dos ramales menores del mismo diámetro sobre el mismo mayor cuentan 2 bushings', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '4',
        pts: [
          [0, 25],
          [20, 25],
        ],
      },
      {
        id: 'T2',
        diametro: '4',
        pts: [
          [0, 75],
          [-20, 75],
        ],
      },
    ];
    const majors = [
      {
        id: 'R1',
        diametro: '6',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
    ];
    expect(computeBushingCounts(minors, majors, [])).toEqual({ '6_4': 2 });
  });

  it('conexión a VÉRTICE (extremo) de un ramal mayor también cuenta', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '3',
        pts: [
          [0, 100],
          [20, 100],
        ],
      },
    ];
    const majors = [
      {
        id: 'R1',
        diametro: '6',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
    ];
    expect(computeBushingCounts(minors, majors, [])).toEqual({ '6_3': 1 });
  });

  it('ramal en extremo lejos del mayor NO cuenta', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '4',
        pts: [
          [500, 50],
          [520, 50],
        ],
      },
    ];
    const majors = [
      {
        id: 'R1',
        diametro: '6',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
    ];
    expect(computeBushingCounts(minors, majors, [])).toEqual({});
  });

  it('conexión de IGUAL diámetro no es bushing', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '6',
        pts: [
          [0, 50],
          [20, 50],
        ],
      },
    ];
    const majors = [
      {
        id: 'R1',
        diametro: '6',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
    ];
    expect(computeBushingCounts(minors, majors, [])).toEqual({});
  });

  it('menor que toca un ramal MENOR que él no cuenta (la reducción va al revés)', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '6',
        pts: [
          [0, 50],
          [20, 50],
        ],
      },
    ];
    const majors = [
      {
        id: 'R1',
        diametro: '4',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
    ];
    expect(computeBushingCounts(minors, majors, [])).toEqual({});
  });

  it('extremo de ramal menor sobre un BAJANTE de mayor diámetro cuenta 1 bushing', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '4',
        pts: [
          [0, 80],
          [20, 80],
        ],
      },
    ];
    const bajantes = [{ id: 'M1', diametro: '6', x: 0, y: 80 }];
    expect(computeBushingCounts(minors, [], bajantes)).toEqual({ '6_4': 1 });
  });

  it('bajante tiene prioridad sobre ramal mayor en el mismo punto (1 sola cuenta)', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '4',
        pts: [
          [0, 80],
          [20, 80],
        ],
      },
    ];
    const majors = [
      {
        id: 'R1',
        diametro: '5',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
    ];
    const bajantes = [{ id: 'M1', diametro: '6', x: 0, y: 80 }];
    const counts = computeBushingCounts(minors, majors, bajantes);
    expect(counts['6_4']).toBe(1);
    expect(counts['5_4']).toBeUndefined();
  });

  it('extremo del menor en la UNIÓN de dos mayores cuenta 2 (caso RAC1+RAC3 con RAC2 4")', () => {
    const minors = [
      {
        id: 'RAC2',
        diametro: '4',
        pts: [
          [60, 50],
          [60, 10],
        ],
      },
    ];
    const majors = [
      {
        id: 'RAC1',
        diametro: '6',
        pts: [
          [0, 50],
          [60, 50],
        ],
      },
      {
        id: 'RAC3',
        diametro: '6',
        pts: [
          [60, 50],
          [140, 50],
        ],
      },
    ];
    expect(computeBushingCounts(minors, majors, [])).toEqual({ '6_4': 2 });
  });

  it('diámetro vacío o sin pts no crashea', () => {
    const minors = [
      {
        id: 'T1',
        diametro: '',
        pts: [
          [0, 80],
          [20, 80],
        ],
      },
    ];
    expect(computeBushingCounts(minors, [], [])).toEqual({});
  });
});

describe('computeAccesoriosTable — bushingCounts integrado', () => {
  const plan: PlanItem = {
    id: 10,
    name: 'Nivel 1',
    status: 'confirmed',
    nivel: 1,
    scale: 100,
    file: {} as File,
  } as PlanItem;

  function trazosFor(ramales: unknown, bajantes: unknown[] = []) {
    mockStorage['civilflow_' + TRAZOS_PREFIX + '10'] = JSON.stringify({ ramales, bajantes });
  }

  it('emite bushingCounts con el conteo real por par mayor_menor (af)', () => {
    trazosFor(
      [
        {
          id: 'RAF1',
          net: 'af',
          tipo: 'ramal',
          label: 'RAF1',
          diametro: '6',
          accesorioFin: 'teeDirecto',
          pts: [
            [0, 0],
            [0, 100],
          ],
        },
        {
          id: 'TAF2',
          net: 'af',
          tipo: 'tributario',
          label: 'TAF2',
          diametro: '4',
          pts: [
            [0, 30],
            [20, 30],
          ],
        },
        {
          id: 'TAF3',
          net: 'af',
          tipo: 'tributario',
          label: 'TAF3',
          diametro: '4',
          pts: [
            [0, 70],
            [-20, 70],
          ],
        },
      ],
      [{ id: 'M1', net: 'af', tipo: 'montante', dNominal: '6', x: 0, y: 100 }],
    );
    const table = computeAccesoriosTable('af', [] as Tramo[], [plan]);
    expect(table).not.toBeNull();
    expect(table!.bushingCounts).toEqual({ '6_4': 2 });
  });

  it('no emite bushingCounts para san (bushing es de redes de presión)', () => {
    trazosFor([
      {
        id: 'RS1',
        net: 'san',
        tipo: 'ramal',
        label: 'RS1',
        diametro: '4',
        pts: [
          [0, 0],
          [0, 100],
        ],
      },
      {
        id: 'TS2',
        net: 'san',
        tipo: 'tributario',
        label: 'TS2',
        diametro: '2',
        pts: [
          [0, 50],
          [20, 50],
        ],
      },
    ]);
    const table = computeAccesoriosTable('san', [] as Tramo[], [plan]);
    expect(table?.bushingCounts).toBeUndefined();
  });
});
