import { describe, it, expect, beforeEach } from 'vitest';
import { drawRamalPath } from '../renderers/drawRamalPath';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Regresión: asignar un codo 90° (glifo disco blanco relleno) en el extremo de un ramal AF/AC/gas
// de 2 segmentos tapaba el arco del codo del quiebre interior — el glifo de extremo se dibuja en
// un pase POSTERIOR al path del ramal, y si el extremo quedaba cerca del quiebre, el disco blanco
// cubría el arco. El fix redibuja solo las marcas de codo (marksOnly) tras el glifo.

function makeCtx(): CanvasRenderingContext2D & { events: string[] } {
  const events: string[] = [];
  const noop = () => {};
  const ctx = {
    events,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: () => {
      events.push('lineTo');
    },
    stroke: () => {
      events.push('stroke');
    },
    arc: (x: number, y: number, r: number) => {
      events.push(`arc:${x.toFixed(1)},${y.toFixed(1)},${r.toFixed(1)}`);
    },
    fill: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    setLineDash: noop,
    drawImage: noop,
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: () => ({ data: [] as unknown as Uint8ClampedArray }),
    putImageData: noop,
    clip: noop,
    setTransform: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & { events: string[] };
  return ctx;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [] as PlanoBajante[],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    activeNet: 'af',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: { af: { ramal: 0, tributario: 0 } },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    zoom: 1,
    toCvs: (x: number, y: number) => ({ x, y }),
    mm2cvs: (mm: number) => mm,
    realMmToCanvasPx: (mm: number) => mm,
    pxToM: (px: number) => px,
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

// Ramal AF de 2 segmentos con quiebre 90° en (40,0) y extremo en (40,30) — segmento corto,
// el escenario donde el disco del codo de extremo tapa el arco del quiebre.
function twoSegBendRamal(): PlanoRamal {
  return {
    id: 'RAF1',
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
      [40, 30],
    ],
    totalL: 0,
    label: 'RAF1',
    ini: '',
    fin: '',
    piso: '',
    dz: '',
    uc: 1,
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
    accesorioFin: 'codo90rmSube',
  } as PlanoRamal;
}

describe('bend arc survives endpoint codo glyph', () => {
  let ctx: CanvasRenderingContext2D & { events: string[] };
  let engine: IPlanoEngineCore;

  beforeEach(() => {
    ctx = makeCtx();
    engine = makeEngine([twoSegBendRamal()]);
  });

  it('dibuja el arco del quiebre interior en el pase normal', () => {
    drawRamalPath(ctx, engine.ramales[0].pts, engine, '#000000');
    // Quiebre 90° en (40,0): arco centrado en (38.5, 1.5) con radio 1.5 (mm2cvs identidad).
    expect(ctx.events.some((e) => e.startsWith('arc:38.5,1.5,1.5'))).toBe(true);
  });

  it('marksOnly redibuja el arco del quiebre sin trazar el cuerpo', () => {
    drawRamalPath(ctx, engine.ramales[0].pts, engine, '#000000', { marksOnly: true });
    expect(ctx.events.some((e) => e.startsWith('arc:38.5,1.5,1.5'))).toBe(true);
    // El cuerpo no se traza: el único lineTo permitido es el de las marcas T_A/T_C (2 ticks).
    expect(ctx.events.filter((e) => e === 'lineTo')).toHaveLength(2);
  });

  it('marksOnly no produce marcas ni trazos en un ramal recto sin quiebre', () => {
    const straight: PlanoRamal = {
      ...twoSegBendRamal(),
      pts: [
        [0, 0],
        [60, 0],
      ],
    };
    const flatEngine = makeEngine([straight]);
    drawRamalPath(ctx, flatEngine.ramales[0].pts, flatEngine, '#000000', { marksOnly: true });
    expect(ctx.events).not.toContain('stroke');
    expect(ctx.events.some((e) => e.startsWith('arc:'))).toBe(false);
  });
});
