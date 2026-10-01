import { describe, it, expect, beforeEach } from 'vitest';
import { drawRamalPath } from '../renderers/drawRamalPath';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Regresión (orig. usuario 2026-09-18): el renderer recortaba al borde de la caja AMBOS
// extremos (ini y fin) — un trazo que ENTRA a una caja AN/ALL quedaba cortado en el borde
// aunque el usuario lo terminara dentro. Regla: entra sin salir = se dibuja completo;
// solo se recorta si SOBRESALE por el otro lado. El extremo que SALE sigue recortándose
// siempre (PUNTO 1).

const CM2PX = (cm: number) => cm; // 1 cm = 1 unidad de modelo → semilado de caja = 50

function makeCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    arc: noop,
    fill: noop,
    fillRect: noop,
    save: noop,
    restore: noop,
    setLineDash: noop,
    lineWidth: 0,
    strokeStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: 'san',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { san: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    zoom: 1,
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (mm: number) => mm,
    realMmToCanvasPx: (mm: number) => mm,
    pxToM: (px: number) => px,
    cmToPlanePx: CM2PX,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
  };
  return engine as IPlanoEngineCore;
}

const caja = (code: string): PlanoBajante =>
  ({
    id: code,
    code,
    net: 'san',
    tipo: 'caja_san',
    x: 0,
    y: 0,
    dNominal: '4"',
  }) as unknown as PlanoBajante;

const ramal = (pts: number[][], ini: string, fin: string): PlanoRamal =>
  ({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts,
    totalL: 0,
    label: 'RS1',
    ini,
    fin,
    piso: '',
    dz: '',
    uc: 1,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '4"',
    pendiente: 0,
    bloqueado: true,
  }) as PlanoRamal;

describe('caja trim: entra sin salir no se recorta', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = makeCtx();
  });

  it('extremo DENTRO de la caja (fin): queda donde el usuario lo dejó', () => {
    const r = ramal(
      [
        [-150, 0],
        [30, 0],
      ],
      '',
      'CAN1',
    );
    const engine = makeEngine([r], [caja('CAN1')]);
    drawRamalPath(ctx, r.pts, engine, '#000');
    expect(r.pts[1][0]).toBe(30);
    expect(r.pts[1][1]).toBe(0);
  });

  it('extremo que SOBRESALE (entra y sale): se recorta al borde por donde cruza', () => {
    const r = ramal(
      [
        [-150, 0],
        [80, 0],
      ],
      '',
      'CAN1',
    );
    const engine = makeEngine([r], [caja('CAN1')]);
    drawRamalPath(ctx, r.pts, engine, '#000');
    expect(r.pts[1][0]).toBeCloseTo(50, 5);
    expect(r.pts[1][1]).toBe(0);
  });

  it('sobresale en diagonal: recorte en el borde del cuadro, no en la línea del semilado', () => {
    // Arranca DENTRO (30,-30) y sale por el borde x=50 en (50,-10).
    const r = ramal(
      [
        [30, -30],
        [90, 30],
      ],
      '',
      'CAN1',
    );
    const engine = makeEngine([r], [caja('CAN1')]);
    drawRamalPath(ctx, r.pts, engine, '#000');
    expect(r.pts[1][0]).toBeCloseTo(50, 5);
    expect(r.pts[1][1]).toBeCloseTo(-10, 5);
  });

  it('extremo que SALE de la caja (ini): sigue recortándose siempre (PUNTO 1)', () => {
    const r = ramal(
      [
        [0, 0],
        [150, 0],
      ],
      'CAN1',
      '',
    );
    const engine = makeEngine([r], [caja('CAN1')]);
    drawRamalPath(ctx, r.pts, engine, '#000');
    expect(r.pts[0][0]).toBeCloseTo(50, 5);
    expect(r.pts[0][1]).toBe(0);
  });

  it('sin caja asociada: geometría intacta', () => {
    const r = ramal(
      [
        [-150, 0],
        [80, 0],
      ],
      '',
      '',
    );
    const engine = makeEngine([r], [caja('CAN1')]);
    drawRamalPath(ctx, r.pts, engine, '#000');
    expect(r.pts[1][0]).toBe(80);
  });
});
