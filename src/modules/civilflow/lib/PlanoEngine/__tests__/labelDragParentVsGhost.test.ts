import { describe, it, expect } from 'vitest';
import { handleDragMove } from '../handleDragMove';
import { hitTestBajanteLabelForDrag } from '../PlanoEngineHitTesting';
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState';

// Cobertura de regresión para el bug "la etiqueta del ghost se mueve en vez de seleccionar al padre":
// hacer clic en la etiqueta del bajante PADRE mientras estaba seleccionado un bajante GHOST desplazado
// en el mismo piso arrastraba la etiqueta desplazada del ghost hasta donde se hizo clic en la del padre.
// Causa raíz doble: (1) hitTestBajanteLabelForDrag siempre ganaba para la etiqueta del bajante
// actualmente seleccionado aunque la de un bajante vecino estuviera genuinamente más cerca del clic, y
// (2) el objetivo de handleDragMove (labelX/Y real vs. ghostData[piso].labelX/Y) lo decidía un flag
// `_lblDragIsParent` que una ruta de bypass dejaba obsoleto de la INTERACCIÓN ANTERIOR.

function makeBajante(
  id: string,
  x: number,
  y: number,
  labelX: number,
  labelY: number,
): PlanoBajante {
  return {
    id,
    net: 'san',
    tipo: 'bajante',
    code: id,
    x,
    y,
    labelX,
    labelY,
    labelAngle: 0,
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    dNominal: '',
    direccion: 'baja',
    _circ: { x, y, r: 8 },
  } as unknown as PlanoBajante;
}

function makeEngine(bajantes: PlanoBajante[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    selectedGhostId: null,
    _isGhostSel: false,
    activeNet: 'san',
    tool: 'sel',
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    lblDrag: null,
    ramalDrag: null,
    ptDrag: null,
    bajDrag: null,
    ghostDrag: null,
    txtDrag: null,
    dimLblDrag: null,
    txtResize: null,
    areaDrag: null,
    dimDrag: null,
    multiDrag: null,
    marqueeRect: null,
    toCvs: (px: number, py: number) => ({ x: px, y: py }),
    toPlane: (cx: number, cy: number) => ({ x: cx, y: cy }),
    scheduleRender: () => {},
    render: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('hitTestBajanteLabelForDrag — only wins when genuinely closest', () => {
  it('returns the selected bajante label when no neighbor is closer', () => {
    const a = makeBajante('BAN1', 0, 0, 0, 20);
    const b = makeBajante('BAN2', 200, 200, 200, 220);
    const engine = makeEngine([a, b]);
    engine.selId = 'BAN1';

    const hit = hitTestBajanteLabelForDrag(engine, 0, 20);

    expect(hit?.id).toBe('BAN1');
  });

  it('bails out (returns null) when a neighboring bajante label is genuinely closer to the click', () => {
    const parent = makeBajante('BAN1', 0, 0, 0, 20); // etiqueta del bajante seleccionado en (0,20)
    const neighbor = makeBajante('BAN2', 5, 0, 5, 21); // la etiqueta del vecino queda casi encima del clic
    const engine = makeEngine([parent, neighbor]);
    engine.selId = 'BAN1';

    // Clic mucho más cerca de la etiqueta de BAN2 (5,21) que de la propia de BAN1 (0,20).
    const hit = hitTestBajanteLabelForDrag(engine, 5, 21);

    expect(hit).toBeNull();
  });
});

describe('handleDragMove label target — _lblDragIsParent selects real vs. ghost position', () => {
  it('writes to the real labelX/labelY when _lblDragIsParent is true', () => {
    const baj = makeBajante('BAN1', 0, 0, 0, 0);
    const engine = makeEngine([baj]);
    engine.lblDrag = { id: 'BAN1', offX: 0, offY: 0 };
    engine._lblDragIsParent = true;

    handleDragMove(engine, 50, 50);

    expect(baj.labelX).toBeCloseTo(50, 5);
    expect(baj.labelY).toBeCloseTo(50, 5);
    expect(baj.ghostData?.P1).toBeUndefined();
  });

  it('writes to ghostData[floor] instead of labelX/labelY when _lblDragIsParent is false', () => {
    const baj = makeBajante('BAN1', 0, 0, 0, 0);
    const engine = makeEngine([baj]);
    engine.lblDrag = { id: 'BAN1', offX: 0, offY: 0 };
    engine._lblDragIsParent = false;

    handleDragMove(engine, 50, 50);

    expect(baj.ghostData?.P1?.labelX).toBeCloseTo(50, 5);
    expect(baj.ghostData?.P1?.labelY).toBeCloseTo(50, 5);
    // La posición de la etiqueta real (padre) debe quedar intacta — este es exactamente el bug:
    // un `_lblDragIsParent` obsoleto hacía que esta rama escribiera en los campos del objetivo equivocado.
    expect(baj.labelX).toBe(0);
    expect(baj.labelY).toBe(0);
  });
});
