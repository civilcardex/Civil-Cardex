import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';
import { deleteSelected } from '../deleteSelected';

// El "tapón soldado" (borrar un segmento del brazo principal de una yee doble) debía
// persistir: la limpieza de banderas muertas borraba `yeeDobleAt` sin blindaje y la
// validación de esquinas-L de la pasada siguiente retiraba el glifo y su conteo.

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

/** Yee doble: tronco horizontal B1-B2 con T vertical arriba. Borrar el tronco deja la T con
 *  dos tapones soldados en sus puertos. */
function seedYeeDoble(eng: PlanoEngine) {
  eng.activeNet = 'san';
  const base = {
    net: 'san',
    tipo: 'ramal',
    padre: null,
    piso: '',
    dz: '',
    uc: 0,
    labelAngle: 0,
    material: '',
    diametro: '4"',
    pendiente: 2,
    bloqueado: false,
    ini: '',
    fin: '',
  };
  eng.ramales.push(
    {
      ...base,
      id: 'RS1',
      label: 'RS1',
      totalL: 100,
      pts: [
        [-100, 0],
        [0, 0],
      ],
      labelX: -50,
      labelY: 0,
      yeeDobleAt: [
        [0, 0],
        [100, 0],
      ],
    } as never,
    {
      ...base,
      id: 'RS2',
      label: 'RS2',
      totalL: 100,
      pts: [
        [0, 0],
        [100, 0],
      ],
      labelX: 50,
      labelY: 0,
      yeeDobleAt: [
        [0, 0],
        [100, 0],
      ],
    } as never,
    {
      ...base,
      id: 'RS3',
      label: 'RS3',
      totalL: 60,
      pts: [
        [50, 0],
        [50, -60],
      ],
      labelX: 50,
      labelY: -30,
    } as never,
  );
  eng._markDirty();
}

describe('tapón soldado de yee doble: persistencia', () => {
  it('borrar el tronco coloca tapones y SOBREVIVEN a varias pasadas de _markDirty', () => {
    const eng = makeEngine();
    seedYeeDoble(eng);
    // Borrar RS1 (mitad del tronco) → preserveYeeDobleAt coloca tapones en la T.
    deleteSelected(eng, ['RS1']);
    eng._markDirty();

    const taponDespuesDe = (): number => {
      let n = 0;
      for (const r of eng.ramales) {
        if ((r as { accesorioInicio?: string }).accesorioInicio === 'tapon') n++;
        if ((r as { accesorioFin?: string }).accesorioFin === 'tapon') n++;
        for (const v of Object.values((r as { accMed?: Record<string, string> }).accMed || {}))
          if (v === 'tapon') n++;
      }
      return n;
    };

    const n1 = taponDespuesDe();
    expect(n1).toBeGreaterThan(0);

    // Pasadas adicionales: el bug reportado perdía el tapón en la 2ª pasada.
    for (let i = 0; i < 4; i++) {
      eng._markDirty();
      expect(taponDespuesDe()).toBe(n1);
    }
  });
});
