import { describe, it, expect, beforeEach, vi } from 'vitest';

// Matriz de dirección (orig. usuario): el aparato de RAF2 debe llegar SOLO a la continuación
// del split (mergesFrom) — nunca a la pieza upstream (RAF1, flecha entrando a la unión).
// Incluye la topología EXACTA de la imagen: montante bajando a J + contador a la izquierda.

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
});

vi.stubGlobal('window', { dispatchEvent: () => {} });

import { saveToStorage, loadFromStorage } from '../../services/storageService';
import { propagarAparatosPresion } from '../aparatosPresion';

const AF_KEY = 'aparatos_by_tramo_v2';

interface Caso {
  nombre: string;
  raf1: number[][];
  raf2: number[][];
  rev1?: boolean;
  esperaRaf1?: number;
}

function run(c: Caso): Record<string, Record<string, number>> {
  saveToStorage('trazos_P1', {
    ramales: [
      { id: 'RAF1', net: 'af', pts: c.raf1, _tribReversed: c.rev1 },
      { id: 'RAF2', net: 'af', pts: c.raf2 },
      // Genealogía del split real: la continuación carga anfitrión + entrante.
      {
        id: 'RAF3',
        net: 'af',
        pts: [
          [100, 0],
          [200, 0],
        ],
        mergesFrom: ['RAF1', 'RAF2'],
      },
    ],
    bajantes: [
      { id: 'MON1', code: 'MON1', net: 'af', tipo: 'montante', x: 100, y: -30 },
      { id: 'CNT1', code: 'CNT1', net: 'af', tipo: 'contador', x: 0, y: 0 },
    ],
  });
  const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
  disk0['af_RAF2_P1'] = { ducha: 1 };
  saveToStorage(AF_KEY, disk0);
  propagarAparatosPresion('af');
  return loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
}

const casos: Caso[] = [
  {
    nombre: 'RAF1 dibujado izquierda→J',
    raf1: [
      [0, 0],
      [100, 0],
    ],
    raf2: [
      [100, 0],
      [100, 80],
    ],
  },
  // Pieza almacenada [J..izq]: SIN mergesFrom propio y su cola en J — por flujo almacenado
  // sería salida, pero la regla usuario es estricta: solo mergesFrom hereda → no recibe.
  // Flujo almacenado J→izquierda SIN invertir: RAF1 es salida de la unión igual que RAF3 —
  // por flujo ambas reciben la base de la rama (es la misma física; el dibujo real del
  // usuario tiene la flecha de RAF1 HACIA la unión = casos 1/3).
  {
    nombre: 'RAF1 dibujado J→izquierda (sin flag)',
    raf1: [
      [100, 0],
      [0, 0],
    ],
    raf2: [
      [100, 0],
      [100, 80],
    ],
    esperaRaf1: 1,
  },
  {
    nombre: 'RAF1 J→izquierda invertido (_tribReversed)',
    raf1: [
      [100, 0],
      [0, 0],
    ],
    raf2: [
      [100, 0],
      [100, 80],
    ],
    rev1: true,
  },
  {
    nombre: 'RAF1 izq→J con rama invertida (abajo→J)',
    raf1: [
      [0, 0],
      [100, 0],
    ],
    raf2: [
      [100, 80],
      [100, 0],
    ],
  },
];

describe('dirección en la unión: el aparato del ramal rama solo baja hacia la salida', () => {
  for (const c of casos) {
    it(`${c.nombre}: RAF3 sí, RAF1 no`, () => {
      const disk = run(c);
      expect(disk['af_RAF3_P1']?.ducha ?? 0).toBe(1);
      expect(disk['af_RAF1_P1']?.ducha ?? 0).toBe(c.esperaRaf1 ?? 0);
    });
  }
});

