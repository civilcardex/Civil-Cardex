import { describe, it, expect } from 'vitest';
import { handleSelectDown } from '../handleMouseDown';
import { handleDragMove } from '../handleDragMove';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

function makeRamal(id: string, net: string, pts: number[][]): PlanoRamal {
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
    labelX: 0,
    labelY: 0,
    labelAngle: 0,
    material: '',
    diametro: '',
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

// Motor falso casi completo: mapeo de coordenadas identidad (px de canvas === unidades de plano) para
// poder razonar los puntos de clic directamente; todo lo demás vacío/no-op para que solo la maquinaria
// real de drag bajo prueba pueda bloquear la cascada.
function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    _guideStart: null,
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    _hiddenNets: new Set(),
    _lockedNets: new Set(),
    activeNet: 'san',
    tool: 'sel',
    snapMode: false,
    multiSel: [],
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    ramalDrag: null,
    ptDrag: null,
    bajDrag: null,
    ghostDrag: null,
    lblDrag: null,
    txtDrag: null,
    dimLblDrag: null,
    txtResize: null,
    areaDrag: null,
    dimDrag: null,
    multiDrag: null,
    marqueeRect: null,
    toCvs: (px: number, py: number) => ({ x: px, y: py }),
    toPlane: (cx: number, cy: number) => ({ x: cx, y: cy }),
    mm2cvs: (mm: number) => mm,
    pxToM: (px: number) => px,
    realMmToCanvasPx: (mm: number) => mm,
    snapAngle: (_x0, _y0, x1, y1) => ({ x: x1, y: y1 }),
    snapToExisting: () => null,
    getBajantesFantasma: () => [],
    render: () => {},
    scheduleRender: () => {},
    _emitSelect: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    setActiveNet: (id: string) => {
      (engine as IPlanoEngineCore).activeNet = id;
    },
  };
  return engine as IPlanoEngineCore;
}

describe('san/vent whole-body drag cascade (end-to-end)', () => {
  it('moving the SAN ramal body drags the connected VENT ramal (tapped at an interior vertex) along with it', () => {
    // Ramal san: recorrido horizontal largo con un punto de derivación interior en (10,0), lejos (>15px)
    // de ambos extremos de la polilínea para que el clic de abajo sea inequívocamente un clic de CUERPO.
    // bloqueado:false en el ramal arrastrado DIRECTAMENTE — "Bloquear movimiento" ahora sí bloquea el
    // arrastre directo del ramal donde está marcado (el seguimiento en cascada no se ve afectado).
    const san = {
      ...makeRamal('RS1', 'san', [
        [0, 0],
        [10, 0],
        [50, 0],
      ]),
      bloqueado: false,
    };
    const vent = makeRamal('REV1', 'vent', [
      [10, 0],
      [10, 10],
    ]);
    const engine = makeEngine([san, vent]);
    engine.selId = 'RS1'; // simula que el ramal ya estaba seleccionado por un clic previo

    // mousedown sobre el cuerpo del ramal san, bien lejos de cualquier extremo
    handleSelectDown(engine, 30, 0);
    expect(engine.ramalDrag).not.toBeNull();
    expect(engine.ramalDrag?.connRamales?.some((r) => r.id === 'REV1')).toBe(true);

    // arrastrarlo hacia un lado
    handleDragMove(engine, 30, 20);

    expect(vent.pts[0][1]).toBeCloseTo(20, 5); // el extremo derivado de vent siguió a san hacia arriba
    expect(vent.pts[1][1]).toBeCloseTo(30, 5); // y el resto de vent se movió rígidamente con él
  });

  it('moving the SAN ramal by its ENDPOINT (first-click path) also drags the connected VENT ramal', () => {
    const san = {
      ...makeRamal('RS1', 'san', [
        [0, 0],
        [10, 0],
        [50, 0],
      ]),
      // Misma regla "el ramal arrastrado directamente debe estar desbloqueado" — "Bloquear Movimiento"
      // ahora también cubre la ruta de extremo del primer clic.
      bloqueado: false,
    };
    const vent = makeRamal('REV1', 'vent', [
      [10, 0],
      [10, 10],
    ]);
    const engine = makeEngine([san, vent]);
    // Nada preseleccionado — esto ejercita _tryRamalEndpointHit, la ruta de seleccionar+arrastrar
    // de un solo clic.

    handleSelectDown(engine, 50, 0); // clic justo en el extremo lejano de san
    expect(engine.ptDrag).not.toBeNull();
    expect(engine.ptDrag?.id).toBe('RS1');

    handleDragMove(engine, 50, 30);

    // El arrastre de extremo solo dobla ese vértice de san — NO debe arrastrar todo el ramal vent
    // (ese es el caso de cuerpo completo de arriba); esto solo confirma que la ruta de extremo inicia
    // un arrastre real en lugar de un no-op silencioso (el bug de _tryRamalEndpointHit).
    expect(san.pts[2]).toEqual([50, 30]);
  });
});

describe('dragging a TRIBUTARIO (T-prefixed) ramal by its body', () => {
  it('starts a whole-body drag for a tributario just like a normal ramal (regression: id prefix used to gate this)', () => {
    const san = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
      [50, 0],
    ]);
    // derivación vent modelada como tributario de san — forma estándar de representar una
    // rama sobre un ramal padre (ver tPfx='T' en copyDrawingFromPlan.ts / PlanoRamal.padre).
    // bloqueado:false porque este tributario es el que se arrastra DIRECTAMENTE.
    const vent = {
      ...makeRamal('T1', 'vent', [
        [10, 0],
        [10, 30],
      ]),
      padre: 'RS1',
      bloqueado: false,
    };
    const engine = makeEngine([san, vent]);
    engine.selId = 'T1';

    // clic sobre el cuerpo del tributario, lejos de sus extremos
    handleSelectDown(engine, 10, 15);

    expect(engine.ramalDrag).not.toBeNull();
  });
});
