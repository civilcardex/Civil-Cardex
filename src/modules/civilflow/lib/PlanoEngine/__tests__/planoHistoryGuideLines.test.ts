import { describe, it, expect, beforeEach } from 'vitest';
import { PlanoHistory } from '../PlanoHistory';
import type { IPlanoEngineCore } from '../PlanoState';

// Regresión: el historial de undo/redo no incluía guideLines — deshacer/rehacer no afectaba la
// línea guía (crearla, moverla o convertirla quedaba fuera del historial). El snapshot ahora
// captura/restaura guideLines junto con ramales/bajantes/etc.

function makeEngine(): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    crossFloorGhosts: [],
    selId: null,
    _isGhostSel: false,
    _yeeFlashKey: null,
    _loadedPlanId: undefined,
    _netCounts: {},
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    activeRamal: null,
    activeArea: null,
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _emitSelect: () => {},
    _emitDelete: () => {},
    render: () => {},
    _markDirty: () => {},
    _statusMsg: () => '',
    _emitStatus: () => {},
    pxToM: (px: number) => px / 4,
    _onDirtyCb: undefined,
  };
  return engine as IPlanoEngineCore;
}

describe('PlanoHistory — guideLines en undo/redo', () => {
  let engine: IPlanoEngineCore;
  let history: PlanoHistory;

  beforeEach(() => {
    engine = makeEngine();
    history = new PlanoHistory(engine);
    // Estado base (vacío) — saveSnapshot al arrancar.
    history.saveSnapshot();
  });

  it('undo restaura la línea guía creada (crearla queda en el historial)', () => {
    engine.guideLines.push({
      id: 'GL1',
      net: 'af',
      pts: [
        [0, 0],
        [10, 10],
      ],
    });
    history.saveSnapshot();

    expect(engine.guideLines.length).toBe(1);
    history.undoLast();
    expect(engine.guideLines.length).toBe(0);
    history.redoLast();
    expect(engine.guideLines.length).toBe(1);
    expect(engine.guideLines[0].pts).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });

  it('undo restaura la POSICIÓN previa de una guía movida (drag)', () => {
    engine.guideLines.push({
      id: 'GL1',
      net: 'af',
      pts: [
        [0, 0],
        [10, 10],
      ],
    });
    history.saveSnapshot();

    engine.guideLines[0].pts = [
      [5, 5],
      [15, 15],
    ];
    history.saveSnapshot();

    history.undoLast();
    expect(engine.guideLines[0].pts).toEqual([
      [0, 0],
      [10, 10],
    ]);
    history.redoLast();
    expect(engine.guideLines[0].pts).toEqual([
      [5, 5],
      [15, 15],
    ]);
  });

  it('undo restaura la guía borrada al convertirla en tributario', () => {
    engine.guideLines.push({
      id: 'GL1',
      net: 'af',
      pts: [
        [0, 0],
        [10, 10],
      ],
    });
    history.saveSnapshot();

    // Conversión: se quita la guía y aparece el ramal.
    engine.guideLines = [];
    engine.ramales.push({
      id: 'RAF1',
      net: 'af',
      tipo: 'ramal',
      padre: null,
      pts: [
        [0, 0],
        [10, 10],
      ],
      totalL: 0,
      label: 'RAF1',
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
      bloqueado: false,
    } as IPlanoEngineCore['ramales'][number]);
    history.saveSnapshot();

    history.undoLast();
    expect(engine.guideLines.length).toBe(1);
    expect(engine.ramales.length).toBe(0);
    history.redoLast();
    expect(engine.guideLines.length).toBe(0);
    expect(engine.ramales.length).toBe(1);
  });

  it('clearAll también limpia guideLines', () => {
    engine.guideLines.push({
      id: 'GL1',
      net: 'af',
      pts: [
        [0, 0],
        [10, 10],
      ],
    });
    history.saveSnapshot();
    history.clearAll();
    expect(engine.guideLines.length).toBe(0);
  });
});
