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
      { id: 'RAF2', net: 'af', pts: c.raf2, aparatoFin: 'ducha' },
      // El runner corre UNA propagación por llamada; el test de 3 corridas está aparte.
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
    it(`${c.nombre}: RAF3 sí, RAF1 no (unión solo-de-salidas)`, () => {
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
          // La asignación real escribe el campo en el extremo de conexión (descarga en
          // RAF4) — lateral #14, pliegue al padre.
          aparatoFin: 'tina',
          pts: [
            [80, -40],
            [100, -40],
          ],
        },
        // RAF2: rama con lavamanos, salida en J2.
        {
          id: 'RAF2',
          net: 'af',
          aparatoFin: 'lavamanos',
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
          // Aparato en el extremo de CONEXIÓN: descarga EN la unión → plegado arriba
          // (doctrina #14; sin aparato allí sería down-trib receptor).
          aparatoFin: 'ducha',
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
    // Doctrina down-trib (2026-10-14): el trib vertical hacia abajo es la continuación
    // receptora — conserva su ducha y recibe la unión; el padre queda vacío (sustituye el
    // plegado hacia arriba del #14 original para esta geometría).
    expect(disk['af_T1_P1']).toEqual({ ducha: 1 });
    expect(disk['af_RAF1_P1']).toBeUndefined();
    expect(disk['af_RAF3_P1']).toBeUndefined();
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
          aparatoFin: 'inodoro',
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
          aparatoFin: 'lavamanos',
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
    it(`${c.nombre}: ducha de RAF2 → solo RAF3 (unión solo-de-salidas)`, () => {
      const disk = run(c);
      expect(disk['af_RAF3_P1']?.ducha ?? 0).toBe(1);
      expect(disk['af_RAF1_P1']?.ducha ?? 0).toBe(c.esperaRaf1 ?? 0);
    });
  }
});

// Doctrina down-trib (orig. usuario, imágenes 2026-10-14 RAC4/T1RAC4 y RAC6/T1RAC6): el
// tributario VERTICAL HACIA ABAJO es la continuación receptora de su unión — todo el carga
// baja por él (carga del entrante por clúster; el padre horizontal se vacía) y cada clave
// conserva lo propio (el sync del campo aparatoInicio/Fin mantiene el disco del trib).
describe('down-trib receptor: T1RAC4 recibe RAC2+T1RAC2, RAC4 vacío (imagen 2)', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAC1',
          net: 'af',
          pts: [
            [200, 0],
            [140, 0],
          ],
        },
        {
          id: 'RAC2',
          aparatoFin: 'ducha',
          net: 'af',
          pts: [
            [140, 0],
            [60, 0],
          ],
        },
        {
          id: 'RAC4',
          net: 'af',
          pts: [
            [60, 0],
            [0, 0],
          ],
        },
        // T1RAC2: trib de RAC2 que SUBE (plegado normal al padre).
        {
          id: 'T1RAC2',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC2',
          aparatoFin: 'tina',
          pts: [
            [140, -60],
            [140, 0],
          ],
        },
        // T1RAC4: trib de RAC4 que BAJA (down-trib receptor).
        {
          id: 'T1RAC4',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC4',
          aparatoFin: 'lavamanos',
          pts: [
            [60, 0],
            [60, 60],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    // Estado previo (doctrina vieja): el plegado viejo copió lavamanos/ducha a RAC4.
    disk0['af_RAC2_P1'] = { ducha: 1 };
    disk0['af_T1RAC2_P1'] = { tina: 1 };
    disk0['af_T1RAC4_P1'] = { lavamanos: 1 };
    disk0['af_RAC4_P1'] = { ducha: 1, lavamanos: 1 };
    saveToStorage(AF_KEY, disk0);
    saveToStorage('aparatos_heredados_trib_v1', {
      af_RAC2_P1: { tina: 1 },
      af_RAC4_P1: { lavamanos: 1 },
    });
    saveToStorage('aparatos_heredados_v1', { af_RAC4_P1: { ducha: 1 } });
  });

  it('T1RAC4 = ducha + tina + lavamanos; RAC4 vacío; RAC2 conserva lo propio', () => {
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['af_T1RAC4_P1']).toEqual({ ducha: 1, tina: 1, lavamanos: 1 });
    expect(disk['af_RAC4_P1']).toBeUndefined();
    expect(disk['af_RAC2_P1']).toEqual({ ducha: 1, tina: 1 });
    expect(disk['af_RAC1_P1'] ?? {}).toEqual({});
  });
});