describe('araña de ramales (imagen 2026-10-09: RAF4 + tributario → RAF3)', () => {
  it('RAF4 recibe su tributario y RAF3 recibe RAF1 + RAF4 (con tributario)', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        // Línea principal: RAF1 entra a J1=[100,0]; RAF3 = tramo [J1..J2]; RAF3B = [J2..der]
        // (el aterrizaje de RAF2 en J2 partió la línea — junctionAutoSplit).
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          id: 'RAF3',
          net: 'af',
          pts: [
            [100, 0],
            [150, 0],
          ],
        },
        {
          id: 'RAF3B',
          net: 'af',
          pts: [
            [150, 0],
            [200, 0],
          ],
        },
        // RAF4: diagonal con aparato arriba — sale de J1 hacia su aparato.
        {
          id: 'RAF4',
          net: 'af',
          pts: [
            [100, 0],
            [100, -80],
          ],
        },
        // TIRAF-4: tributario de RAF4 con aparato propio (tina).
        {
          id: 'TIRAF4',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAF4',
          pts: [
            [80, -40],
            [100, -40],
          ],
        },
        // RAF2: rama con lavamanos, salida en J2.
        {
          id: 'RAF2',
          net: 'af',
          pts: [
            [150, 0],
            [150, 80],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['af_TIRAF4_P1'] = { tina: 1 };
    disk0['af_RAF2_P1'] = { lavamanos: 1 };
    saveToStorage(AF_KEY, disk0);
    propagarAparatosPresion('af');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    // RAF4: su tributario (tina entra a su BASE) + la carga del entrante RAF1 en J1.
    expect(disk['af_RAF4_P1']).toEqual({ tina: 1 });
    // RAF3: entrante RAF1 (inodoro no hay aquí — sin montante) + base co-salida RAF4 (tina).
    expect(disk['af_RAF3_P1']).toEqual({ tina: 1 });
    // RAF3B (continuación final): carga de RAF3 (tina) + base co-salida RAF2 (lavamanos).
    expect(disk['af_RAF3B_P1']).toEqual({ tina: 1, lavamanos: 1 });
    // RAF1 (entrante) no recibe nada de las uniones.
    expect(disk['af_RAF1_P1']?.tina ?? 0).toBe(0);
    expect(disk['af_RAF1_P1']?.lavamanos ?? 0).toBe(0);
  });
});

describe('tributario aterrizado en vértice: plegado una sola vez, sin arista extra', () => {
  it('cabeza del trib EXACTO en la unión → cuenta una vez (auditoría #14)', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        {
          id: 'RAF3',
          net: 'af',
          pts: [
            [100, 0],
            [200, 0],
          ],
        },
        // Tributario cuya cabeza cae EXACTO en J=[100,0] (aterrizaje en extremo).
        {
          id: 'T1',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAF1',
          pts: [
            [100, 60],
            [100, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['af_T1_P1'] = { ducha: 1 };
    saveToStorage(AF_KEY, disk0);
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['af_T1_P1']).toEqual({ ducha: 1 });
    // RAF1 recibe la ducha UNA vez (plegado); RAF3 la recibe por la unión UNA vez.
    expect(disk['af_RAF1_P1']).toEqual({ ducha: 1 });
    expect(disk['af_RAF3_P1']).toEqual({ ducha: 1 });
  });
});

describe('imagen 2026-10-14: RAF3 acumula RAF1+RAF2; ramas solo lo propio', () => {
  it('lateral no recibe del entrante ni de la continuación', () => {
    saveToStorage('trazos_P1', {
      ramales: [
        // RAF1 horizontal entra a J=[100,0] con inodoro propio.
        {
          id: 'RAF1',
          net: 'af',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
        // RAF3 continúa recto desde J.
        {
          id: 'RAF3',
          net: 'af',
          pts: [
            [100, 0],
            [200, 0],
          ],
        },
        // RAF2 lateral: nace en J hacia abajo con lavamanos propio.
        {
          id: 'RAF2',
          net: 'af',
          pts: [
            [100, 0],
            [100, 80],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['af_RAF1_P1'] = { inodoro: 1 };
    disk0['af_RAF2_P1'] = { lavamanos: 1 };
    saveToStorage(AF_KEY, disk0);
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['af_RAF1_P1']).toEqual({ inodoro: 1 });
    expect(disk['af_RAF2_P1']).toEqual({ lavamanos: 1 });
    expect(disk['af_RAF3_P1']).toEqual({ inodoro: 1, lavamanos: 1 });
  });
});

describe('topología EXACTA de la imagen del usuario', () => {
  const imagen: Caso[] = [
    {
      nombre: 'rama J→abajo',
      raf1: [
        [0, 0],
        [100, 0],
      ],
      raf2: [
        [100, 0],
        [100, 80],
      ],
    },
    {
      nombre: 'rama abajo→J',
      raf1: [
        [0, 0],
        [100, 0],
      ],
      raf2: [
        [100, 80],
        [100, 0],
      ],
    },
    {
      nombre: 'RAF1 [J..izq] invertida',
      raf1: [
        [100, 0],
        [0, 0],
      ],
      raf2: [
        [100, 0],
        [100, 80],
      ],
      rev1: true,
    },
    {
      nombre: 'RAF1 [J..izq] sin flag',
      raf1: [
        [100, 0],
        [0, 0],
      ],
      raf2: [
        [100, 0],
        [100, 80],
      ],
      esperaRaf1: 1,
    },
  ];
  for (const c of imagen) {
    it(`${c.nombre}: ducha de RAF2 → solo RAF3 (RAF1 jamás)`, () => {
      const disk = run(c);
      expect(disk['af_RAF3_P1']?.ducha ?? 0).toBe(1);
      expect(disk['af_RAF1_P1']?.ducha ?? 0).toBe(c.esperaRaf1 ?? 0);
    });
  }
});
