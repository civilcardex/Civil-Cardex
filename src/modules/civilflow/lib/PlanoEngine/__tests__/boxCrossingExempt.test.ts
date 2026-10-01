import { describe, it, expect } from 'vitest';
import { handleLineDown, finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore } from '../PlanoState';

// Entrar a la misma caja no es conectar ni cruzar: los trazos que aterrizan en una caja
// (asociados a su centro) no disparan ni la validación de tee contra el vecino
// (checkCrossRamalAngle) ni la alerta de cruce (en vivo y al terminar).

function makeEngine(alerts: string[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
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
    snapMode: false,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 1 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
    cmToCanvasPx: (c) => c,
    toCvs: (x, y) => ({ x, y }),
    toPlane: (x, y) => ({ x, y }),
    realMmToCanvasPx: (mm) => mm,
    mm2cvs: (mm) => mm,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: ((t: string, m: string) => {
      alerts.push(`${t} | ${m}`);
    }) as never,
    triggerAccesorioModal: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
    zoom: 1,
    offX: 0,
    offY: 0,
    multiSel: [],
    snapToExisting: () => null,
    snapAngle: (_x, _y, _px, _py) => ({ x: _px, y: _py }),
    _snapToSegment: () => null,
    _ventFirstSegDir: null,
  };
  return engine as unknown as IPlanoEngineCore;
}

// cmToPlanePx identidad → medio cuadro = 100/2+2 = 52. _circ con r de semidiagonal
// (como la deja renderBajantes en producción) para el radio de asociación.
const caja = () =>
  ({
    id: 'CAN1',
    code: 'CAN1',
    net: 'san',
    tipo: 'caja_san',
    x: 200,
    y: 200,
    recibeDeIds: [],
    alimentaIds: [],
    dNominal: '',
    _circ: { x: 200, y: 200, r: 75 },
  }) as never;

function draw(engine: IPlanoEngineCore, clicks: number[][]) {
  for (const [x, y] of clicks) handleLineDown(engine, x, y);
  finishRamal(engine);
}

describe('entrar a la misma caja no alerta', () => {
  it('segundo trazo a 90° del primero, ambos al centro: sin alerta de tee, fin=CAN1', () => {
    const alerts: string[] = [];
    const engine = makeEngine(alerts);
    engine.bajantes.push(caja());
    draw(engine, [
      [0, 200],
      [200, 200],
    ]);
    expect(alerts).toEqual([]);
    expect(engine.ramales[0].fin).toBe('CAN1');
    handleLineDown(engine, 200, 100);
    handleLineDown(engine, 200, 200);
    expect(alerts).toEqual([]);
    expect(engine.activeRamal?.pts).toHaveLength(2);
    finishRamal(engine);
    expect(alerts).toEqual([]);
    expect(engine.ramales).toHaveLength(2);
    expect(engine.ramales[1].fin).toBe('CAN1');
  });

  it('control sin caja: el mismo segundo trazo sí alerta por tee', () => {
    const alerts: string[] = [];
    const engine = makeEngine(alerts);
    draw(engine, [
      [0, 200],
      [200, 200],
    ]);
    expect(alerts).toEqual([]);
    handleLineDown(engine, 200, 100);
    handleLineDown(engine, 200, 200);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.includes('Ángulo no recomendado'))).toBe(true);
  });

  it('tributario que cruza un ramal dentro del cuadro: sin alerta de cruce, fin=CAN1', () => {
    const alerts: string[] = [];
    const engine = makeEngine(alerts);
    engine.bajantes.push(caja());
    draw(engine, [
      [0, 170],
      [158, 170],
    ]);
    expect(alerts).toEqual([]);
    expect(engine.ramales[0].fin).toBe('CAN1');
    engine.tipoTramo = 'tributario';
    engine.padreTributario = null;
    handleLineDown(engine, 105, 125);
    handleLineDown(engine, 170, 190);
    expect(alerts).toEqual([]);
    finishRamal(engine);
    expect(alerts).toEqual([]);
    expect(engine.ramales).toHaveLength(2);
    expect(engine.ramales[1].fin).toBe('CAN1');
  });

  it('control cruce sin caja: el tributario sí alerta y no se crea', () => {
    const alerts: string[] = [];
    const engine = makeEngine(alerts);
    draw(engine, [
      [0, 170],
      [158, 170],
    ]);
    expect(alerts).toEqual([]);
    engine.tipoTramo = 'tributario';
    engine.padreTributario = null;
    handleLineDown(engine, 105, 125);
    handleLineDown(engine, 170, 190);
    finishRamal(engine);
    expect(alerts.some((a) => a.includes('cruzar'))).toBe(true);
    expect(engine.ramales).toHaveLength(1);
  });
});
