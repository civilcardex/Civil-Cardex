import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
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
    activeNet: 'af',
    tipoTramo: 'ramal',
    padreTributario: null,
    tool: 'line',
    activeRamal: null,
    _ramalDefaults: { material: '', diametro: '', pendiente: 0 },
    _netCounts: {
      af: { ramal: 0, tributario: 0 },
      san: { ramal: 0, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
    },
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    pxToM: (px) => px,
    cmToPlanePx: (c) => c,
    getBajantesFantasma: () => [],
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    triggerAccesorioModal: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: null,
  };
  return engine as IPlanoEngineCore;
}
const mk = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'af',
    tipo: 'ramal',
    padre: null,
    pts: [],
    totalL: 0,
    label: 'R',
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
    bloqueado: true,
    ...o,
  }) as PlanoRamal;

describe('#1 tee no se desplaza al extremo al borrar el brazo', () => {
  it('cuando el brazo borrado lleva la tee, el sobreviviente NO recibe codo nuevo', () => {
    // Host colineal + brazo que carga el marcador tee en su extremo de unión.
    const brazo = mk({
      id: 'B',
      pts: [
        [20, 0],
        [20, 10],
      ],
      accesorioInicio: 'te_linea',
    });
    const host = mk({
      id: 'H',
      pts: [
        [0, 0],
        [20, 0],
      ],
      accesorioFin: '',
    });
    const engine = makeEngine([brazo, host]);
    deleteSelected(engine, ['B']);
    const survivor = engine.ramales.find((r) => r.id === 'H');
    // El punto de unión (20,0) no debe recibir un codo nuevo (no "desplazado al extremo").
    expect(survivor!.accesorioFin).not.toMatch(/codo90rm|codos_90|codo45|codos_45/);
  });
});

describe('#2 tributario splittea tributario', () => {
  it('un tributario que cae a mitad de cuerpo de otro tributario lo divide', () => {
    const tribEx = mk({
      id: 'T1',
      tipo: 'tributario',
      padre: 'P1',
      pts: [
        [0, 0],
        [40, 0],
      ],
    });
    const engine = makeEngine([tribEx]);
    engine.tipoTramo = 'tributario';
    engine.padreTributario = 'P1';
    engine.activeRamal = {
      net: 'af',
      tipo: 'tributario',
      padre: 'P1',
      pts: [
        [20, 30],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    // Debe haberse dividido T1: ahora hay más ramales (el entrante + partes)
    // y ningún tramo conserva el marcador de "padre incorrecto".
    expect(engine.ramales.length).toBeGreaterThanOrEqual(3);
  });
});

describe('#4 borrar una mitad de división borra TODA la división', () => {
  it('borrar la mitad aguas arriba elimina downstream + rama entrante en un solo borrado', () => {
    const upstream = mk({
      id: 'A',
      pts: [
        [0, 0],
        [20, 0],
      ],
      label: 'RAF1',
    });
    const incoming = mk({
      id: 'X',
      pts: [
        [20, 10],
        [20, 0],
      ],
      label: 'RAF2',
    });
    const downstream = mk({
      id: 'D',
      pts: [
        [20, 0],
        [40, 0],
      ],
      label: 'RAF3',
      mergesFrom: ['A', 'X'],
    });
    const engine = makeEngine([upstream, incoming, downstream]);
    deleteSelected(engine, ['A']);
    // No deben quedar restos de la división (D y X se eliminan junto con A)
    expect(engine.ramales.some((r) => ['D', 'X'].includes(r.id))).toBe(false);
    expect(engine.ramales).toHaveLength(0);
  });
  it('borrar la mitad aguas abajo elimina upstream + rama entrante', () => {
    const upstream = mk({
      id: 'A',
      pts: [
        [0, 0],
        [20, 0],
      ],
      label: 'RAF1',
    });
    const incoming = mk({
      id: 'X',
      pts: [
        [20, 10],
        [20, 0],
      ],
      label: 'RAF2',
    });
    const downstream = mk({
      id: 'D',
      pts: [
        [20, 0],
        [40, 0],
      ],
      label: 'RAF3',
      mergesFrom: ['A', 'X'],
    });
    const engine = makeEngine([upstream, incoming, downstream]);
    deleteSelected(engine, ['D']);
    expect(engine.ramales.some((r) => ['A', 'X'].includes(r.id))).toBe(false);
    expect(engine.ramales).toHaveLength(0);
  });
});
