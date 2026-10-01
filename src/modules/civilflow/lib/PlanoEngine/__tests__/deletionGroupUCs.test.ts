import { describe, expect, it, beforeEach } from 'vitest';
import { deleteSelected as _deleteSelected } from '../deleteSelected';
import { applyBajanteAssociation } from '../../../utils/bajanteAssociation';
import { loadFromStorage } from '../../../services/storageService';
import { APARATOS_BY_TRAMO_KEY } from '../../../constants/storage-keys';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

function makeEngine(ramales: PlanoRamal[], bajantes: PlanoBajante[] = []): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes,
    textAnnots: [],
    areas: [],
    guideLines: [],
    crossFloorGhosts: [],
    dims: [],
    selId: null,
    activeNet: 'san',
    zoom: 1,
    _loadedPlanId: 1,
    _hiddenNets: new Set(),
    _netCounts: {
      san: { ramal: 5, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
      af: { ramal: 0, tributario: 0 },
      ac: { ramal: 0, tributario: 0 },
      gas: { ramal: 0, tributario: 0 },
      vent: { ramal: 0, tributario: 0 },
      rci: { ramal: 0, tributario: 0 },
    },
    toPlane: (x, y) => ({ x, y }),
    toCvs: (x, y) => ({ x, y }),
    pxToM: (px: number) => px,
    render: () => {},
    _markDirty: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberMontantes: () => {},
    _renumberAreas: () => {},
    updateElementById: () => {},
    deleteSelected: function (ids?: string[], opts?: { noMerge?: boolean }) {
      _deleteSelected(this as unknown as IPlanoEngineCore, ids, opts);
    },
  };
  return engine as IPlanoEngineCore;
}
const R = (o: Partial<PlanoRamal>): PlanoRamal =>
  ({
    id: 'R',
    net: 'san',
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
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
    diametro: '2"',
    pendiente: 2,
    bloqueado: false,
    ...o,
  }) as PlanoRamal;

/* ── 1. Borrado en conjunto arrastra conectados ── */
describe('borrado en conjunto con conectados', () => {
  beforeEach(() => localStorage.clear());

  it('seleccionado con tributario colgante + ramal encadenado: todos caen', () => {
    // Cadena: RS2 (seleccionado) ← RS1 (seleccionado) con T1 colgando; RS4 continúa RS2.
    const t1 = R({
      id: 'T1',
      tipo: 'tributario',
      padre: 'RS1',
      pts: [
        [20, -10],
        [20, 0],
      ],
    });
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [20, 0],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [20, 0],
        [40, 0],
      ],
    });
    const rs4 = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [40, 0],
        [60, 0],
      ],
    });
    const aislado = R({
      id: 'RS9',
      label: 'RS9',
      pts: [
        [200, 200],
        [210, 200],
      ],
    });
    const eng = makeEngine([rs1, rs2, rs4, t1, aislado]);
    eng.deleteSelected(['RS1', 'RS2']);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS9']);
  });

  it('laterales de un mismo bajante NO se arrastran entre sí', () => {
    // RS1 y RS2 llegan al MISMO bajante (no conectados entre sí): borrar RS1 deja RS2.
    const rs1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [0, 0],
        [10, 0],
      ],
    });
    const rs2 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [30, 0],
        [40, 0],
      ],
    });
    const baj: PlanoBajante = {
      id: 'B1',
      net: 'san',
      tipo: 'bajante',
      code: 'BAN1',
      x: 10,
      y: 0,
      pisoBase: 'P1',
      pisoCima: 'P1',
      nptBase: 0,
      nptCima: 0,
      hVert: 0,
      dNominal: '',
      recibeDeIds: ['RS1'],
      alimentaIds: [],
      descargaEnId: null,
      ucAcum: 0,
      ucExtra: 0,
      area_m2: 0,
      desplazamientos: {},
      lblOffX: 0,
      lblOffY: 0,
      labelAngle: 0,
      labelX: 10,
      labelY: 20,
      bajR: 7 / 24,
    } as unknown as PlanoBajante;
    const eng = makeEngine([rs1, rs2], [baj]);
    eng.deleteSelected(['RS1']);
    expect(eng.ramales.map((r) => r.id)).toEqual(['RS2']);
  });

  it('yee doble desarmada: borrar lateral + segmento del principal funde el resto en UN ramal', () => {
    // 4 brazos en P=[0,0]: tronco principal RS1 (diagonal) + RS2 (horizontal), laterales
    // RS3 (tributario) y RS4 (ramal). Borrar RS3+RS4 → RS1 y RS2 quedan tocándose en P
    // (grado 2, sin colinealidad) y se funden en UN ramal conservando el vértice.
    const yee = [
      [0, 0],
      [0, 0],
    ] as [number, number][];
    const p1 = R({
      id: 'RS1',
      label: 'RS1',
      pts: [
        [-20, -20],
        [0, 0],
      ],
      yeeDobleAt: yee,
    });
    const p2 = R({
      id: 'RS2',
      label: 'RS2',
      pts: [
        [0, 0],
        [30, 0],
      ],
      yeeDobleAt: yee,
    });
    const l1 = R({
      id: 'RS3',
      tipo: 'tributario',
      padre: 'RS2',
      pts: [
        [0, 0],
        [15, 15],
      ],
      yeeDobleAt: yee,
    });
    const l2 = R({
      id: 'RS4',
      label: 'RS4',
      pts: [
        [0, 0],
        [-15, 15],
      ],
      yeeDobleAt: yee,
    });
    const eng = makeEngine([p1, p2, l1, l2]);
    eng.deleteSelected(['RS3', 'RS4']);
    expect(eng.ramales).toHaveLength(1);
    expect(eng.ramales[0].pts[0]).toEqual([-20, -20]);
    expect(eng.ramales[0].pts[eng.ramales[0].pts.length - 1]).toEqual([30, 0]);
  });
});