describe('down-trib receptor: T1RAC6 recibe RAC6 + T1RAC7 (imagen 1)', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        // RAC7 entra por la derecha; T1RAC7 sube de él (plegado normal).
        {
          id: 'RAC7',
          aparatoFin: 'lavav',
          net: 'af',
          pts: [
            [180, 0],
            [120, 0],
          ],
        },
        {
          id: 'T1RAC7',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC7',
          aparatoInicio: 'ducha',
          pts: [
            [120, 0],
            [120, -60],
          ],
        },
        // Tronco entre tees.
        {
          id: 'RAC5',
          net: 'af',
          pts: [
            [120, 0],
            [60, 0],
          ],
        },
        // RAC6: continúa a la izquierda; T1RAC6 baja en su cola (down-trib receptor).
        {
          id: 'RAC6',
          aparatoFin: 'tina',
          net: 'af',
          pts: [
            [60, 0],
            [0, 0],
          ],
        },
        {
          id: 'T1RAC6',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC6',
          pts: [
            [60, 0],
            [60, 60],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['af_RAC7_P1'] = { lavav: 1, ducha: 1 };
    disk0['af_T1RAC7_P1'] = { ducha: 1 };
    disk0['af_RAC6_P1'] = { tina: 1 };
    disk0['af_T1RAC6_P1'] = {};
    saveToStorage(AF_KEY, disk0);
    saveToStorage('aparatos_heredados_trib_v1', { af_RAC7_P1: { ducha: 1 } });
  });

  it('T1RAC6 = tina (RAC6) + ducha (T1RAC7) + lavav (carga de RAC7); RAC6 vacío', () => {
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['af_T1RAC6_P1']).toEqual({ tina: 1, lavav: 1, ducha: 1 });
    // RAC6 conserva su propia tina (patrón tributario: consumidas conservan lo propio).
    expect(disk['af_RAC6_P1']).toEqual({ tina: 1 });
    expect(disk['af_RAC7_P1']).toEqual({ lavav: 1, ducha: 1 });
    expect(disk['af_T1RAC7_P1']).toEqual({ ducha: 1 });
  });
});

// Orig. usuario: la doctrina down-trib aplica a TODAS las redes de presión (af/ac/gas).
describe('down-trib receptor en GAS (misma topología, red gas)', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RG1',
          net: 'gas',
          pts: [
            [200, 0],
            [140, 0],
          ],
        },
        {
          id: 'RG2',
          aparatoFin: 'hor_g',
          net: 'gas',
          pts: [
            [140, 0],
            [60, 0],
          ],
        },
        {
          id: 'RG4',
          net: 'gas',
          pts: [
            [60, 0],
            [0, 0],
          ],
        },
        {
          id: 'T1RG4',
          net: 'gas',
          tipo: 'tributario',
          padre: 'RG4',
          aparatoInicio: 'est4',
          pts: [
            [60, 0],
            [60, 60],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['gas_RG2_P1'] = { hor_g: 1 };
    disk0['gas_T1RG4_P1'] = { est4: 1 };
    disk0['gas_RG4_P1'] = { hor_g: 1, est4: 1 };
    saveToStorage(AF_KEY, disk0);
    saveToStorage('aparatos_heredados_trib_v1', { gas_RG4_P1: { est4: 1 } });
    saveToStorage('aparatos_heredados_v1', { gas_RG4_P1: { hor_g: 1 } });
  });

  it('T1RG4 = hor_g (RG2) + est4 (propio); RG4 vacío', () => {
    propagarAparatosPresion('gas');
    propagarAparatosPresion('gas');
    propagarAparatosPresion('gas');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['gas_T1RG4_P1']).toEqual({ hor_g: 1, est4: 1 });
    expect(disk['gas_RG4_P1']).toBeUndefined();
    expect(disk['gas_RG2_P1']).toEqual({ hor_g: 1 });
  });
});

