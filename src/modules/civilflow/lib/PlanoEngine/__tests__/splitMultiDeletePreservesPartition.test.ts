import { describe, it, expect } from 'vitest';
import { finishRamal } from '../PlanoEngineDrawing';
import { deleteSelected } from '../deleteSelected';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Regresión: borrar la PRIMERA partición de un ramal dividido sucesivamente debe conservar la
// partición posterior (RS1|RS2|RS3 → borrar divisor A → RS1 | RS2, NO todo en un solo RS1).

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
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [40, 0],
    ],
    totalL: 0,
    label: o.id || 'RS1',
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

describe('split múltiple — borrar primera partición conserva la posterior', () => {
  it('RS1|RS2|RS3 → borrar divisor A deja RS1 | (RS3+RS2) sin solapamiento', () => {
    const engine = makeEngine([R({ id: 'RS1' })]);
    engine.tipoTramo = 'ramal';
    // Divisor A en x=20 → RS1[0,20] + RS2[20,40]
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [20, 40],
        [20, 0],
      ],
    } as never;
    finishRamal(engine);
    // Divisor B en x=10 sobre RS1[0,20] → RS1[0,10] + RS3[10,20]
    engine.activeRamal = {
      net: 'san',
      tipo: 'ramal',
      padre: null,
      pts: [
        [10, 40],
        [10, 0],
      ],
    } as never;
    finishRamal(engine);

    const sanRamales = engine.ramales.filter((r) => r.net === 'san');
    // RS1 + RS3 + RS2 + 2 divisores
    expect(sanRamales.length).toBe(5);

    const divisorA = engine.ramales.find(
      (r) => r.pts[0][1] === 40 && Math.abs(r.pts[1][0] - 20) < 0.5,
    );
    expect(divisorA).toBeDefined();

    // borrar divisor A
    deleteSelected(engine, [divisorA!.id]);

    const restantes = engine.ramales.filter((r) => r.net === 'san' && r.tipo !== 'tributario');
    // RS1[0,10] + (RS3+RS2)[10,40] + divisor B → 3 ramales
    expect(restantes.length).toBe(3);

    // Debe conservar la partición en x=10: un segmento termina en 10 y otro empieza en 10,
    // sin solapamiento (la línea completa [0,40] NO debe ser un solo ramal de 3 pts).
    const starts = restantes.map((r) => r.pts[0]);
    const ends = restantes.map((r) => r.pts[r.pts.length - 1]);
    const hasTenBoundary =
      ends.some((p) => Math.abs(p[0] - 10) < 0.5) && starts.some((p) => Math.abs(p[0] - 10) < 0.5);
    expect(hasTenBoundary).toBe(true);
    // Ningún ramal con 3 pts consecutivos [0,40] (no re-colapsado a un solo trazo)
    const spansWhole = restantes.some(
      (r) =>
        r.pts.length >= 3 &&
        Math.abs(r.pts[0][0] - 0) < 0.5 &&
        Math.abs(r.pts[r.pts.length - 1][0] - 40) < 0.5,
    );
    expect(spansWhole).toBe(false);
  });
});
