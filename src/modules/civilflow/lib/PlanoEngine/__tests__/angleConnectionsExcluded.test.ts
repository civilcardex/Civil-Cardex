import { describe, it, expect } from 'vitest';
import { checkRamalAnglesExcludingConnections, finishRamal } from '../PlanoEngineDrawing';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const calls: string[] = [];
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
    snapMode: true,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      san: { ramal: 1, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px: number) => px,
    cmToPlanePx: (c: number) => c,
    toCvs: (x: number, y: number) => ({ x, y }),
    toPlane: (x: number, y: number) => ({ x, y }),
    realMmToCanvasPx: (mm: number) => mm,
    mm2cvs: (mm: number) => mm,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: (t: string) => calls.push('alert:' + t),
    triggerAccesorioModal: () => calls.push('modal'),
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
    snapAngle: (_x: number, _y: number, _px: number, _py: number) => ({ x: _px, y: _py }),
    _snapToSegment: () => null,
  };
  (engine as unknown as { calls: string[] }).calls = calls;
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'P1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [],
    totalL: 0,
    label: 'RS1',
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
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

describe('Bug #7 — ángulos: segmento de conexión no se valida', () => {
  it('ramal multipunto cuyo extremo toca otro ramal existente con ángulo libre pasa sin alerta', () => {
    const padre = R({
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([padre]);
    // El ramal nuevo: horizontal 0° luego sube en ángulo 30° (no múltiplo de 45) para
    // conectarse al padre. El segmento de conexión (30°) NO debe validarse.
    const nuevo: PlanoRamal = R({
      id: 'RS2',
      pts: [
        [20, 30],
        [20, 10],
        [20, 0],
      ],
    });
    expect(checkRamalAnglesExcludingConnections(engine, nuevo)).toBe(true);
  });

  it('ramal libre (sin conexión) con ángulo inválido SÍ se bloquea', () => {
    const engine = makeEngine([]);
    const libre: PlanoRamal = R({
      id: 'RS1',
      pts: [
        [0, 0],
        [10, 0],
        [17.07, 10],
      ],
    });
    // Segmento final a ~55° no es múltiplo de 45 y no toca nada → inválido
    expect(checkRamalAnglesExcludingConnections(engine, libre)).toBe(false);
  });

  it('finishRamal no dispara alerta de ángulo al conectar a ramal existente', () => {
    const padre = R({
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([padre]);
    const calls = (engine as unknown as { calls: string[] }).calls;
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 30],
        [20, 10],
        [20, 0],
      ],
      totalL: 0,
    } as never;
    finishRamal(engine);
    expect(calls.some((c) => c.includes('Ángulo'))).toBe(false);
  });
});