// Cascada trib-trib (orig. usuario imagen T1RAC3/T4RAC3/T5RAC3/T3RAC3/T2RAC3): en la cadena
// que baja, cada pieza recibe lo de las piezas que tiene ARRIBA — T4RAC3 recibe T1RAC3 y
// T5RAC3; T2RAC3 recibe T4RAC3 y T3RAC3 (cae en su cuerpo).
describe('cascada trib-trib: la carga baja por la cadena (imagen T4RAC3/T2RAC3)', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        // Raíz RAC3 llega por arriba; T1RAC3 baja de ella (down-trib receptor).
        {
          id: 'RAC3',
          net: 'af',
          pts: [
            [100, -80],
            [100, 0],
          ],
        },
        {
          id: 'T1RAC3',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC3',
          aparatoFin: 'ducha',
          pts: [
            [100, 0],
            [100, 100],
          ],
        },
        // T4RAC3: horizontal al pie de T1RAC3; T5RAC3 entra por la izquierda (más arriba).
        {
          id: 'T4RAC3',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC3',
          aparatoFin: 'lavamanos',
          pts: [
            [100, 100],
            [40, 100],
          ],
        },
        {
          id: 'T5RAC3',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC3',
          aparatoInicio: 'tina',
          pts: [
            [0, 60],
            [100, 60],
          ],
        },
        // T2RAC3 baja del mismo nudo; T3RAC3 horizontal cae en su CUERPO.
        {
          id: 'T2RAC3',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC3',
          aparatoFin: 'inodoro',
          pts: [
            [100, 100],
            [100, 200],
          ],
        },
        {
          id: 'T3RAC3',
          net: 'af',
          tipo: 'tributario',
          padre: 'RAC3',
          aparatoInicio: 'lavav',
          pts: [
            [40, 170],
            [100, 170],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['af_T1RAC3_P1'] = { ducha: 1 };
    disk0['af_T5RAC3_P1'] = { tina: 1 };
    disk0['af_T4RAC3_P1'] = { lavamanos: 1 };
    disk0['af_T3RAC3_P1'] = { lavav: 1 };
    disk0['af_T2RAC3_P1'] = { inodoro: 1 };
    saveToStorage(AF_KEY, disk0);
  });

  it('T4RAC3 = propio + T1RAC3 + T5RAC3; T2RAC3 = propio + T4RAC3 + T3RAC3', () => {
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    propagarAparatosPresion('af');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['af_T4RAC3_P1']).toEqual({ ducha: 1, tina: 1, lavamanos: 1 });
    expect(disk['af_T2RAC3_P1']).toEqual({
      ducha: 1,
      tina: 1,
      lavamanos: 1,
      lavav: 1,
      inodoro: 1,
    });
    // T1RAC3 retiene lo que le entra (tina de T5RAC3) y lo baja con su ducha.
    expect(disk['af_T1RAC3_P1']).toEqual({ ducha: 1, tina: 1 });
    expect(disk['af_T5RAC3_P1']).toEqual({ tina: 1 });
    expect(disk['af_T3RAC3_P1']).toEqual({ lavav: 1 });
  });
});

