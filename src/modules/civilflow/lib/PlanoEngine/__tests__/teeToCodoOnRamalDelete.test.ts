import { describe, it, expect } from 'vitest';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal, PlanoBajante } from '../PlanoState';

// Ítem 6: al borrar el ramal que dejaba una tee (af/ac/gas), la esquina de los dos ramales
// sobrevivientes debe recibir el codo horizontal automático (codo90rm / codos_90_std) — antes
// quedaba sin símbolo ni conteo. Ver assignCodoAfterBranchDelete en deleteSelected.ts.

function makeRamal(
  id: string,
  net: string,
  pts: number[][],
  overrides: Partial<PlanoRamal> = {},
): PlanoRamal {
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
    bloqueado: false,
    ...overrides,
  } as PlanoRamal;
}

function makeBajante(id: string, x: number, y: number): PlanoBajante {
  return {
    id,
    net: 'af',
    tipo: 'bajante',
    code: id,
    x,
    y,
    labelX: x,
    labelY: y + 20,
    labelAngle: 0,
    recibeDeIds: [],
    alimentaIds: [],
    descargaEnId: null,
    origenId: null,
    dNominal: '',
    direccion: 'baja',
    _circ: { x, y, r: 8 },
  } as unknown as PlanoBajante;
}

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    dims: [],
    textAnnots: [],
    areas: [],
    guideLines: [],
    crossFloorGhosts: [],
    selId: null,
    _isGhostSel: false,
    _yeeFlashKey: null,
    _loadedPlanId: undefined,
    nivelActual: { label: 'P1', n: 1, npt: 0 } as unknown as IPlanoEngineCore['nivelActual'],
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _emitSelect: () => {},
    _emitDelete: () => {},
    render: () => {},
    _markDirty: () => {},
  };
  return engine as IPlanoEngineCore;
}

