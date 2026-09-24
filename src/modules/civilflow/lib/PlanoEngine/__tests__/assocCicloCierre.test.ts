import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';
import { applyBajanteAssociation } from '../../../utils/bajanteAssociation';
import {
  migrateAssocLayoutOnLoad,
  sweepMisplacedLdesvios,
} from '../../../utils/assocLayoutMigration';

// Reproducción EXTREMO A EXTREMO del reporte ("cierro el dibujo y vuelvo a entrar y Ldesvio y
// el bajante fantasma se borran") con MOTOR REAL: asociar (superior cargado) → autosave del
// motor → cierre (migración + sweep, lo que corre al cerrar/cargar) → recarga de ambos pisos.
//
// Mock mínimo de canvas/DOM: el constructor del engine pide getContext('2d') y listeners.
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

const read = (planId: string) =>
  JSON.parse(localStorage.getItem('civilflow_trazos_' + planId) || '{}') as {
    ramales?: Array<{ id: string }>;
    bajantes?: Array<{ id: string; desplazamientos?: Record<string, unknown> }>;
    crossFloorGhosts?: Array<{ id: string }>;
  };

describe('asociación entre pisos — ciclo asociar → guardar → cerrar → recargar', () => {
  beforeEach(() => {
    localStorage.clear();
    const set = (k: string, v: unknown) =>
      localStorage.setItem('civilflow_' + k, JSON.stringify(v));
    set('trazos_2', {
      scaleM: 0.5,
      ramales: [],
      bajantes: [{ id: 'BAN9', net: 'san', tipo: 'bajante', x: 100, y: 80, dNominal: '4"' }],
    });
    set('trazos_1', {
      scaleM: 0.5,
      ramales: [],
      bajantes: [{ id: 'BAN8', net: 'san', tipo: 'bajante', x: 300, y: 200, dNominal: '4"' }],
    });
  });

  it('asociar desde el piso SUPERIOR cargado: LD y anillo persisten en el inferior, XFG en el superior', () => {
    const eng = makeEngine();
    eng._loadedPlanId = '2';
    eng.activeNet = 'san';
    // Cargar el piso 2 desde storage (como useTrazosLoader).
    const doc2 = JSON.parse(localStorage.getItem('civilflow_trazos_2') || '{}');
    eng.loadWork(doc2 as never);
    const plans = [
      { id: '1', status: 'confirmed', nivel: 1 },
      { id: '2', status: 'confirmed', nivel: 2 },
    ] as unknown as Parameters<typeof applyBajanteAssociation>[3];

    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN9',
        x: 100,
        y: 80,
        net: 'san',
        dNominal: '4"',
        code: 'BAN9',
        nivelN: 2,
        npt: 3,
      },
      {
        planId: '1',
        id: 'BAN8',
        x: 300,
        y: 200,
        net: 'san',
        dNominal: '4"',
        code: 'BAN8',
        nivelN: 1,
        npt: 0,
      },
      plans,
    );

    // Autosave del piso cargado (superior) — persistTrazosSnapshot en esencia.
    const work = eng.saveWork() as unknown as Record<string, unknown>;
    work.ts = Date.now();
    localStorage.setItem('civilflow_trazos_2', JSON.stringify(work));

    // Cierre/recarga: lo que corre en useTrazosLoader y en el prefetch.
    migrateAssocLayoutOnLoad('1', 'P1');
    sweepMisplacedLdesvios();
    migrateAssocLayoutOnLoad('2', 'P2');
    sweepMisplacedLdesvios();

    const lower = read('1');
    const upper = read('2');
    expect(lower.ramales?.some((r) => r.id === 'LD_BAN9')).toBe(true);
    const baj8 = lower.bajantes?.find((b) => b.id === 'BAN8');
    expect(Object.keys(baj8?.desplazamientos ?? {}).length).toBeGreaterThan(0);
    expect(upper.crossFloorGhosts?.some((g) => g.id === 'XFG_BAN8_1')).toBe(true);
  });
});
