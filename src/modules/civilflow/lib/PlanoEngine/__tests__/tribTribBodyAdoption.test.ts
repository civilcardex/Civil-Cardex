import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

// Reproducción: T2RS1 (padre RS1) se une a mitad del cuerpo de T1RS2 (padre RS2).
// Regla del usuario: TODOS los tributarios del punto comparten el padre del primer tributario
// (RS2) — incluido el tramo autocreado por el split (downstream).

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => makeCanvas(),
    };
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
  }
  if (!g.Image) {
    g.Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      set src(_v: string) {
        this.onerror();
      }
    };
  }
});

function makeCanvas() {
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'canvas' ? null : k === 'measureText' ? () => ({ width: 10 }) : () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    width: 800,
    height: 600,
    style: {},
    getContext: () => ctxStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
}

function mk(id: string, label: string, pts: number[][], extra: Record<string, unknown> = {}) {
  return {
    id,
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    nSalidas: 1,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
    ...extra,
  };
}

function makeEngine(): PlanoEngine {
  const canv = makeCanvas();
  const cw = { addEventListener: () => {}, removeEventListener: () => {}, style: {} };
  return new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
}

describe('trib-trib por cuerpo — todos comparten el padre del primer tributario', () => {
  it('T2RS1 (padre RS1) une a cuerpo de T1RS2 (padre RS2): entrante, downstream y cadena quedan en RS2', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    // RS1 y RS2: los troncos. T1RS2 cuelga de RS2 (padre RS2), diagonal hacia abajo.
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [300, 100],
      ]) as never,
      mk('RS2', 'RS2', [
        [300, 100],
        [600, 100],
      ]) as never,
      mk(
        'T1RS2',
        'T1RS2',
        [
          [300, 100],
          [260, 180],
          [230, 260],
        ],
        { tipo: 'tributario', padre: 'RS2', bloqueado: true },
      ) as never,
    );
    eng._markDirty();

    // T2RS1: dibujado con padre RS1 (detectTributaryPadre lo tomó de RS1), su punta aterriza
    // a mitad del CUERPO de T1RS2 (segmento (260,180)→(230,260), punto exacto (248,212)).
    const incoming = mk(
      'T2RS1',
      'T2RS1',
      [
        [120, 260],
        [248, 212],
      ],
      { tipo: 'tributario', padre: 'RS1', bloqueado: true },
    );
    (eng as unknown as { activeRamal: unknown }).activeRamal = incoming;
    (eng as unknown as { tipoTramo: string }).tipoTramo = 'tributario';
    eng.finishRamal();

    const after = eng.ramales.map((r) => ({
      id: r.id,
      label: r.label,
      padre: (r as unknown as { padre: string | null }).padre,
      tipo: r.tipo,
      mergesFrom: (r as unknown as { mergesFrom?: string[] }).mergesFrom ?? null,
    }));
    console.log('AFTER:', JSON.stringify(after, null, 1));

    // El incoming adopta la raíz del tributario al que se unió (RS2) — label y padre.
    const trams = eng.ramales.filter(
      (r) => (r as unknown as { tipo: string }).tipo === 'tributario',
    );
    expect(trams.length).toBe(3);
    // Toda pieza tributaria del punto comparte la raíz RS2 (regla usuario) con labels únicos.
    const labels = trams.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const r of trams) {
      expect(r.label).toContain('RS2');
      expect((r as unknown as { padre: string }).padre).toBe('RS2');
    }
  });
});

describe('sanado global de padres (healTribPadres en _markDirty)', () => {
  it('cadenas legítimas no se tocan (T2RS2 hija de T1RS2)', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS2', 'RS2', [
        [300, 100],
        [600, 100],
      ]) as never,
      mk(
        'T1RS2',
        'T1RS2',
        [
          [300, 100],
          [260, 180],
        ],
        {
          tipo: 'tributario',
          padre: 'RS2',
          bloqueado: true,
        },
      ) as never,
      mk(
        'T2RS2',
        'T2RS2',
        [
          [260, 180],
          [230, 260],
        ],
        {
          tipo: 'tributario',
          padre: 'T1RS2',
          bloqueado: true,
        },
      ) as never,
    );
    eng._markDirty();
    const t2 = eng.ramales.find((r) => r.id === 'T2RS2') as unknown as { padre: string };
    expect(t2.padre).toBe('T1RS2'); // cadena legítima intacta
  });
});

describe('segunda pasada — downstream nacido con label+padre equivocados (pre-reglas)', () => {
  it('downstream T2RS1/padre RS1 (mergesFrom de T1RS2) → hereda RS2 de upstream y re-label', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS2', 'RS2', [
        [300, 100],
        [600, 100],
      ]) as never,
      mk(
        'T1RS2',
        'T1RS2',
        [
          [300, 100],
          [260, 180],
        ],
        {
          tipo: 'tributario',
          padre: 'RS2',
          bloqueado: true,
        },
      ) as never,
      // Nacido antes de las reglas: label Y padre con la raíz equivocada.
      mk(
        'T3X',
        'T2RS1',
        [
          [260, 180],
          [230, 260],
        ],
        {
          tipo: 'tributario',
          padre: 'RS1',
          bloqueado: false,
          mergesFrom: ['T1RS2', 'INC'],
        },
      ) as never,
    );
    eng._markDirty();
    const t3 = eng.ramales.find((r) => r.id === 'T3X') as unknown as {
      padre: string;
      label: string;
    };
    expect(t3.padre).toBe('RS2');
    expect(t3.label).toContain('RS2');
  });
});

describe('pass 4 — renumeración sin huecos por raíz', () => {
  it('T1RS1/T3RS1/T4RS1 (T2 quemado) → T1RS1/T2RS1/T3RS2... renumerados seguidos', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(
      mk('RS1', 'RS1', [
        [100, 100],
        [600, 100],
      ]) as never,
      mk(
        'A1',
        'T1RS1',
        [
          [200, 100],
          [220, 180],
        ],
        { tipo: 'tributario', padre: 'RS1', bloqueado: true },
      ) as never,
      mk(
        'A2',
        'T3RS1',
        [
          [350, 100],
          [370, 180],
        ],
        { tipo: 'tributario', padre: 'RS1', bloqueado: true },
      ) as never,
      mk(
        'A3',
        'T4RS1',
        [
          [450, 100],
          [470, 180],
        ],
        { tipo: 'tributario', padre: 'RS1', bloqueado: true },
      ) as never,
    );
    eng._markDirty();
    const labels = eng.ramales
      .filter((r) => r.tipo === 'tributario')
      .map((r) => r.label)
      .sort();
    expect(labels).toEqual(['T1RS1', 'T2RS1', 'T3RS1']);
  });
});