describe('deleteSelected — tee branch deletion converts the corner into an elbow', () => {
  it('writes codo90rm on the survivor when a tee branch is deleted (L corner)', () => {
    // Tee en (0,0): rama derecha RAF1 (0,0)→(10,0), rama izquierda RAF2 (-10,0)→(0,0) BORRADA,
    // rama arriba RAF3 (0,-10)→(0,0). Al borrar RAF2 queda esquina en L (derecha+arriba).
    const right = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const branch = makeRamal('RAF2', 'af', [
      [-10, 0],
      [0, 0],
    ]);
    const up = makeRamal('RAF3', 'af', [
      [0, -10],
      [0, 0],
    ]);
    // La unión era una tee MANUAL resuelta por el usuario (modal) — el downgrade tee→codo solo
    // aplica cuando existía un marcador de tee antes del borrado.
    right.accesorioInicio = 'teeSube';
    const engine = makeEngine([right, branch, up], []);

    deleteSelected(engine, ['RAF2']);

    expect(engine.ramales.map((r) => r.id).sort()).toEqual(['RAF1', 'RAF3']);
    const hosts = engine.ramales.filter((r) => r.accesorioInicio === 'codo90rm');
    // Un solo codo (nada de doble conteo) y en el extremo que toca el punto (0,0).
    expect(hosts.length).toBe(1);
    expect(hosts[0].pts?.[0]).toEqual([0, 0]);
  });

  it('writes codos_90_std for gas networks', () => {
    const right = makeRamal('RG1', 'gas', [
      [0, 0],
      [10, 0],
    ]);
    const branch = makeRamal('RG2', 'gas', [
      [-10, 0],
      [0, 0],
    ]);
    const up = makeRamal('RG3', 'gas', [
      [0, -10],
      [0, 0],
    ]);
    right.accesorioInicio = 'teeSube';
    const engine = makeEngine([right, branch, up], []);

    deleteSelected(engine, ['RG2']);

    expect(
      engine.ramales.some(
        (r) => r.accesorioInicio === 'codos_90_std' || r.accesorioFin === 'codos_90_std',
      ),
    ).toBe(true);
  });

  it('does NOT write an elbow when the surviving pair is collinear (straight pass)', () => {
    // RAF2 (0,0)→(0,10) era la rama de una tee sobre el tronco dividido RAF1 (0,0)→(10,0)
    // y RAF3 (-10,0)→(0,0): al borrar la rama quedan dos colineales = paso recto.
    const left = makeRamal('RAF3', 'af', [
      [-10, 0],
      [0, 0],
    ]);
    const branch = makeRamal('RAF2', 'af', [
      [0, 0],
      [0, 10],
    ]);
    const right = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const engine = makeEngine([left, branch, right], []);

    deleteSelected(engine, ['RAF2']);

    expect(engine.ramales.every((r) => !r.accesorioInicio && !r.accesorioFin)).toBe(true);
  });

  it('does NOT write an elbow when a bajante sits at the corner', () => {
    const trunk = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const branch = makeRamal('RAF2', 'af', [
      [0, 0],
      [0, 10],
    ]);
    const corner = makeRamal('RAF3', 'af', [
      [-10, 0],
      [0, 0],
    ]);
    const bajante = makeBajante('B1', 0, 0);
    const engine = makeEngine([trunk, branch, corner], [bajante]);

    deleteSelected(engine, ['RAF2']);

    expect(engine.ramales.every((r) => !r.accesorioInicio && !r.accesorioFin)).toBe(true);
  });

  it('does NOT touch san/ll corners (geometric networks)', () => {
    const trunk = makeRamal('RS1', 'san', [
      [0, 0],
      [10, 0],
    ]);
    const branch = makeRamal('RS2', 'san', [
      [0, 0],
      [0, 10],
    ]);
    const corner = makeRamal('RS3', 'san', [
      [-10, 0],
      [0, 0],
    ]);
    const engine = makeEngine([trunk, branch, corner], []);

    deleteSelected(engine, ['RS2']);

    expect(engine.ramales.every((r) => !r.accesorioInicio && !r.accesorioFin)).toBe(true);
  });

  it('unión de guía (sin tee previa): al borrar el tributario NO se escribe codo', () => {
    const trunk = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const trib = makeRamal(
      'T1',
      'af',
      [
        [10, -10],
        [10, 0],
      ],
      { tipo: 'tributario', padre: 'RAF1' },
    );
    const engine = makeEngine([trunk, trib], []);

    deleteSelected(engine, ['T1']);

    expect(engine.ramales.every((r) => !r.accesorioInicio && !r.accesorioFin)).toBe(true);
  });

  it('codo de plano LEGADO (persistido por código viejo) se limpia al borrar el tributario de la guía', () => {
    const trunk = makeRamal(
      'RAF1',
      'af',
      [
        [0, 0],
        [10, 0],
      ],
      { accesorioFin: 'codo90rm' },
    );
    const trib = makeRamal(
      'T1',
      'af',
      [
        [10, -10],
        [10, 0],
      ],
      { tipo: 'tributario', padre: 'RAF1' },
    );
    const engine = makeEngine([trunk, trib], []);

    deleteSelected(engine, ['T1']);

    expect(trunk.accesorioFin).toBe('');
  });

  it('unión de guía con DOS tributarios: borrar uno deja codo en la L, borrar el otro lo limpia', () => {
    const trunk = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const tribN = makeRamal(
      'T1',
      'af',
      [
        [10, -10],
        [10, 0],
      ],
      { tipo: 'tributario', padre: 'RAF1' },
    );
    const tribS = makeRamal(
      'T2',
      'af',
      [
        [10, 0],
        [10, 10],
      ],
      { tipo: 'tributario', padre: 'RAF1' },
    );
    const engine = makeEngine([trunk, tribN, tribS], []);

    deleteSelected(engine, ['T2']);

    // Queda esquina en L (tronco + T1) → codo de plano en el tronco (arco de segmentos).
    expect(trunk.accesorioFin).toBe('codo90rm');

    deleteSelected(engine, ['T1']);

    // Extremo muerto → sin símbolo ni conteo.
    expect(trunk.accesorioFin).toBe('');
  });

  it('does not overwrite an existing accessory at the corner', () => {
    const trunk = makeRamal('RAF1', 'af', [
      [0, 0],
      [10, 0],
    ]);
    const branch = makeRamal('RAF2', 'af', [
      [0, 0],
      [0, 10],
    ]);
    const corner = makeRamal(
      'RAF3',
      'af',
      [
        [-10, 0],
        [0, 0],
      ],
      { accesorioInicio: 'yeeSimple' },
    );
    const engine = makeEngine([trunk, branch, corner], []);

    deleteSelected(engine, ['RAF2']);

    expect(corner.accesorioInicio).toBe('yeeSimple');
  });
});
