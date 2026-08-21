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

describe('repro imagen: RS1+RS4→RS5, RS5+RS2→RS3 (extremo a extremo)', () => {
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

  it('sin mergesFrom ni fin', () => {
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
        },
      ],
      bajantes: [],
    };
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '1', JSON.stringify(raw));
    const tramosSan = [
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
      ),
      mk(
        'RS2',
        [
          [15, 10],
          [20, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
      ),
    ];
    const { componentTotalMap, displayMap } = buildSanConnectivity(tramosSan, plans, mergedBase);
    console.log('A sin fin:', componentTotalMap);
    expect(componentTotalMap['RS5-1']).toBe(4);
    expect(componentTotalMap['RS3-1']).toBe(6);
    // OTROS = hijos inmediatos: RS3 recibe solo de RS5+RS2 (nunca RS1), RS5 de RS1+RS4.
    expect(displayMap['RS3-1']).toEqual(['RS5-1', 'RS2-1']);
    expect(displayMap['RS5-1']).toEqual(['RS1-1', 'RS4-1']);
  });

  it('con fin como lo escribe buildTramos (RS1.fin=RS5 etc)', () => {
    const raw = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [10, 0],
          ],
          fin: 'RS5',
        },
        {
          id: 'RS4',
          pts: [
            [5, -10],
            [10, 0],
          ],
          fin: 'RS5',
        },
        {
          id: 'RS5',
          pts: [
            [10, 0],
            [20, 0],
          ],
          ini: 'RS1',
          fin: 'RS3',
        },
        {
          id: 'RS2',
          pts: [
            [15, 10],
            [20, 0],
          ],
          fin: 'RS3',
        },
        {
          id: 'RS3',
          pts: [
            [20, 0],
            [30, 0],
          ],
          ini: 'RS5',
        },
      ],
      bajantes: [],
    };
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '1', JSON.stringify(raw));
    const tramosSan = [
      mk(
        'RS1',
        [
          [0, 0],
          [10, 0],
        ],
        { lav: 2 },
        { fin: 'RS5' },
      ),
      mk(
        'RS4',
        [
          [5, -10],
          [10, 0],
        ],
        { lav: 1 },
        { fin: 'RS5' },
      ),
      mk(
        'RS5',
        [
          [10, 0],
          [20, 0],
        ],
        { lav: 1 },
        { ini: 'RS1', fin: 'RS3' },
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
    ];
    const { componentTotalMap } = buildSanConnectivity(tramosSan, plans, mergedBase);
    console.log('B con fin:', componentTotalMap);
    expect(componentTotalMap['RS5-1']).toBe(4);
    expect(componentTotalMap['RS3-1']).toBe(6);
  });

  it('mergesFrom con RS1 residual: OTROS de RS3 excluye a RS1 (contenido en RS5) y el total no duplica', () => {
    // Datos persistidos viejos: RS3.mergesFrom incluye RS1 (residuo de una edición anterior),
    // además de RS5 y RS2. La columna OTROS debe mostrar solo RS5+RS2 — RS1 ya está
    // transitivamente contenido en RS5 — y el total NO debe contar a RS1 dos veces.
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
          mergesFrom: ['RS5', 'RS2', 'RS1'],
        },
      ],
      bajantes: [],
    };
    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + '1', JSON.stringify(raw));
    const tramosSan = [
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
      ),
      mk(
        'RS2',
        [
          [15, 10],
          [20, 0],
        ],
        { lav: 1 },
      ),
      mk(
        'RS3',
        [
          [20, 0],
          [30, 0],
        ],
        { lav: 1 },
      ),
    ];
    const { componentTotalMap, displayMap } = buildSanConnectivity(tramosSan, plans, mergedBase);
    expect(componentTotalMap['RS5-1']).toBe(4);
    expect(componentTotalMap['RS3-1']).toBe(6);
    // RS1 es descendiente de RS5 → excluido del OTROS de RS3.
    expect(displayMap['RS3-1']).toEqual(['RS5-1', 'RS2-1']);
    expect(displayMap['RS5-1']).toEqual(['RS1-1', 'RS4-1']);
  });
});