// Bajada-RAMAL receptora (orig. usuario imagen RAC3/RAC4/RAC2/T1RAC2): la bajada vertical
// sin carga propia recibe TODO el nudo; las horizontales se consumen (RAC4 vacío).
describe('bajada ramal receptora: RAC3 recibe RAC4+RAC2+T1RAC2', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAC1',
          net: 'ac',
          pts: [
            [200, 0],
            [150, 0],
          ],
        },
        // T1RAC2 sube del tronco (trib de RAC2, aparato en su extremo lejano).
        {
          id: 'T1RAC2',
          net: 'ac',
          tipo: 'tributario',
          padre: 'RAC2',
          aparatoInicio: 'tina',
          pts: [
            [150, -60],
            [150, 0],
          ],
        },
        {
          id: 'RAC2',
          aparatoFin: 'lavamanos',
          net: 'ac',
          pts: [
            [150, 0],
            [60, 0],
          ],
        },
        // RAC3: bajada vertical sin carga propia (continuación al piso de abajo).
        {
          id: 'RAC3',
          net: 'ac',
          pts: [
            [60, 0],
            [60, 100],
          ],
        },
        // RAC4: horizontal con aparato propio — se CONSUME en la bajada.
        {
          id: 'RAC4',
          aparatoFin: 'lavav',
          net: 'ac',
          pts: [
            [60, 0],
            [0, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['ac_RAC2_P1'] = { lavamanos: 1 };
    disk0['ac_T1RAC2_P1'] = { tina: 1 };
    disk0['ac_RAC4_P1'] = { lavav: 1 };
    saveToStorage(AF_KEY, disk0);
  });

  it('RAC3 = RAC2 + tina (T1RAC2) + lavav (RAC4); RAC4 vacío; RAC2 conserva lo propio', () => {
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['ac_RAC3_P1']).toEqual({ lavamanos: 1, tina: 1, lavav: 1 });
    // RAC4 conserva su propio aparato (patrón tributario: ambos lo muestran).
    expect(disk['ac_RAC4_P1']).toEqual({ lavav: 1 });
    // RAC2 conserva lo propio y la carga de T1RAC2 que pasa por él hacia la bajada.
    expect(disk['ac_RAC2_P1']).toEqual({ lavamanos: 1, tina: 1 });
    expect(disk['ac_T1RAC2_P1']).toEqual({ tina: 1 });
  });
});

// Bajada dibujada DE ABAJO HACIA ARRIBA (orig. usuario: RAC3 quedaba clasificada ENTRANTE
// — su cabeza toca la unión — y la doctrina nunca la veía: RAC4 acumulaba y RAC3 quedaba
// habilitada). La detección ahora es geométrica: manda el extremo lejano por debajo.
describe('bajada dibujada de abajo hacia arriba (geometría, no fin)', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        {
          id: 'RAC1',
          net: 'ac',
          pts: [
            [200, 0],
            [150, 0],
          ],
        },
        {
          id: 'RAC2',
          aparatoFin: 'lavamanos',
          net: 'ac',
          pts: [
            [150, 0],
            [60, 0],
          ],
        },
        // RAC3 dibujada DESDE ABAJO: pts[0] abajo, cabeza en la unión.
        {
          id: 'RAC3',
          net: 'ac',
          pts: [
            [60, 100],
            [60, 0],
          ],
        },
        {
          id: 'RAC4',
          aparatoFin: 'lavav',
          net: 'ac',
          pts: [
            [60, 0],
            [0, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['ac_RAC2_P1'] = { lavamanos: 1 };
    disk0['ac_RAC4_P1'] = { lavav: 1 };
    saveToStorage(AF_KEY, disk0);
  });

  it('RAC3 (invertida) recibe RAC2 + RAC4; RAC4 vacío', () => {
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['ac_RAC3_P1']).toEqual({ lavamanos: 1, lavav: 1 });
    expect(disk['ac_RAC4_P1']).toEqual({ lavav: 1 });
    expect(disk['ac_RAC2_P1']).toEqual({ lavamanos: 1 });
  });
});

