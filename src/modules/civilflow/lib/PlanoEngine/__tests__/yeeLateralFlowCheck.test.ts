import { describe, it, expect } from 'vitest';
import { ramalFlowDirectionCheck } from '../drawingFlow';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
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
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    _renumberRamales: () => {},
    _loadedPlanId: null,
    zoom: 1,
    offX: 0,
    offY: 0,
    multiSel: [],
  };
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
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

describe('yee lateral — validación de flujo (orig. usuario #3)', () => {
  it('un brazo lateral RAMAL en contra del flujo del tronco SÍ se valida (error)', () => {
    // Tronco horizontal: RS1 (0,0)-(40,0), RS2 continúa (40,0)-(80,0)
    const troncoA = R({
      id: 'RS1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const troncoB = R({
      id: 'RS2',
      pts: [
        [40, 0],
        [80, 0],
      ],
    });
    // Brazo lateral en 45° tipo RAMAL: [[40,0],[35,10]] — llega al tronco fluyendo hacia atrás
    const brazo = R({
      id: 'RS3',
      tipo: 'ramal',
      pts: [
        [40, 0],
        [35, 10],
      ],
    });
    const engine = makeEngine([troncoA, troncoB, brazo]);
    const err = ramalFlowDirectionCheck(engine, brazo, [], 0.5);
    expect(err).toBeTruthy();
  });

  it('brazo lateral TRIBUTARIO dibujado desde la unión: alerta de dirección (tributario↔ramal)', () => {
    const troncoA = R({
      id: 'RS1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const troncoB = R({
      id: 'RS2',
      pts: [
        [40, 0],
        [80, 0],
      ],
    });
    const brazo = R({
      id: 'T1',
      tipo: 'tributario',
      pts: [
        [40, 0],
        [35, 10],
      ],
      padre: 'RS1',
    });
    const engine = makeEngine([troncoA, troncoB, brazo]);
    // Regla vigente (orig. usuario): el tributario debe LLEGAR con su destino a la unión.
    // Dibujado desde la unión hacia el aparato (drena desde el tronco) → alerta.
    const err = ramalFlowDirectionCheck(engine, brazo, [], 0.5);
    expect(err).toContain('El tributario que se conecta');
    expect(err).toContain('ramal principal');
  });

  it('ramal simple conectado al tronco (2 ramales en el punto) SÍ valida dirección', () => {
    const troncoA = R({
      id: 'RS1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    // ramal que termina en (40,0) fluyendo en contra (de derecha a izquierda)
    const ramal = R({
      id: 'RS2',
      pts: [
        [60, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([troncoA, ramal]);
    // 2 ramales en el punto → se valida; flujo opuesto al tronco → error esperado
    const err = ramalFlowDirectionCheck(engine, ramal, [], 0.5);
    expect(err).toBeTruthy();
  });
});
