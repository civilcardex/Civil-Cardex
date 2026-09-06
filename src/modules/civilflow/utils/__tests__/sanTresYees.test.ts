import { describe, it, expect, beforeEach } from 'vitest';
import { computeAccesoriosTable } from '../sanAccesoriosRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

// Reporte usuario: 3 yees simples sobre el tronco (imagen WC) — la tabla contaba 2.
// Repro con las variantes que pueden hacer caer una unión del conteo.
function setLocalStorage(key: string, val: unknown) {
  (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(
    'civilflow_' + key,
    JSON.stringify(val),
  );
}
function resetStorage() {
  (globalThis as unknown as { localStorage: Storage }).localStorage = (() => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, String(v)),
      removeItem: (k: string) => m.delete(k),
      clear: () => m.clear(),
      key: (_i: number) => null,
      get length() {
        return m.size;
      },
    };
  })();
}

const plans = [{ id: 1, name: 'P1', nivel: 1, status: 'confirmed' as const }];
const tramo = (o: Record<string, unknown>) =>
  ({ planId: 1, piso: 1, fixtures: {}, ...o }) as unknown as Tramo;

function colTotal(table: NonNullable<ReturnType<typeof computeAccesoriosTable>>, nombre: string) {
  const idx = table.headers.indexOf(nombre);
  if (idx < 0) return 0;
  return table.rows.reduce((s, r) => s + Number(r[idx] || 0), 0);
}

// Tronco horizontal [[0,0],[120,0]] con 3 derivaciones a 45° en x=30/60/90.
const TRIBS_45 = [
  {
    id: 'T1RS1',
    net: 'san',
    tipo: 'tributario',
    pts: [
      [22.9, -7.1],
      [30, 0],
    ],
    diametro: '2"',
  },
  {
    id: 'T2RS1',
    net: 'san',
    tipo: 'tributario',
    pts: [
      [52.9, 7.1],
      [60, 0],
    ],
    diametro: '2"',
  },
  {
    id: 'T3RS1',
    net: 'san',
    tipo: 'tributario',
    pts: [
      [82.9, 7.1],
      [90, 0],
    ],
    diametro: '2"',
  },
];

function setDraw(ramales: unknown[]) {
  setLocalStorage('trazos_1', { v: 3, ts: 1, ramales, bajantes: [] });
}

describe('Resumen san — 3 yees simples sobre el tronco', () => {
  beforeEach(() => {
    resetStorage();
    setLocalStorage('tramo_hidro_data_v3', {});
  });

  it('tronco continuo + 3 tributarios a 45° → Yee simple = 3', () => {
    setDraw([
      {
        id: 'RS1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [120, 0],
        ],
        diametro: '2"',
      },
      ...TRIBS_45,
    ]);
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(colTotal(table!, 'Yee simple')).toBe(3);
  });

  it('tronco PARTIDO en piezas (splits) + 3 tributarios → Yee simple = 3', () => {
    setDraw([
      {
        id: 'RS1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [30, 0],
        ],
        diametro: '2"',
      },
      {
        id: 'RS3',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [30, 0],
          [60, 0],
        ],
        diametro: '2"',
      },
      {
        id: 'RS5',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [60, 0],
          [90, 0],
        ],
        diametro: '2"',
      },
      {
        id: 'RS7',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [90, 0],
          [120, 0],
        ],
        diametro: '2"',
      },
      ...TRIBS_45,
    ]);
    const table = computeAccesoriosTable(
      'san',
      [
        tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 }),
        tramo({ id: 'RS3', _key: 'RS3-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 }),
        tramo({ id: 'RS5', _key: 'RS5-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 }),
        tramo({ id: 'RS7', _key: 'RS7-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 }),
      ],
      plans as unknown as PlanItem[],
    );
    expect(colTotal(table!, 'Yee simple')).toBe(3);
  });

  it('tributario SIN diámetro: la unión no debe perderse del conteo', () => {
    setDraw([
      {
        id: 'RS1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [120, 0],
        ],
        diametro: '2"',
      },
      { ...TRIBS_45[0] },
      { ...TRIBS_45[1] },
      {
        id: 'T3RS1',
        net: 'san',
        tipo: 'tributario',
        pts: [
          [82.9, 7.1],
          [90, 0],
        ],
        diametro: '',
      },
    ]);
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(colTotal(table!, 'Yee simple')).toBe(3);
  });

  it('ramal empinado ~60°: la unión no debe perderse del conteo', () => {
    const steep = [
      {
        id: 'T1RS1',
        net: 'san',
        tipo: 'tributario',
        pts: [
          [22.9, -7.1],
          [30, 0],
        ],
        diametro: '2"',
      },
      {
        id: 'T2RS1',
        net: 'san',
        tipo: 'tributario',
        pts: [
          [52.9, 7.1],
          [60, 0],
        ],
        diametro: '2"',
      },
      // 60° sobre el tronco: cos ≈ 0.5… caso límite del rango yee
      {
        id: 'T3RS1',
        net: 'san',
        tipo: 'tributario',
        pts: [
          [85, 17.3],
          [90, 0],
        ],
        diametro: '2"',
      },
    ];
    setDraw([
      {
        id: 'RS1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [120, 0],
        ],
        diametro: '2"',
      },
      ...steep,
    ]);
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(colTotal(table!, 'Yee simple')).toBe(3);
  });
  it('cercanía: dos uniones a 8 mm que el geométrico emparejaría → el motor manda (3 simples)', () => {
    // Junctions en x=30 y x=38 (8 unidades ≤ DOBLE_YEE_MM): el emparejamiento geométrico las
    // clasificaría 1 doble + 1 simple. El motor (glifos que ve el usuario) dice 3 simples.
    setDraw([
      {
        id: 'RS1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [120, 0],
        ],
        diametro: '2"',
      },
      {
        id: 'T1RS1',
        net: 'san',
        tipo: 'tributario',
        pts: [
          [22.9, -7.1],
          [30, 0],
        ],
        diametro: '2"',
      },
      {
        id: 'T2RS1',
        net: 'san',
        tipo: 'tributario',
        pts: [
          [30.9, 7.1],
          [38, 0],
        ],
        diametro: '2"',
      },
      {
        id: 'T3RS1',
        net: 'san',
        tipo: 'tributario',
        pts: [
          [82.9, 7.1],
          [90, 0],
        ],
        diametro: '2"',
      },
    ]);
    // Verdad del motor (calcSanitaryAccessories): 3 yees simples, 0 dobles.
    setLocalStorage('tramo_hidro_data_v3', {
      san_RS1_1: { accesorios: { yeeSimple: 3 }, Lh: 0, nSalidas: 0 },
    });
    const table = computeAccesoriosTable(
      'san',
      [tramo({ id: 'RS1', _key: 'RS1-1', tipo: 'ramal', diametro: '2"', diamDisPulg: 2 })],
      plans as unknown as PlanItem[],
    );
    expect(colTotal(table!, 'Yee simple')).toBe(3);
    expect(colTotal(table!, 'Yee doble')).toBe(0);
  });
});
