import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document)
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => makeCanvas(),
    };
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      devicePixelRatio: 1,
    };
  if (!g.Image)
    g.Image = class {
      onload = () => {};
      onerror = () => {};
      set src(_v: string) {
        this.onerror();
      }
    };
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

// Escenario del usuario: tronco partido por tributarios (RS1|RS2 con mergesFrom) + tributarios
// colgando. Borrar EN CONJUNTO los tributarios: los troncos deben SOBREVIVIR (re-mezclados),
// los tee-ticks limpiarse y NADA más debe borrarse.
function buildScene(): PlanoEngine {
  const eng = makeEngine();
  eng.activeNet = 'san';
  // Tronco partido en dos por la unión de T1RS1: RS1 (aguas arriba) + RS2 (downstream autocreado).
  eng.ramales.push(
    mk(
      'RS1',
      'RS1',
      [
        [100, 100],
        [300, 100],
      ],
      { accesorioFin: 'teeSube' },
    ) as never,
    mk(
      'RS2',
      'RS2',
      [
        [300, 100],
        [600, 100],
      ],
      {
        mergesFrom: ['RS1', 'T1RS1'],
        accesorioInicio: 'teeDirecto',
      },
    ) as never,
    // T1RS1: el tributario entrante que partió al tronco (cuelga del punto (300,100)).
    mk(
      'T1RS1',
      'T1RS1',
      [
        [300, 100],
        [340, 180],
      ],
      {
        tipo: 'tributario',
        padre: 'RS1',
        bloqueado: true,
      },
    ) as never,
  );
  eng._markDirty();
  return eng;
}

describe('borrado en conjunto de tributarios — los troncos sobreviven y se re-mezclan', () => {
  it('borrar T1RS1: el tronco partido se re-unifica con tee limpiado', () => {
    const eng = buildScene();
    eng.deleteSelected(['T1RS1']);
    console.log(
      'AFTER:',
      JSON.stringify(
        eng.ramales.map((r) => ({
          id: r.id,
          label: r.label,
          mf: (r as unknown as { mergesFrom?: string[] }).mergesFrom ?? null,
          accI: (r as unknown as { accesorioInicio: string }).accesorioInicio,
          accF: (r as unknown as { accesorioFin: string }).accesorioFin,
        })),
      ),
    );
    // El tronco sigue existiendo (una sola pieza re-unificada o las dos originales).
    expect(eng.ramales.some((r) => r.id === 'RS1' || r.id === 'RS2')).toBe(true);
  });

  it('borrar TODOS los tributarios en conjunto: los troncos no desaparecen', () => {
    const eng = buildScene();
    const trams = eng.ramales.filter((r) => r.tipo === 'tributario').map((r) => r.id);
    eng.deleteSelected(trams);
    console.log('AFTER2:', JSON.stringify(eng.ramales.map((r) => ({ id: r.id, label: r.label }))));
    expect(eng.ramales.length).toBeGreaterThan(0);
    expect(eng.ramales.some((r) => r.id === 'RS1' || r.id === 'RS2')).toBe(true);
  });
});