/* ── 3. UCs automáticas al asociar bajantes entre pisos ── */
function seedAsociacion() {
  localStorage.clear();
  const set = (k: string, v: unknown) => localStorage.setItem('civilflow_' + k, JSON.stringify(v));
  // Piso superior (plan 2): bajante BAN9 con ramal RS9 (2 inodoros = UC 4 c/u → whatever counts).
  set('trazos_2', {
    ramales: [{ id: 'RS9', net: 'san', tipo: 'ramal' }],
    bajantes: [{ id: 'BAN9', net: 'san', tipo: 'bajante', recibeDeIds: ['RS9'] }],
  });
  set('trazos_1', {
    ramales: [
      { id: 'RS8', net: 'san', tipo: 'ramal' },
      { id: 'RS7', net: 'san', tipo: 'ramal' },
    ],
    bajantes: [
      { id: 'BAN8', net: 'san', tipo: 'bajante', recibeDeIds: ['RS8'], alimentaIds: ['RS7'] },
    ],
  });
  set('aparatos_by_tramo_v2', { san_RS9_2: { san: 2 } });
  set('tramo_hidro_data_v3', {
    san_RS9_2: { accesorios: { codo90rmSube: 1 }, Lh: 0, nSalidas: 1 },
  });
}

describe('asociación entre pisos: UCs automáticas al inferior', () => {
  beforeEach(seedAsociacion);

  it('los ramales del bajante inferior reciben el agregado del superior sumado', () => {
    // Bajante inferior BAN8 ya tiene su propio conteo: debe SUMARSE, no pisarse.
    const aposKey = 'civilflow_' + APARATOS_BY_TRAMO_KEY;
    localStorage.setItem(
      aposKey,
      JSON.stringify({
        san_RS9_2: { san: 2 },
        san_RS8_1: { lavamanos: 1 },
      }),
    );
    const eng = makeEngine([]);
    const plans = [
      { id: '1', status: 'confirmed' },
      { id: '2', status: 'confirmed' },
    ] as unknown as Parameters<typeof applyBajanteAssociation>[3];
    applyBajanteAssociation(
      eng,
      {
        planId: '2',
        id: 'BAN9',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN9',
        nivelN: 2,
        npt: 3,
      },
      {
        planId: '1',
        id: 'BAN8',
        x: 0,
        y: 0,
        net: 'san',
        dNominal: '4"',
        code: 'BAN8',
        nivelN: 1,
        npt: 0,
      },
      plans,
    );
    const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    // RS8 inferior: suma lo propio (lavamanos 1) + heredado (san 2).
    expect(apos['san_RS8_1']).toEqual({ lavamanos: 1, san: 2 });
    // ucAcum del bajante destino = total UC del superior (2 inodoros).
    const trazos = JSON.parse(localStorage.getItem('civilflow_trazos_1') || '{}') as {
      bajantes?: Array<{ id: string; ucAcum?: number }>;
    };
    expect(trazos.bajantes?.find((b) => b.id === 'BAN8')?.ucAcum).toBe(2);
  });
});
