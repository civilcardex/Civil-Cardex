import { describe, it, expect, vi } from 'vitest';
import { autoSplitJunctionAndSumFlow } from '../PlanoEngineDrawing.ts';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState.ts';
import { clasificarTeeDibujo } from '../intersectionTrim.ts';
import { renderJunctions } from '../renderers/renderJunctions.ts';

// 'Conexión sin entrada' RETIRADA (orig. usuario: lavamanos+tina con flechas hacia sus
// extremos = ninguna pieza ENTRA a la T — el split igual se forma para propagar al rack).
function mkRamal(
  id: string,
  net: string,
  pts: number[][],
  extra: Partial<PlanoRamal> = {},
): PlanoRamal {
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: id,
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 0,
    material: '',
    diametro: '',
    bloqueado: false,
    ...extra,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  return {
    ramales,
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    _netCounts: {},
    activeNet: 'ac',
    tipoTramo: 'ramal',
    padreTributario: null,
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    nivelActual: { label: 'P1', n: 1, npt: 0 },
    pxToM: (px: number) => px,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  } as unknown as IPlanoEngineCore;
}

describe('autoSplit sin ramal entrante (doctrina 2026-10-15)', () => {
  // T con las 3 ramas apuntando HACIA AFUERA del punto (cola en el nudo = salidas): la
  // configuración del usuario (lavamanos+tina hacia RAC6) ya no se bloquea ni se salta.
  it('el split SE FORMA aunque ninguna pieza entre al nudo', () => {
    // RAC5 horizontal con cola en el nudo [100,0]; T1RAC4 vertical hacia abajo (cola arriba).
    const rac5 = mkRamal('RAC5', 'ac', [
      [100, 0],
      [40, 0],
    ]);
    const t1rac4 = mkRamal('T1RAC4', 'ac', [
      [100, 0],
      [100, 60],
    ]);
    const engine = makeEngine([rac5, t1rac4]);
    const incoming = mkRamal('RAC1', 'ac', [
      [160, 0],
      [100, 0],
    ]);
    const alerts: string[] = [];
    const eng = engine as unknown as { triggerAlert: (t: string, m?: string) => void };
    eng.triggerAlert = (t: string, m?: string) => alerts.push(m || t);
    // El caller (junctionAutoSplit/finishRamal) agrega el incoming ANTES de partir.
    engine.ramales.push(incoming);
    const blocked = autoSplitJunctionAndSumFlow(engine, incoming);
    expect(blocked).toBe(false);
    expect(alerts.some((a) => /sin entrada/i.test(a))).toBe(false);
    // El nudo quedó partido: las piezas del usuario + la continuación existen.
    expect(engine.ramales.length).toBeGreaterThanOrEqual(3);
  });
});

describe('tee dibujada en ambos órdenes', () => {
  it.each(['rama', 'tronco'])('parte el tronco cuando %s se dibuja al final', (ultimo) => {
    const rama = mkRamal(
      'RRCI1',
      'rci',
      [
        [100, -50],
        [100, 0],
      ],
      { piso: '1' },
    );
    const tronco = mkRamal(
      'RRCI2',
      'rci',
      [
        [0, 0],
        [100, 0],
        [160, 0],
        [220, 0],
      ],
      {
        piso: '1',
        ini: 'origen',
        fin: 'remoto',
        accMed: { accMed2: 'rociadorNF#9' },
      },
    );
    const nuevo = ultimo === 'rama' ? rama : tronco;
    const previo = ultimo === 'rama' ? tronco : rama;
    const { tee, ambigua } = clasificarTeeDibujo(nuevo, [previo], () => false);
    expect(ambigua).toBe(false);
    expect(tee?.punto).toEqual([100, 0]);
    const engine = makeEngine([previo, nuevo]);
    expect(autoSplitJunctionAndSumFlow(engine, rama, tee!)).toBe(false);
    expect(engine.ramales).toHaveLength(3);
    expect(tronco.pts).toEqual([
      [0, 0],
      [100, 0],
    ]);
    expect(engine.ramales[2]).toMatchObject({
      pts: [
        [100, 0],
        [160, 0],
        [220, 0],
      ],
      fin: 'remoto',
      accMed: { accMed1: 'rociadorNF#9' },
    });
  });

  it('no clasifica un cruce, una tee ambigua ni una unión entre redes o pisos', () => {
    const tronco = mkRamal(
      'RRCI2',
      'rci',
      [
        [0, 0],
        [200, 0],
      ],
      { piso: '1' },
    );
    const rama = mkRamal(
      'RRCI1',
      'rci',
      [
        [100, -50],
        [100, 0],
      ],
      { piso: '1' },
    );
    for (const otro of [
      { ...rama, net: 'af' },
      { ...rama, piso: '2' },
      {
        ...rama,
        pts: [
          [100, -40],
          [100, 40],
        ],
      },
    ])
      expect(clasificarTeeDibujo(tronco, [otro], () => false).tee).toBeNull();
    const opuesta = mkRamal(
      'RRCI3',
      'rci',
      [
        [100, 50],
        [100, 0],
      ],
      { piso: '1' },
    );
    expect(clasificarTeeDibujo(tronco, [rama, opuesta], () => false)).toEqual({
      tee: null,
      ambigua: true,
    });
  });

  it('dibuja una sola tee para tres extremos y ninguna para cuatro brazos', () => {
    const eng = makeEngine([
      mkRamal('RRCI1', 'rci', [
        [100, -50],
        [100, 0],
      ]),
      mkRamal('RRCI2', 'rci', [
        [0, 0],
        [100, 0],
      ]),
      mkRamal('RRCI3', 'rci', [
        [100, 0],
        [200, 0],
      ]),
    ]);
    Object.assign(eng, {
      zoom: 1,
      mm2cvs: (mm: number) => mm,
      toCvs: (x: number, y: number) => ({ x, y }),
      getBajantesFantasma: () => [],
    });
    const beginPath = vi.fn();
    const ctx = {
      beginPath,
      save() {},
      restore() {},
      setLineDash() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
    } as unknown as CanvasRenderingContext2D;
    renderJunctions(ctx, eng);
    expect(beginPath).toHaveBeenCalledTimes(2); // símbolo y marcas, no una vez por ramal
    beginPath.mockClear();
    eng.ramales.push(
      mkRamal('RRCI4', 'rci', [
        [100, 0],
        [100, 50],
      ]),
    );
    renderJunctions(ctx, eng);
    expect(beginPath).not.toHaveBeenCalled();
  });
});
