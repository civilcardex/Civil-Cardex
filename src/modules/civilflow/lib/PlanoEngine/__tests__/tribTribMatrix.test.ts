import { describe, it, expect, beforeAll } from 'vitest';
import PlanoEngineCtor from '../PlanoEngine';
import type PlanoEngine from '../PlanoEngine';
import { buildTribFromGuide } from '../../../components/pdfViewer/drawingElementContextMenu/guideOps';

// Matriz de reproducción "trib-trib comparten padre": 4 formas de aterrizar un tributario
// sobre T1RS2 (padre RS2) — cuerpo, cerca de vértice, extremo, y desde línea guía. En TODAS,
// cualquier trazo autocreado y el entrante deben quedar con padre/raíz RS2 (regla usuario).

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
      onload: () => void = () => {};
      onerror: () => void = () => {};
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

function baseScene(eng: PlanoEngine): void {
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
        [300, 100],
        [260, 180],
        [230, 260],
      ],
      {
        tipo: 'tributario',
        padre: 'RS2',
        bloqueado: true,
      },
    ) as never,
  );
  eng._markDirty();
}

type Row = { label: string; padre: string; tipo: string };

const dump = (eng: PlanoEngine): Row[] =>
  (eng.ramales as unknown as Array<Record<string, unknown>>).map((r) => ({
    label: String(r.label),
    padre: String(r.padre ?? 'null'),
    tipo: String(r.tipo),
  }));

describe('matriz trib-trib — el trazo autocreado y el entrante quedan en RS2', () => {
  it('A: aterriza a CUERPO de T1RS2 (control — ya pasaba)', () => {
    const eng = makeEngine();
    baseScene(eng);
    const inc = mk(
      'T2RS1',
      'T2RS1',
      [
        [120, 260],
        [248, 212],
      ],
      {
        tipo: 'tributario',
        padre: 'RS1',
        bloqueado: true,
      },
    );
    (eng as unknown as { activeRamal: unknown }).activeRamal = inc;
    (eng as unknown as { tipoTramo: string }).tipoTramo = 'tributario';
    eng.finishRamal();
    const rows = dump(eng);
    console.log('A:', JSON.stringify(rows));
    for (const r of rows.filter((x) => x.tipo === 'tributario')) {
      expect(r.padre).toBe('RS2');
      expect(r.label).toContain('RS2');
    }
  });

  it('B: aterriza al VÉRTICE interior de T1RS2 (260,180) con llegada a 135°', () => {
    const eng = makeEngine();
    baseScene(eng);
    const inc = mk(
      'T2RS1',
      'T2RS1',
      [
        [276, 227],
        [260, 180],
      ],
      {
        tipo: 'tributario',
        padre: 'RS1',
        bloqueado: true,
      },
    );
    (eng as unknown as { activeRamal: unknown }).activeRamal = inc;
    (eng as unknown as { tipoTramo: string }).tipoTramo = 'tributario';
    eng.finishRamal();
    const rows = dump(eng);
    console.log('B:', JSON.stringify(rows));
    expect(rows.filter((x) => x.tipo === 'tributario').length).toBe(2); // sí hubo unión
    for (const r of rows.filter((x) => x.tipo === 'tributario')) {
      expect(r.padre).toBe('RS2');
      expect(r.label).toContain('RS2');
    }
  });

  it('C: aterriza al EXTREMO libre de T1RS2 (230,260) con llegada a 135°', () => {
    const eng = makeEngine();
    baseScene(eng);
    const inc = mk(
      'T2RS1',
      'T2RS1',
      [
        [251, 305],
        [230, 260],
      ],
      {
        tipo: 'tributario',
        padre: 'RS1',
        bloqueado: true,
      },
    );
    (eng as unknown as { activeRamal: unknown }).activeRamal = inc;
    (eng as unknown as { tipoTramo: string }).tipoTramo = 'tributario';
    eng.finishRamal();
    const rows = dump(eng);
    console.log('C:', JSON.stringify(rows));
    // Si el motor rechazó la unión por dirección de flujo (extremo libre san), válido — lo
    // que JAMÁS puede pasar es un tributario con padre RS1 en este punto.
    for (const r of rows.filter((x) => x.tipo === 'tributario')) {
      expect(r.padre).not.toBe('RS1');
      expect(r.label).not.toContain('RS1');
    }
  });

  it('D: tributario creado desde LÍNEA GUÍA que cruza el cuerpo de T1RS2', () => {
    const eng = makeEngine();
    baseScene(eng);
    const padre = eng.ramales.find((r) => r.id === 'T1RS2');
    const trib = buildTribFromGuide(
      eng,
      padre!,
      [248, 212],
      [193, 237], // llegada a 135° relativa respecto del segmento (260,180)→(230,260)
      'T2_fromGuide',
    );
    expect(trib).not.toBeNull();
    const rows = dump(eng);
    console.log('D:', JSON.stringify(rows));
    for (const r of rows.filter((x) => x.tipo === 'tributario')) {
      expect(r.padre).toBe('RS2');
      expect(r.label).toContain('RS2');
    }
  });

  it('E: LEGACY — padre manda: la pieza con padre persistido sigue su cadena al primer _markDirty', () => {
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
      // Invariante elegido (pedido usuario): el PADRE es la verdad — una pieza legacy con
      // padre RS1 y label T1RS2 se alinea al padre (label → raíz RS1) al primer saneo.
      mk(
        'T1RS2',
        'T1RS2',
        [
          [300, 100],
          [260, 180],
          [230, 260],
        ],
        {
          tipo: 'tributario',
          padre: 'RS1',
          bloqueado: true,
        },
      ) as never,
    );
    eng._markDirty();
    const rows = dump(eng);
    console.log('E:', JSON.stringify(rows));
    const trib = rows.find((x) => x.tipo === 'tributario');
    expect(trib?.padre).toBe('RS1');
    expect(trib?.label).toContain('RS1');
  });
});