// Libro de bajadas COMPARTIDO cross-net (orig. usuario RAC3/RAC2 2026-10-15): la poda y
// el re-marque de una red NO deben borrar las marcas de las demás. Antes, la secuencia
// af→ac→gas alternaba bug/reparación en cada corrida.
describe('libro de bajadas compartido sobrevive la secuencia multi-red', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        // Red ac del usuario (topología real): RAC1→RAC4→{RAC3, RAC2↓}→RAC5
        {
          id: 'RAC1',
          net: 'ac',
          pts: [
            [200, 0],
            [150, 0],
          ],
        },
        {
          id: 'RAC4',
          net: 'ac',
          pts: [
            [150, 0],
            [60, 0],
          ],
        },
        {
          id: 'RAC3',
          net: 'ac',
          aparatoFin: 'duc',
          pts: [
            [60, 0],
            [0, 0],
          ],
        },
        {
          id: 'RAC2',
          net: 'ac',
          pts: [
            [60, 0],
            [60, 100],
          ],
        },
        {
          id: 'RAC5',
          net: 'ac',
          pts: [
            [60, 100],
            [60, 180],
          ],
        },
        // Red af trivial (corre en la misma secuencia y antes podaba la marca de RAC2)
        {
          id: 'RAF1',
          net: 'af',
          aparatoFin: 'tina',
          pts: [
            [0, 0],
            [50, 0],
          ],
        },
        // Red gas trivial
        {
          id: 'RG1',
          net: 'gas',
          aparatoFin: 'est4',
          pts: [
            [0, 0],
            [50, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['ac_RAC2_P1'] = { tin: 1, duc: 1 };
    disk0['ac_RAC3_P1'] = { duc: 1 };
    disk0['af_RAF1_P1'] = { tina: 1 };
    disk0['gas_RG1_P1'] = { est4: 1 };
    saveToStorage(AF_KEY, disk0);
    // Estado previo del usuario: RAC2 ya marcada como bajada.
    saveToStorage('bajadas_receptoras_v1', { ac_RAC2_P1: 1 });
  });

  it('secuencia ac→af→gas ×3: RAC2 conserva {tin,duc} y RAC3 solo su ducha SIEMPRE', () => {
    for (let i = 0; i < 3; i++) {
      propagarAparatosPresion('ac');
      propagarAparatosPresion('af');
      propagarAparatosPresion('gas');
      const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
      // Corrida 1: el disco viene del estado previo sembrado — el libro marca y conserva.
      // Corridas 2-3: el estado se re-deriva y queda estable.
      // Estado estable en TODAS las corridas: RAC2 acumula (duc transferido de RAC3),
      // RAC3 conserva su propio, RAC5 hereda, el libro conserva ambas marcas.
      expect(disk['ac_RAC2_P1']).toEqual({ duc: 1 });
      expect(disk['ac_RAC3_P1']).toEqual({ duc: 1 });
      expect(disk['ac_RAC5_P1']).toEqual({ duc: 1 });
      const baj = loadFromStorage<Record<string, number>>('bajadas_receptoras_v1', {}) || {};
      expect(baj['ac_RAC2_P1']).toEqual(1);
      expect(baj['ac_RAC5_P1']).toEqual(1);
    }
  });
});

// Unión SOLO DE SALIDAS (orig. usuario RAC6 2026-10-15: RAC1, T1RAC6 y RAC6 con la cola en
// el nudo — todas las flechas hacia afuera): la malla clásica duplicaba cada aparato. La
// cascada por profundidad encadena consecutivo — RAC6 (el rack) acumula todo ×1.
describe('unión solo de salidas: RAC6 acumula cada aparato una vez', () => {
  beforeEach(() => {
    saveToStorage('trazos_P1', {
      ramales: [
        // RAC1: horizontal a la derecha del nudo, flecha hacia afuera (su ducha propia).
        {
          id: 'RAC1',
          net: 'ac',
          aparatoFin: 'ducha',
          pts: [
            [150, 0],
            [60, 0],
          ],
        },
        // T1RAC6: vertical hacia arriba desde el nudo, aparato en el extremo lejano.
        {
          id: 'T1RAC6',
          net: 'ac',
          tipo: 'tributario',
          padre: 'RAC6',
          aparatoInicio: 'tina',
          pts: [
            [60, -80],
            [60, 0],
          ],
        },
        // RAC6: horizontal a la izquierda del nudo (la pieza más profunda — el rack).
        {
          id: 'RAC6',
          net: 'ac',
          pts: [
            [60, 0],
            [-40, 0],
          ],
        },
      ],
      bajantes: [],
    });
    const disk0 = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    disk0['ac_RAC1_P1'] = { ducha: 1 };
    disk0['ac_T1RAC6_P1'] = { tina: 1 };
    saveToStorage(AF_KEY, disk0);
  });

  it('RAC6 = ducha (RAC1) + tina (T1RAC6), cada una ×1', () => {
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');
    const disk = loadFromStorage<Record<string, Record<string, number>>>(AF_KEY, {}) || {};
    expect(disk['ac_RAC6_P1']).toEqual({ ducha: 1, tina: 1 });
    expect(disk['ac_RAC1_P1']).toEqual({ ducha: 1 });
    expect(disk['ac_T1RAC6_P1']).toEqual({ tina: 1 });
  });
});
