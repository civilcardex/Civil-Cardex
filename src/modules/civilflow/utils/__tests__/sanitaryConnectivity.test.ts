import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildSanConnectivity, type MergedApBase } from '../sanitaryRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';

describe('buildSanConnectivity — propagación de UCs en múltiples merges encadenados', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Mock minimal localStorage for Node vitest environment
    globalThis.localStorage = {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
      clear: () => {
        for (const k in mockLocalStorage) delete mockLocalStorage[k];
      },
      length: 0,
      key: () => null,
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  it('acumula correctamente las UCs a través de dos derivaciones (RS1 + T1RS1 -> RS2, RS2 + T2RS2 -> RS3)', () => {
    const planId = '1';
    const plans: PlanItem[] = [
      {
        id: 1,
        file: new File([], 'piso1.pdf'),
        name: 'Piso 1',
        nivel: 1,
        scale: 100,
        status: 'confirmed',
      },
    ];

    const rawTrazos = {
      ramales: [
        {
          id: 'RS1',
          pts: [
            [0, 0],
            [20, 0],
          ],
        },
        {
          id: 'T1RS1',
          pts: [
            [20, 20],
            [20, 0],
          ],
        },
        {
          id: 'RS2',
          pts: [
            [20, 0],
            [30, 0],
          ],
          mergesFrom: ['RS1', 'T1RS1'],
        },
        {
          id: 'T2RS2',
          pts: [
            [30, -20],
            [30, 0],
          ],
        },
        {
          id: 'RS3',
          pts: [
            [30, 0],
            [40, 0],
          ],
          mergesFrom: ['RS2', 'T2RS2'],
        },
      ],
      bajantes: [],
    };

    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + planId, JSON.stringify(rawTrazos));

    const mergedBase: MergedApBase[] = [
      { id: 'lavamanos', nombre: 'Lavamanos', ud: 1 },
      { id: 'inodoro', nombre: 'Inodoro', ud: 3 },
      { id: 'ducha', nombre: 'Ducha', ud: 2 },
    ];

    const tramosSan: Tramo[] = [
      {
        _key: `RS1-${planId}`,
        id: 'RS1',
        tipo: 'ramal',
        piso: 1,
        planId,
        esBajante: false,
        fixtures: { lavamanos: 2 }, // 2 * 1 = 2 UD
        recibeDe: [],
        descripcion: '',
        ini: '',
        fin: '',
        diamDisPulg: 2,
        nSalidas: 2,
        totalL: 20,
      },
      {
        _key: `T1RS1-${planId}`,
        id: 'T1RS1',
        tipo: 'ramal',
        piso: 1,
        planId,
        esBajante: false,
        fixtures: { inodoro: 1 }, // 1 * 3 = 3 UD
        recibeDe: [],
        descripcion: '',
        ini: '',
        fin: '',
        diamDisPulg: 2,
        nSalidas: 1,
        totalL: 20,
      },
      {
        _key: `RS2-${planId}`,
        id: 'RS2',
        tipo: 'ramal',
        piso: 1,
        planId,
        esBajante: false,
        fixtures: { ducha: 1 }, // 1 * 2 = 2 UD (propias de RS2)
        recibeDe: [],
        descripcion: '',
        ini: '',
        fin: '',
        diamDisPulg: 3,
        nSalidas: 1,
        totalL: 10,
      },
      {
        _key: `T2RS2-${planId}`,
        id: 'T2RS2',
        tipo: 'ramal',
        piso: 1,
        planId,
        esBajante: false,
        fixtures: { lavamanos: 1 }, // 1 * 1 = 1 UD
        recibeDe: [],
        descripcion: '',
        ini: '',
        fin: '',
        diamDisPulg: 2,
        nSalidas: 1,
        totalL: 20,
      },
      {
        _key: `RS3-${planId}`,
        id: 'RS3',
        tipo: 'ramal',
        piso: 1,
        planId,
        esBajante: false,
        fixtures: { lavamanos: 1 }, // 1 * 1 = 1 UD (propias de RS3)
        recibeDe: [],
        descripcion: '',
        ini: '',
        fin: 'B1', // descarga en bajante B1
        diamDisPulg: 4,
        nSalidas: 1,
        totalL: 10,
      },
    ];

    const { componentTotalMap } = buildSanConnectivity(tramosSan, plans, mergedBase);

    // RS1 parcial: 2 UD
    expect(componentTotalMap[`RS1-${planId}`]).toBe(2);

    // T1RS1 parcial: 3 UD
    expect(componentTotalMap[`T1RS1-${planId}`]).toBe(3);

    // RS2 debe tener: RS1 (2) + T1RS1 (3) + RS2 propia (2) = 7 UD
    expect(componentTotalMap[`RS2-${planId}`]).toBe(7);

    // T2RS2 parcial: 1 UD
    expect(componentTotalMap[`T2RS2-${planId}`]).toBe(1);

    // RS3 debe tener: RS2 (7) + T2RS2 (1) + RS3 propia (1) = 9 UD
    expect(componentTotalMap[`RS3-${planId}`]).toBe(9);
  });

  it('respeta estrictamente la dirección del flujo (_tribReversed) al conectar con bajantes y otros ramales', () => {
    const planId = '1';
    const plans: PlanItem[] = [
      {
        id: 1,
        file: new File([], 'piso1.pdf'),
        name: 'Piso 1',
        nivel: 1,
        scale: 100,
        status: 'confirmed',
      },
    ];

    // Ramal R1 trazado de [0,0] a [10,0].
    // Si _tribReversed es false, descarga en pts[last] = [10,0].
    // Si _tribReversed es true, descarga en pts[0] = [0,0].
    const rawTrazos = {
      ramales: [
        {
          id: 'R1',
          pts: [
            [0, 0],
            [10, 0],
          ],
          _tribReversed: true,
        },
        {
          id: 'R2',
          pts: [
            [-10, 0],
            [0, 0],
          ],
        }, // R2 termina en [0,0]
      ],
      bajantes: [],
    };

    localStorage.setItem('civilflow_' + TRAZOS_PREFIX + planId, JSON.stringify(rawTrazos));

    const mergedBase: MergedApBase[] = [{ id: 'inodoro', nombre: 'Inodoro', ud: 3 }];

    const tramosSan: Tramo[] = [
      {
        _key: `R1-${planId}`,
        id: 'R1',
        tipo: 'ramal',
        piso: 1,
        planId,
        esBajante: false,
        fixtures: { inodoro: 1 }, // 3 UD
        recibeDe: [],
        descripcion: '',
        ini: '',
        fin: '',
        diamDisPulg: 2,
        nSalidas: 1,
        totalL: 10,
      },
      {
        _key: `R2-${planId}`,
        id: 'R2',
        tipo: 'ramal',
        piso: 1,
        planId,
        esBajante: false,
        fixtures: { inodoro: 1 }, // 3 UD
        recibeDe: [],
        descripcion: '',
        ini: '',
        fin: 'B1', // R2 es la salida final hacia bajante
        diamDisPulg: 3,
        nSalidas: 1,
        totalL: 10,
      },
    ];

    const { componentTotalMap } = buildSanConnectivity(tramosSan, plans, mergedBase);

    // Como R1 tiene _tribReversed = true, su punto de salida (descarga) es pts[0] = [0,0].
    // En [0,0] conecta con R2. Por tanto, R1 descarga en R2.
    // R1 solo conserva sus propias 3 UD.
    expect(componentTotalMap[`R1-${planId}`]).toBe(3);

    // R2 recibe el flujo de R1 y acumula: R1 (3) + R2 propia (3) = 6 UD.
    expect(componentTotalMap[`R2-${planId}`]).toBe(6);
  });
});
