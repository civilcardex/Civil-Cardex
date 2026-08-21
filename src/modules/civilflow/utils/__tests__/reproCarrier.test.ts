import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildSanConnectivity, type MergedApBase } from '../sanitaryRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';

const mk = (
  id: string,
  _pts: number[][],
  fixtures: Record<string, number>,
  extra: Partial<Tramo> = {},
): Tramo =>
  ({
    _key: `${id}-1`,
    id,
    tipo: 'ramal',
    piso: 1,
    planId: '1',
    esBajante: false,
    fixtures,
    recibeDe: [],
    descripcion: '',
    ini: '',
    fin: '',
    diamDisPulg: 2,
    nSalidas: 1,
    totalL: 10,
    ...extra,
  }) as Tramo;

describe('repro ramal autosumado que lleva flujo a otro', () => {
  const mockLocalStorage: Record<string, string> = {};
  beforeEach(() => {
    globalThis.localStorage = {
      getItem: (k: string) => mockLocalStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockLocalStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockLocalStorage[k];
      },
      clear: () => {
        for (const k in mockLocalStorage) delete mockLocalStorage[k];
      },
      length: 0,
      key: () => null,
    } as unknown as Storage;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  const plans: PlanItem[] = [
    { id: 1, file: new File([], 'p.pdf'), name: 'P1', nivel: 1, scale: 100, status: 'confirmed' },
  ];
  const mergedBase: MergedApBase[] = [{ id: 'lav', nombre: 'Lav', ud: 1 }];

  const run = (raw: { ramales: unknown[]; bajantes: unknown[] }, tramosSan: Tramo[]) => {
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '1', JSON.stringify(raw));
    const { componentTotalMap } = buildSanConnectivity(tramosSan, plans, mergedBase);
    return componentTotalMap;
  };

  // Topología base: RS1+RS4 descargan en [10,0]; RS5 nace en [10,0] (autosuma 2+1+1=4);
  // RS5 descarga en [20,0]; RS3 nace en [20,0] (recibe a RS5, 1+4=5).
  it('RS5 autosumado (mergesFrom) lleva flujo a RS3 simple', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
          mergesFrom: ['RS1', 'RS4'],
        },
        {
          id: 'RS3',
          pts: [
            [20, 0],
            [30, 0],
          ],
        },
      ],
      bajantes: [],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
        { ini: 'RS5' },
      ),
    ]);
    console.log('1:', map);
    expect(map['RS5-1']).toBe(4);
    expect(map['RS3-1']).toBe(5);
  });

  it('RS5 autosumado (mergesFrom) lleva flujo a RS3 que también es merge (RS5+RS2)', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
          mergesFrom: ['RS1', 'RS4'],
        },
        {
          id: 'RS2',
          pts: [
            [15, 10],
            [20, 0],
          ],
        },
        {
          id: 'RS3',
          pts: [
            [20, 0],
            [30, 0],
          ],
          mergesFrom: ['RS5', 'RS2'],
        },
      ],
      bajantes: [],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS2',
        [
          [15, 10],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
        { ini: 'RS5' },
      ),
    ]);
    console.log('2:', map);
    expect(map['RS5-1']).toBe(4);
    expect(map['RS3-1']).toBe(6);
  });

  it('RS5 con autosuma GEOMÉTRICA (sin mergesFrom) lleva flujo a RS3', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
        },
        {
          id: 'RS3',
          pts: [
            [20, 0],
            [30, 0],
          ],
        },
      ],
      bajantes: [],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
        { ini: 'RS5' },
      ),
    ]);
    console.log('3:', map);
    expect(map['RS5-1']).toBe(4);
    expect(map['RS3-1']).toBe(5);
  });

  it('receptor RS3 dibujado INVERTIDO (flujo 30→20) — RS5 descarga en [20,0]', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
          mergesFrom: ['RS1', 'RS4'],
        },
        {
          id: 'RS3',
          pts: [
            [30, 0],
            [20, 0],
          ],
          _tribReversed: true,
        },
      ],
      bajantes: [],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS3',
        [
          [30, 0],
          [20, 0],
        ],
        { lav: 1 },
        { ini: 'RS5' },
      ),
    ]);
    console.log('4:', map);
    expect(map['RS5-1']).toBe(4);
    expect(map['RS3-1']).toBe(5);
  });

  it('RS3 merge (RS5+RS2) con TERCER alimentador RS6 geométrico (no en mergesFrom)', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
          mergesFrom: ['RS1', 'RS4'],
        },
        {
          id: 'RS2',
          pts: [
            [15, 10],
            [20, 0],
          ],
        },
        {
          id: 'RS3',
          pts: [
            [20, 0],
            [30, 0],
          ],
          mergesFrom: ['RS5', 'RS2'],
        },
        {
          id: 'RS6',
          pts: [
            [20, 10],
            [20, 0],
          ],
        },
      ],
      bajantes: [],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS2',
        [
          [15, 10],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
        { ini: 'RS5' },
      ),
      mk(
        'RS6',
        [
          [20, 10],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
    ]);
    console.log('6:', map);
    expect(map['RS5-1']).toBe(4);
    expect(map['RS3-1']).toBe(7);
  });

  it('RS3 merge (RS5+RS2) que TAMBIÉN recibe un BAJANTE (descargaEnId) — el bajante captura el flujo', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
          mergesFrom: ['RS1', 'RS4'],
        },
        {
          id: 'RS2',
          pts: [
            [15, 10],
            [20, 0],
          ],
        },
        {
          id: 'RS3',
          pts: [
            [20, 0],
            [30, 0],
          ],
          mergesFrom: ['RS5', 'RS2'],
        },
      ],
      bajantes: [{ id: 'BA1', x: 20, y: 0, descargaEnId: 'RS3' }],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS2',
        [
          [15, 10],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
        { ini: 'RS5' },
      ),
      mk(
        'BA1',
        [
          [20, 0],
          [20, 0],
        ],
        {},
        { esBajante: true, id: 'BA1', descargaEnId: 'RS3' },
      ),
    ]);
    console.log('7:', map);
    expect(map['RS5-1']).toBe(4);
    expect(map['BA1-1']).toBe(5);
    expect(map['RS3-1']).toBe(6);
  });

  it('RS5 (merge RS1+RS4) recibe OTRO alimentador RS6 que descarga en SU CUERPO — el override no debe perderlo', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
          mergesFrom: ['RS1', 'RS4'],
        },
        {
          id: 'RS6',
          pts: [
            [15, 10],
            [15, 0],
          ],
        },
        {
          id: 'RS3',
          pts: [
            [20, 0],
            [30, 0],
          ],
        },
      ],
      bajantes: [],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS6',
        [
          [15, 10],
          [15, 0],
        ],
        { lav: 1 },
        { fin: 'RS5' },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
        { ini: 'RS5' },
      ),
    ]);
    console.log('8:', map);
    expect(map['RS5-1']).toBe(5);
    expect(map['RS3-1']).toBe(6);
  });

  it('RS3 recibe en su CUERPO (mitad) a RS5 autosumado', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 20],
          ],
          mergesFrom: ['RS1', 'RS4'],
        },
        {
          id: 'RS3',
          pts: [
            [0, 20],
            [40, 20],
          ],
        },
      ],
      bajantes: [],
    };
    const map = run(raw, [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 20],
        ],
        { lav: 1 },
        { fin: 'RS3' },
      ),
      mk(
        'RS3',
        [
          [0, 20],
          [40, 20],
        ],
        { lav: 1 },
      ),
    ]);
    console.log('5:', map);
    expect(map['RS5-1']).toBe(4);
    expect(map['RS3-1']).toBe(5);
  });
});
