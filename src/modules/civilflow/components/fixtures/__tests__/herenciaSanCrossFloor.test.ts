import { describe, it, expect, beforeEach, vi } from 'vitest';
import { correrEspejos } from '../fixtureMirrors';
import type { EspejosArgs } from '../fixtureMirrorsTypes';
import { salidasDeBajante } from '../../fixturesStorage';
import { agregarCargaDeBajante } from '../bajanteAggregate';
import {
  applyBajanteAssociation,
  clearBajanteAssociation,
} from '../../../utils/bajanteAssociation';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../../constants/storage-keys.ts';

const mockStorage: Record<string, string> = {};
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

const DISK = 'civilflow_' + APARATOS_BY_TRAMO_KEY;
const DOC = (p: string) => 'civilflow_' + TRAZOS_PREFIX + p;

const PLANS = [
  { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' },
] as never;

function disk(): Record<string, Record<string, number>> {
  return JSON.parse(mockStorage[DISK] || '{}');
}
function setDisk(d: Record<string, Record<string, number>>): void {
  mockStorage[DISK] = JSON.stringify(d);
}
function doc(p: string): {
  ramales?: Array<Record<string, unknown>>;
  bajantes?: Array<Record<string, unknown>>;
  crossFloorGhosts?: Array<Record<string, unknown>>;
} {
  return JSON.parse(mockStorage[DOC(p)] || '{}');
}

function seed(): void {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  mockStorage[DOC('2')] = JSON.stringify({
    ts: 1,
    scaleM: 0.5,
    ramales: [
      {
        id: 'RU1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [120, 0],
          [0, 0],
        ],
        ini: 'RU1',
        fin: 'BAN1',
        label: 'RU1',
      },
    ],
    bajantes: [
      {
        id: 'BAN1',
        net: 'san',
        code: 'BAN1',
        tipo: 'bajante',
        x: 0,
        y: 0,
        recibeDeIds: ['RU1'],
        alimentaIds: [],
        dNominal: '4"',
      },
    ],
  });
  mockStorage[DOC('1')] = JSON.stringify({
    ts: 1,
    scaleM: 0.5,
    ramales: [
      {
        id: 'RL1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [200, 200],
          [60, 60],
        ],
        ini: 'RL1',
        fin: 'BAN1',
        label: 'RL1',
      },
      {
        id: 'RS1',
        net: 'san',
        tipo: 'ramal',
        pts: [
          [60, 60],
          [300, 300],
        ],
        ini: 'BAN1',
        label: 'RS1',
      },
    ],
    bajantes: [
      {
        id: 'BAN1',
        net: 'san',
        code: 'BAN1',
        tipo: 'bajante',
        x: 60,
        y: 60,
        recibeDeIds: ['RL1'],
        alimentaIds: ['RS1'],
        dNominal: '4"',
      },
    ],
  });
  setDisk({
    san_RU1_2: { lav: 1, ino: 1, duc: 1 },
    san_RL1_1: { lav: 1 },
  });
}

type Eng = {
  _loadedPlanId: string;
  zoom: number;
  scaleM: number;
  bajantes: Array<Record<string, unknown>>;
  ramales: Array<Record<string, unknown>>;
  crossFloorGhosts: Array<Record<string, unknown>>;
  updateElementById: (id: string, f: Record<string, unknown>) => void;
  triggerAlert: () => void;
  render: () => void;
  _markDirty: () => void;
  _emitStatus: () => void;
  _emitSelect: () => void;
};

function engineDe(planId: string): Eng {
  const d = doc(planId);
  const eng: Eng = {
    _loadedPlanId: planId,
    zoom: 1,
    scaleM: 0.5,
    bajantes: JSON.parse(JSON.stringify(d.bajantes || [])),
    ramales: JSON.parse(JSON.stringify(d.ramales || [])),
    crossFloorGhosts: JSON.parse(JSON.stringify(d.crossFloorGhosts || [])),
    updateElementById: (id, f) => {
      const el = [...eng.bajantes, ...eng.ramales].find((x) => x.id === id);
      if (el) Object.assign(el, f);
    },
    triggerAlert: () => {},
    render: () => {},
    _markDirty: () => {},
    _emitStatus: () => {},
    _emitSelect: () => {},
  };
  return eng;
}

function args(eng: Eng, planId: string): EspejosArgs {
  const counts = () => disk();
  return {
    engineRef: { current: eng } as never,
    loadingPlanRef: { current: false } as never,
    netId: 'san',
    planId,
    plans: PLANS,
    planLoadedTick: 0,
    targetId: null,
    counts: counts() as never,
    setCounts: () => {},
    hidroData: {},
    setHidroData: () => {},
    agregadoBajante: (bajId: string) =>
      agregarCargaDeBajante({
        bajId,
        counts: counts() as never,
        netId: 'san',
        planId,
        sanConnectivity: null,
        tramosPiso: [],
        exits: salidasDeBajante(eng as never, bajId),
        engineRef: { current: eng } as never,
      }),
    exitsDeBajante: (bajId: string) => salidasDeBajante(eng as never, bajId),
  } as never;
}

beforeEach(seed);

