import { describe, it, expect, beforeEach, vi } from 'vitest';
import { correrEspejos } from '../fixtureMirrors';
import type { EspejosArgs } from '../fixtureMirrorsTypes';
import { salidasDeBajante } from '../../fixturesStorage';
import { agregarCargaDeBajante } from '../bajanteAggregate';
import { applyBajanteAssociation } from '../../../utils/bajanteAssociation';
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

type Cnt = Record<string, number>;
function disk(): Record<string, Cnt> {
  return JSON.parse(mockStorage[DISK] || '{}');
}
function doc(p: string): {
  ts?: number;
  ramales?: Array<Record<string, unknown>>;
  bajantes?: Array<Record<string, unknown>>;
  crossFloorGhosts?: Array<Record<string, unknown>>;
} {
  return JSON.parse(mockStorage[DOC(p)] || '{}');
}
function putDoc(p: string, d: unknown): void {
  mockStorage[DOC(p)] = JSON.stringify(d);
}

const GRUPO: Cnt = { lav: 1, ino: 1, duc: 1 };

/** Bajante mínimo del motor. */
function baj(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'BAN1',
    net: 'san',
    code: 'BAN1',
    tipo: 'bajante',
    x: 60,
    y: 60,
    dNominal: '4"',
    ...extra,
  };
}
function ramal(id: string, pts: number[][], ini: string, fin?: string): Record<string, unknown> {
  return { id, net: 'san', tipo: 'ramal', pts, ini, fin, label: id };
}

function seed(cfg: { projP1?: boolean; projP2?: boolean } = {}): void {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  const p1Bajantes: Array<Record<string, unknown>> = [
    baj({ pisoBase: 'Piso 2', recibeDeIds: ['RS1'], alimentaIds: [] }),
    baj({ pisoBase: 'Piso 1', recibeDeIds: ['RS1'], alimentaIds: ['RS2'] }),
  ];
  if (!cfg.projP1) p1Bajantes.shift();
  putDoc('1', {
    ts: 1,
    scaleM: 0.5,
    ramales: [
      ramal(
        'RS1',
        [
          [200, 200],
          [60, 60],
        ],
        'RS1',
        'BAN1',
      ),
      ramal(
        'RS2',
        [
          [60, 60],
          [300, 300],
        ],
        'BAN1',
      ),
    ],
    bajantes: p1Bajantes,
  });
  const p2Bajantes: Array<Record<string, unknown>> = [
    baj({ pisoBase: 'Piso 2', recibeDeIds: ['RS1'], alimentaIds: [], descargaEnId: '1|BAN1' }),
  ];
  if (cfg.projP2) {
    p2Bajantes.push(
      baj({ pisoBase: 'Piso 1', recibeDeIds: ['RS1'], alimentaIds: ['RS2'], origenId: '2|BAN1' }),
    );
  }
  putDoc('2', {
    ts: 1,
    scaleM: 0.5,
    ramales: [
      ramal(
        'RS1',
        [
          [200, 200],
          [60, 60],
        ],
        'RS1',
        'BAN1',
      ),
    ],
    bajantes: p2Bajantes,
  });
  mockStorage[DISK] = JSON.stringify({ san_RS1_1: { ...GRUPO }, san_RS1_2: { ...GRUPO } });
}

type Eng = {
  _loadedPlanId: string;
  zoom: number;
  scaleM: number;
  nivelActual?: { label: string };
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
    nivelActual: { label: planId === '1' ? 'Piso 1' : 'Piso 2' },
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

/** Simula el AUTOSAVE del piso cargado: doc = motor. */
function guardarDesdeMotor(eng: Eng, planId: string): void {
  const d = doc(planId);
  putDoc(planId, { ...d, ts: Date.now(), ramales: eng.ramales, bajantes: eng.bajantes });
}

function asociar(): void {
  const engP2 = engineDe('2');
  applyBajanteAssociation(
    engP2 as never,
    {
      planId: '2',
      id: 'BAN1',
      x: 60,
      y: 60,
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
}

function ciclo(n: number): void {
  for (let i = 0; i < n; i++) {
    const e2 = engineDe('2');
    correrEspejos(args(e2, '2'));
    correrEspejos(args(e2, '2'));
    guardarDesdeMotor(e2, '2');
    const e1 = engineDe('1');
    correrEspejos(args(e1, '1'));
    correrEspejos(args(e1, '1'));
    guardarDesdeMotor(e1, '1');
  }
}

describe('repro san cross-floor con ids repetidos entre pisos y proyecciones', () => {
  beforeEach(() => seed());

  it('sin proyecciones: no crece', () => {
    asociar();
    ciclo(3);
    expect(disk()['san_RS1_1']).toEqual({ lav: 2, ino: 2, duc: 2 });
  });

  it('con proyecciones en ambos pisos: no crece', () => {
    seed({ projP1: true, projP2: true });
    asociar();
    ciclo(4);
    expect(disk()['san_RS1_1']).toEqual({ lav: 2, ino: 2, duc: 2 });
  });

  it('con proyeccion solo en el piso inferior: no crece', () => {
    seed({ projP1: true });
    asociar();
    ciclo(4);
    expect(disk()['san_RS1_1']).toEqual({ lav: 2, ino: 2, duc: 2 });
  });
});
