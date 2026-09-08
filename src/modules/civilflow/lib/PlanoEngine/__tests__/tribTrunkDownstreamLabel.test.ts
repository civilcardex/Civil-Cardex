import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

// Regla usuario (serie por raíz del padre inmediato): T1RS2 conecta a RS2, T2RS2 al cuerpo de
// T1RS2 — cuando OTRO tributario (T1RS1) aterriza al cuerpo de T1RS2 y lo parte, el tramo
// autocreado (downstream) hereda la raíz RS2 con el consecutivo siguiente: T3RS2.

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
  const eng = new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
  (eng as unknown as { _onAlertCb: ((t: string, m: string) => void) | null })._onAlertCb = (t, m) =>
    console.log('ALERTA:', t, '|', m);
  return eng;
}

function land(eng: PlanoEngine, id: string, label: string, pts: number[][], padre: string) {
  const inc = mk(id, label, pts, { tipo: 'tributario', padre, bloqueado: true });
  (eng as unknown as { activeRamal: unknown }).activeRamal = inc;
  (eng as unknown as { tipoTramo: string }).tipoTramo = 'tributario';
  eng.finishRamal();
}

describe('downstream de un split trib-trib hereda la raíz con el consecutivo siguiente', () => {
  it('T1RS1 aterriza al cuerpo de T1RS2 → el tramo autocreado es T3RS2 (padre RS2)', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
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
          [400, 100],
          [390, 180],
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
          [390, 180],
          [350, 250],
        ],
        {
          tipo: 'tributario',
          padre: 'RS2',
          bloqueado: true,
        },
      ) as never,
    );
    eng._markDirty();

    // T1RS1 (padre RS1) aterriza al cuerpo de T1RS2 (segmento (400,100)→(390,180)).
    land(
      eng,
      'T1RS1_IN',
      'T1RS1',
      [
        [450, 150],
        [396, 130],
      ],
      'RS1',
    );
    // Depuración del bloqueo: alertas del motor

    console.log(
      'PIEZAS:',
      JSON.stringify(
        eng.ramales.map((r) => ({
          id: r.id,
          label: r.label,
          padre: (r as unknown as { padre: string | null }).padre,
          tipo: r.tipo,
          mf: (r as unknown as { mergesFrom?: string[] }).mergesFrom ?? null,
        })),
      ),
    );
    const downstream = eng.ramales.find(
      (r) =>
        r.tipo === 'tributario' &&
        (r as unknown as { mergesFrom?: string[] }).mergesFrom?.[0] === 'T1RS2',
    ) as unknown as { label: string; padre: string } | undefined;
    expect(downstream).toBeDefined();
    expect(downstream!.label).toBe('T3RS2');
    expect(downstream!.padre).toBe('RS2');
    // Todos los tributarios de la serie RS2 quedan seguidos y con la raíz correcta.
    const serie = eng.ramales
      .filter((r) => r.tipo === 'tributario' && r.label.endsWith('RS2'))
      .map((r) => r.label)
      .sort();
    expect(serie).toEqual(['T1RS2', 'T2RS2', 'T3RS2', 'T4RS2']);
  });
});