/** Simula el AUTOSAVE del piso cargado: doc = motor (como `serializeWork` + guardado). */
function guardarDesdeMotor(eng: Eng, planId: string): void {
  const d = doc(planId);
  mockStorage[DOC(planId)] = JSON.stringify({
    ...d,
    ts: Date.now(),
    ramales: eng.ramales,
    bajantes: eng.bajantes,
  });
}

describe('repro: san cross-floor asociado crece al cambiar de piso', () => {
  it('proyeccion del bajante PRIMERO en el doc inferior: no debe crecer', () => {
    // El doc del piso inferior arrastra una PROYECCIÃ“N del bajante del piso superior
    // (mismo id, pisoBase ajeno) ANTES del real â€” caso del dump de la ronda 53.
    const p1 = doc('1');
    p1.bajantes = [
      {
        id: 'BAN1',
        net: 'san',
        code: 'BAN1',
        tipo: 'bajante',
        pisoBase: 'Piso 2',
        x: 60,
        y: 60,
        recibeDeIds: ['RL1'],
        alimentaIds: ['RS1'],
        ucAplicado: {},
      },
      ...(p1.bajantes || []),
    ];
    p1.bajantes[1].pisoBase = 'Piso 1';
    mockStorage[DOC('1')] = JSON.stringify(p1);
    setDisk({ san_RU1_2: { lav: 1, ino: 1, duc: 1 }, san_RL1_1: { lav: 1, ino: 1, duc: 1 } });

    const engP2 = engineDe('2');
    applyBajanteAssociation(
      engP2 as never,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN1',
        x: 60,
        y: 60,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );
    const engP1 = engineDe('1');
    (engP1 as unknown as { nivelActual: { label: string } }).nivelActual = { label: 'Piso 1' };
    (engP2 as unknown as { nivelActual: { label: string } }).nivelActual = { label: 'Piso 2' };

    for (let cycle = 0; cycle < 3; cycle++) {
      correrEspejos(args(engineDe('2'), '2'));
      correrEspejos(args(engineDe('2'), '2'));
      guardarDesdeMotor(engineDe('2'), '2');
      correrEspejos(args(engineDe('1'), '1'));
      correrEspejos(args(engineDe('1'), '1'));
      guardarDesdeMotor(engineDe('1'), '1');
    }
    // Doctrina libro-solo: la herencia vive en el libro del bajante y la clave del Ldesvio —
    // el disco del ramal conserva SOLO lo propio sembrado y JAMÁS crece (ni siquiera la
    // proyección primero en el doc dispara la suma).
    expect(disk()['san_RL1_1']).toEqual({ lav: 1, ino: 1, duc: 1 });
    expect(disk()['san_RU1_2']).toEqual({ lav: 1, ino: 1, duc: 1 });
  });

  it('dos pisos, ciclos de espejos: el disco no debe crecer', () => {
    // 1) Asociar desde el piso SUPERIOR (P2 cargado).
    const engP2 = engineDe('2');
    applyBajanteAssociation(
      engP2 as never,
      {
        planId: '2',
        id: 'BAN1',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 1,
        npt: 320,
      },
      {
        planId: '1',
        id: 'BAN1',
        x: 60,
        y: 60,
        net: 'san',
        dNominal: '4"',
        code: 'BAN1',
        nivelN: 0,
        npt: 0,
      },
      PLANS,
    );

    for (let cycle = 0; cycle < 3; cycle++) {
      // Piso superior cargado
      correrEspejos(args(engineDe('2'), '2'));
      correrEspejos(args(engineDe('2'), '2'));
      // Piso inferior cargado (el asociado)
      correrEspejos(args(engineDe('1'), '1'));
      correrEspejos(args(engineDe('1'), '1'));
    }
    expect(disk()['san_RL1_1']).toEqual({ lav: 1 });
    expect(disk()['san_RU1_2']).toEqual({ lav: 1, ino: 1, duc: 1 });
  });
});

it('desasociar conserva el lavamanos propio del ramal (suelo de propio, auditoría F-1)', () => {
  // Doctrina libro-solo: el disco del ramal NUNCA recibió la herencia — restar el libro
  // completo al desasociar NO debe tocar lo propio (antes: cur − libro = 0, borraba {lav:1}).
  seed();
  const engP2 = engineDe('2');
  (engP2 as unknown as { nivelActual: { label: string } }).nivelActual = { label: 'Piso 2' };
  applyBajanteAssociation(
    engP2 as never,
    {
      planId: '2',
      id: 'BAN1',
      x: 0,
      y: 0,
      net: 'san',
      dNominal: '4"',
      code: 'BAN1',
      nivelN: 1,
      npt: 320,
    },
    {
      planId: '1',
      id: 'BAN1',
      x: 60,
      y: 60,
      net: 'san',
      dNominal: '4"',
      code: 'BAN1',
      nivelN: 0,
      npt: 0,
    },
    PLANS,
  );
  correrEspejos(args(engineDe('2'), '2')); // escribe libro + foto de lo propio del enlace
  expect(disk()['san_RL1_1']).toEqual({ lav: 1 });
  clearBajanteAssociation(engP2 as never, '2', 'BAN1', 'san', '1|BAN1', PLANS);
  expect(disk()['san_RL1_1']).toEqual({ lav: 1 });
  expect(disk()['san_RU1_2']).toEqual({ lav: 1, ino: 1, duc: 1 });
});
