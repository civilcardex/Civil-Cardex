import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deleteSelected } from '../deleteSelected';
import { _renumberRamales } from '../networkRenumber';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Mock localStorage global (node no lo tiene)
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
} as unknown as Storage;

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
      san: { ramal: 3, tributario: 0 },
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
    triggerAccesorioModal: () => {},
    _renumberRamales: (net: string) => _renumberRamales(engine as IPlanoEngineCore, net),
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    _loadedPlanId: 'planA',
    zoom: 1,
    offX: 0,
    offY: 0,
    pxToM: (px: number) => px,
    toCvs: (x: number, y: number) => ({ x, y }),
    multiSel: [],
    snapToExisting: () => null,
    snapAngle: (_x, _y, _px, _py) => ({ x: _px, y: _py }),
    _snapToSegment: () => null,
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
      [10, 0],
    ],
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

describe('persistencia aparatos al borrar + renumerar (orig. #8)', () => {
  beforeEach(() => store.clear());
  afterEach(() => store.clear());

  it('renumerar migra las claves de aparatos de los ramales sobrevivientes', () => {
    // RS1, RS2, RS3 con aparatos cada uno
    store.set(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({
        san_RS1_planA: { lvm: 1 },
        san_RS2_planA: { san: 1 },
        san_RS3_planA: { duc: 1 },
      }),
    );
    const engine = makeEngine([
      R({ id: 'RS1', label: 'RS1', fixtures: { lvm: 1 } }),
      R({ id: 'RS2', label: 'RS2', fixtures: { san: 1 } }),
      R({ id: 'RS3', label: 'RS3', fixtures: { duc: 1 } }),
    ]);
    // Borrar RS2 (del medio) → renumerar RS3→RS2
    deleteSelected(engine, ['RS2']);
    const data = JSON.parse(store.get('civilflow_aparatos_by_tramo_v2') || '{}') as Record<
      string,
      unknown
    >;
    // RS1 mantiene su aparato
    expect(data['san_RS1_planA']).toEqual({ lvm: 1 });
    // RS3 (renumerado a RS2) mantiene su aparato (duc)
    expect(data['san_RS2_planA']).toEqual({ duc: 1 });
    // La clave vieja de RS3 desapareció
    expect(data['san_RS3_planA']).toBeUndefined();
    // RS2 borrado: su clave (san) se limpió, no quedó huérfana
    expect(Object.keys(data).some((k) => k.includes('RS2') && k !== 'san_RS2_planA')).toBe(false);
  });

  it('el objeto en memoria conserva fixtures al renumerar', () => {
    const engine = makeEngine([
      R({ id: 'RS1', label: 'RS1', fixtures: { lvm: 1 } }),
      R({ id: 'RS2', label: 'RS2', fixtures: { san: 1 } }),
      R({ id: 'RS3', label: 'RS3', fixtures: { duc: 1 } }),
    ]);
    deleteSelected(engine, ['RS2']);
    const rs1 = engine.ramales.find((r) => r.id === 'RS1');
    const rs2 = engine.ramales.find((r) => r.id === 'RS2'); // era RS3
    expect(rs1?.fixtures).toEqual({ lvm: 1 });
    expect(rs2?.fixtures).toEqual({ duc: 1 });
  });

  it('borrar el PRIMER ramal (RS1) migra claves y conserva aparatos de los demás', () => {
    store.set(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({
        san_RS1_planA: { lvm: 1 },
        san_RS2_planA: { san: 1 },
        san_RS3_planA: { duc: 1 },
      }),
    );
    const engine = makeEngine([
      R({ id: 'RS1', label: 'RS1', fixtures: { lvm: 1 } }),
      R({ id: 'RS2', label: 'RS2', fixtures: { san: 1 } }),
      R({ id: 'RS3', label: 'RS3', fixtures: { duc: 1 } }),
    ]);
    deleteSelected(engine, ['RS1']);
    const data = JSON.parse(store.get('civilflow_aparatos_by_tramo_v2') || '{}') as Record<
      string,
      unknown
    >;
    // RS2 renumerado a RS1 conserva san; RS3 renumerado a RS2 conserva duc
    expect(data['san_RS1_planA']).toEqual({ san: 1 });
    expect(data['san_RS2_planA']).toEqual({ duc: 1 });
    expect(data['san_RS3_planA']).toBeUndefined();
  });

  it('borrar el divisor de un split (remerge) fusiona fixtures en el ramal re-unido', () => {
    // A: [[0,0],[40,0]], divisor B tributario en (20,0), downstream D: [[20,0],[60,0]] con
    // mergesFrom [A, B] y fixtures. Borrar B → A y D se re-únen conservando fixtures.
    const a = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [20, 0],
      ],
    });
    const b = R({
      id: 'T1',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [20, 0],
        [20, 15],
      ],
    });
    const d = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [20, 0],
        [60, 0],
      ],
      mergesFrom: ['RS1', 'T1'] as [string, string],
      fixtures: { duc: 1 },
    });
    const engine = makeEngine([a, b, d]);
    deleteSelected(engine, ['T1']);
    const survivor = engine.ramales.find((r) => r.id === 'RS1') || engine.ramales[0];
    expect(survivor.pts[0]).toEqual([0, 0]);
    expect(survivor.pts[survivor.pts.length - 1]).toEqual([60, 0]);
    expect(survivor.fixtures?.duc).toBe(1);
  });
});
