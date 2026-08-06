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

function makeBajante(
  id: string,
  net: string,
  x: number,
  y: number,
  recibeDeIds: string[],
): PlanoBajante {
  return {
    id,
    net,
    tipo: 'bajante',
    code: id,
    x,
    y,
    // Mantenido lejos de (x,y) para que un clic sobre el círculo del test de abajo no coincida también
    // con la comprobación de proximidad de etiqueta en _tryBajanteHit (que corre primero y robaría el
    // clic hacia un arrastre de etiqueta en vez del arrastre de símbolo/círculo que busca este test).
    labelX: x + 500,
    labelY: y + 500,
    labelAngle: 0,
    recibeDeIds,
    alimentaIds: [],
    descargaEnId: null,
    dNominal: '',
    direccion: 'baja',
    _circ: { x, y, r: 8 },
  } as unknown as PlanoBajante;
}

// Reproduce la topología real exacta reportada: un ramal 'vent' (REV1) cuyo extremo queda sobre
// un bajante 'san' (BAN1), no sobre otro ramal — la conexión san/vent es vía bajante, no un punto
// compartido entre ramales, caso que ninguno de los tests ramal-a-ramal anteriores cubría.
function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]): IPlanoEngineCore {
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
    _loadedPlanId: 'plan1',
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

describe('bajante <-> ramal lock (san bajante with a vent ramal touching its endpoint)', () => {
  it('dragging the SAN bajante drags the connected VENT ramal endpoint along with it', () => {
    const vent = makeRamal('REV1', 'vent', [
      [10, 0],
      [10, -20],
    ]);
    const baj = makeBajante('BAN1', 'san', 10, 0, ['REV1']);
    const engine = makeEngine([vent], [baj]);

    // clic directo sobre el símbolo del bajante
    handleSelectDown(engine, 10, 0);
    expect(engine.bajDrag).not.toBeNull();

    handleDragMove(engine, 30, 15);

    expect(baj.x).toBeCloseTo(30, 5);
    expect(baj.y).toBeCloseTo(15, 5);
    // el extremo tocante del ramal vent debe haber seguido rígidamente
    expect(vent.pts[0][0]).toBeCloseTo(30, 5);
    expect(vent.pts[0][1]).toBeCloseTo(15, 5);
  });
});
