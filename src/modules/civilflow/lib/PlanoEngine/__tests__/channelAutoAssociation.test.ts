import { describe, it, expect, beforeAll } from 'vitest';
import { finishRamal } from '../finishRamal';
import { vetarSelloCanal, leerEstadoSello } from '../channelAssociation';
import PlanoEngineCtor from '../PlanoEngine.ts';
import type PlanoEngine from '../PlanoEngine.ts';

// Sello automático canal↔bajante por ramal (orig. usuario): un ramal ll que une canal y
// bajante registra b.canalId solo, para que menús/paneles lo muestren sin marcar a mano.

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
      get: (_t, k) => {
        if (k === 'canvas') return null;
        if (k === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
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

function makeEngine(): PlanoEngine {
  const canv = makeCanvas();
  const cw = { addEventListener: () => {}, removeEventListener: () => {}, style: {} };
  return new PlanoEngineCtor(cw as never, null, canv as unknown as HTMLCanvasElement);
}

/** Canal ll de 200cm x 50cm en (0,0) + bajante ll en (75,300). */
function seed(eng: PlanoEngine) {
  eng.bajantes.push({
    id: 'CNL1-P1',
    code: 'CNL1-P1',
    net: 'll',
    tipo: 'canal',
    x: 0,
    y: 0,
    longitud: 200,
    base: 50,
    altura: 20,
  } as never);
  eng.bajantes.push({
    id: 'BALL1',
    code: 'BALL1',
    net: 'll',
    tipo: 'bajante',
    x: 75,
    y: 300,
    recibeDeIds: [],
    alimentaIds: [],
  } as never);
}

function draw(eng: PlanoEngine, pts: number[][]) {
  eng.activeNet = 'll';
  eng.tipoTramo = 'ramal';
  eng.activeRamal = { net: 'll', tipo: 'ramal', padre: null, pts } as never;
  finishRamal(eng as never);
  return eng.ramales[eng.ramales.length - 1];
}

describe('sello automático canal↔bajante por ramal', () => {
  it('ramal canal→bajante: sella b.canalId', () => {
    const eng = makeEngine();
    seed(eng);
    draw(eng, [
      [75, 19],
      [75, 300],
    ]);
    const baj = eng.bajantes.find((b) => b.id === 'BALL1');
    expect(baj?.canalId).toBe('CNL1-P1');
  });

  it('ramal bajante→canal (se invierte al nacer del canal): también sella', () => {
    const eng = makeEngine();
    seed(eng);
    draw(eng, [
      [75, 300],
      [75, 19],
    ]);
    const baj = eng.bajantes.find((b) => b.id === 'BALL1');
    expect(baj?.canalId).toBe('CNL1-P1');
  });

  it('sin ramal puente: no sella (bajante suelto dentro del canal intacto)', () => {
    const eng = makeEngine();
    seed(eng);
    eng._markDirty();
    const baj = eng.bajantes.find((b) => b.id === 'BALL1');
    expect(baj?.canalId ?? null).toBeNull();
  });

  it('no pisa un canalId manual distinto', () => {
    const eng = makeEngine();
    seed(eng);
    const baj = eng.bajantes.find((b) => b.id === 'BALL1');
    if (baj) baj.canalId = 'CNL9';
    draw(eng, [
      [75, 19],
      [75, 300],
    ]);
    expect(eng.bajantes.find((b) => b.id === 'BALL1')?.canalId).toBe('CNL9');
  });

  it('desmarcar+veta no re-sella', () => {
    const pid = 'veto-baj';
    try {
      localStorage.removeItem('civilflow_sello_canal_' + pid);
    } catch {
      // sin storage = no-op
    }
    const eng = makeEngine();
    eng._loadedPlanId = pid;
    seed(eng);
    draw(eng, [
      [75, 19],
      [75, 300],
    ]);
    expect(eng.bajantes.find((b) => b.id === 'BALL1')?.canalId).toBe('CNL1-P1');
    vetarSelloCanal(pid, 'baj', 'BALL1', 'CNL1-P1');
    eng.updateElementById('BALL1', { canalId: null });
    eng._markDirty();
    expect(eng.bajantes.find((b) => b.id === 'BALL1')?.canalId ?? null).toBeNull();
  });

  it('mover el ramal fuera limpia el auto-stamp', () => {
    const pid = 'move-ram';
    try {
      localStorage.removeItem('civilflow_sello_canal_' + pid);
    } catch {
      // sin storage = no-op
    }
    const eng = makeEngine();
    eng._loadedPlanId = pid;
    seed(eng);
    const r = draw(eng, [
      [75, 19],
      [75, 300],
    ]);
    expect(eng.bajantes.find((b) => b.id === 'BALL1')?.canalId).toBe('CNL1-P1');
    const vivo = eng.ramales.find((x) => x.id === r.id);
    if (vivo)
      vivo.pts = [
        [400, 300],
        [500, 300],
      ];
    eng._markDirty();
    expect(eng.bajantes.find((b) => b.id === 'BALL1')?.canalId ?? null).toBeNull();
    expect(leerEstadoSello(pid).autoBaj).toHaveLength(0);
  });

  it('valor manual distinto intacto (no se pisa ni se registra)', () => {
    const pid = 'manual-dist';
    try {
      localStorage.removeItem('civilflow_sello_canal_' + pid);
    } catch {
      // sin storage = no-op
    }
    const eng = makeEngine();
    eng._loadedPlanId = pid;
    seed(eng);
    const baj = eng.bajantes.find((b) => b.id === 'BALL1');
    if (baj) baj.canalId = 'CNL9';
    draw(eng, [
      [75, 19],
      [75, 300],
    ]);
    eng._markDirty();
    expect(eng.bajantes.find((b) => b.id === 'BALL1')?.canalId).toBe('CNL9');
    expect(leerEstadoSello(pid).autoBaj).not.toContain('BALL1|CNL1-P1');
  });
});
