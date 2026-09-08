import { describe, it, expect, beforeAll } from 'vitest';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';

// Reproducción EXTREMO A EXTREMO del bug reportado ("Ctrl+Z no quita el aparato asignado en el
// paso inmediato anterior") con el MOTOR REAL (no mocks): pausa → updateElementById → disco →
// resume → _markDirty (el mismo orden que FixturesPanel.inc) y luego undoLast.
//
// Mock mínimo de canvas/DOM: el constructor del engine pide getContext('2d') y registra
// listeners; nada de eso necesita comportamiento real para este flujo.
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

function sanRamal() {
  return {
    id: 'R1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [100, 0],
    ],
    totalL: 0,
    label: 'R1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 2,
    bloqueado: false,
  };
}

describe('Ctrl+Z aparatos — flujo real del motor (FixturesPanel.inc simulado)', () => {
  it('asignar aparato → UN Ctrl+Z revierte campo del ramal Y conteos de disco', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(sanRamal() as never);
    localStorage.setItem('civilflow_' + APARATOS_BY_TRAMO_KEY, JSON.stringify({}));
    eng._markDirty(); // estado base (carga del plano)

    // — Simula FixturesPanel.inc: pausa → mutación → disco-primero → resume → _markDirty —
    eng.pauseHistory();
    eng.updateElementById('R1', { aparatoFin: 'san', accesorioFin: 'codo90rmSube' });
    eng.render();
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ san_R1_1: { san: 1 } }),
    );
    eng.resumeHistory();
    eng._markDirty();

    expect((eng.ramales[0] as unknown as { aparatoFin: string }).aparatoFin).toBe('san');

    eng.undoLast();

    const r = eng.ramales[0] as unknown as {
      aparatoFin: string;
      accesorioFin: string;
    };
    expect(r.aparatoFin ?? '').toBe('');
    expect(r.accesorioFin ?? '').toBe('');
    expect(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY)).toBe(JSON.stringify({}));
  });

  it('dos acciones seguidas: cada Ctrl+Z revierte su paso', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(sanRamal() as never);
    eng._markDirty();

    // Acción 1: diametro
    eng.pauseHistory();
    eng.updateElementById('R1', { diametro: '2"' });
    eng.resumeHistory();
    eng._markDirty();
    // Acción 2: aparato
    eng.pauseHistory();
    eng.updateElementById('R1', { aparatoFin: 'lav' });
    localStorage.setItem(
      'civilflow_' + APARATOS_BY_TRAMO_KEY,
      JSON.stringify({ san_R1_1: { lav: 1 } }),
    );
    eng.resumeHistory();
    eng._markDirty();

    eng.undoLast();
    expect((eng.ramales[0] as unknown as { aparatoFin: string }).aparatoFin ?? '').toBe('');
    expect((eng.ramales[0] as unknown as { diametro: string }).diametro).toBe('2"');
    eng.undoLast();
    expect((eng.ramales[0] as unknown as { diametro: string }).diametro ?? '').toBe('');
  });

  it('_markDirty repetido sin cambios: undo sigue funcionando (dedupe de pasos muertos)', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    eng.ramales.push(sanRamal() as never);
    eng._markDirty();
    eng._markDirty(); // sin cambios → dedupe evita snapshot duplicado
    eng.pauseHistory();
    eng.updateElementById('R1', { aparatoFin: 'lav' });
    eng.resumeHistory();
    eng._markDirty();
    eng._markDirty(); // caller doble — dedupe
    eng.undoLast();
    expect((eng.ramales[0] as unknown as { aparatoFin: string }).aparatoFin ?? '').toBe('');
  });

  it('san: subir alimentador NO alerta — propaga el mayor al receptor y a la cadena', () => {
    const eng = makeEngine();
    eng.activeNet = 'san';
    const alertsViaEngine: string[] = [];
    (
      eng as unknown as {
        _onAlertCb: ((title: string, msg: string) => void) | null;
      }
    )._onAlertCb = (t, m) => alertsViaEngine.push(`${t}|${m}`);
    const mk = (id: string, pts: number[][], diam: string) =>
      ({
        ...sanRamal(),
        id,
        label: id,
        pts,
        diametro: diam,
      }) as never;
    // RS5 descarga sobre el CUERPO de RSH; RSH descarga sobre el cuerpo de RSH2.
    eng.ramales.push(
      mk(
        'RS5',
        [
          [0, 0],
          [50, 60],
        ],
        '2"',
      ),
      mk(
        'RSH',
        [
          [0, 60],
          [100, 60],
        ],
        '2"',
      ),
      mk(
        'RSH2',
        [
          [100, 0],
          [100, 100],
        ],
        '2"',
      ),
    );
    eng._markDirty();

    eng.updateElementById('RS5', { diametro: '4"' });

    expect(alertsViaEngine).toEqual([]); // sin alerta al cambiar desde el alimentador
    expect((eng.ramales[1] as unknown as { diametro: string }).diametro).toBe('4"');
    expect((eng.ramales[2] as unknown as { diametro: string }).diametro).toBe('4"');

    // Receptor que BAJA por debajo del mayor alimentador → SÍ alerta y bloquea.
    eng.updateElementById('RSH', { diametro: '2"' });
    expect(alertsViaEngine.length).toBe(1);
    expect((eng.ramales[1] as unknown as { diametro: string }).diametro).toBe('4"');
  });
});
