import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { applyBajanteAssociation } from '../bajanteAssociation';
import { propagarAparatosPresion } from '../propagation';
import { correrEspejos } from '../../components/fixtures/useFixtureMirrors.ts';
import { currentMapDe, type TargetArgs } from '../../components/fixtures/useFixtureTarget.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';

// Escenario EXACTO del usuario (capturas MAC1-P2=4.5 ✓ / MAC2-P1=15.5 ✗): los aparatos de
// cada piso viven en la CLAVE PROPIA del montante (asignados en él desde el panel), NO en
// ramales. Tras asociar, el panel del montante inferior asociado debe mostrar SOLO el grupo
// heredado del superior (4.5), nunca lo propio mezclado.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document) {
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
  }
  if (!g.window) {
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
  }
});

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
});

const mockStorage: Record<string, string> = {};

const PLANS = [
  { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' },
] as never[];

const SRC = {
  planId: '2',
  id: 'MAC1',
  x: 0,
  y: 0,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAC1',
  nivelN: 1,
  npt: 320,
  tipo: 'montante',
};
const TGT = {
  planId: '1',
  id: 'MAC2',
  x: 30,
  y: 30,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAC2',
  nivelN: 0,
  npt: 0,
  tipo: 'montante',
};

function makeEngine(loadedPlanId: string): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales: [],
    bajantes: [],
    dims: [],
    textAnnots: [],
    areas: [],
    crossFloorGhosts: [],
    guideLines: [],
    selId: null,
    _hiddenNets: new Set(),
    activeNet: 'af',
    tipoTramo: 'ramal',
    _loadedPlanId: loadedPlanId,
    nivelActual: { label: 'P2', n: 1, npt: 320 } as never,
    scaleM: 0.5,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    updateElementById: () => {},
  };
  engine.updateElementById = ((id: string, fields: Record<string, unknown>) => {
    const el = [...(engine.bajantes || []), ...(engine.ramales || [])].find(
      (x) => (x as { id: string }).id === id,
    );
    if (el) Object.assign(el, fields);
  }) as never;
  return engine as IPlanoEngineCore;
}

function seedMontantesConClavePropia(): void {
  mockStorage[`civilflow_${TRAZOS_PREFIX}2`] = JSON.stringify({
    ramales: [
      {
        id: 'RAC1',
        net: 'af',
        tipo: 'ramal',
        pts: [
          [100, 0],
          [0, 0],
        ],
        label: 'RAC1',
      },
    ],
    bajantes: [{ id: 'MAC1', net: 'af', tipo: 'montante', x: 0, y: 0 }],
  });
  mockStorage[`civilflow_${TRAZOS_PREFIX}1`] = JSON.stringify({
    ramales: [
      {
        id: 'RAC2',
        net: 'af',
        tipo: 'ramal',
        pts: [
          [50, 50],
          [30, 30],
        ],
        label: 'RAC2',
      },
    ],
    bajantes: [{ id: 'MAC2', net: 'af', tipo: 'montante', x: 30, y: 30, recibeDeIds: ['RAC2'] }],
  });
  // Aparatos EN LA CLAVE DEL MONTANTE (asignados en el panel del montante, no en ramales):
  // superior 4.5 UC, inferior 15.5 UC — los números de las capturas.
  mockStorage[`civilflow_${APARATOS_BY_TRAMO_KEY}`] = JSON.stringify({
    af_MAC1_2: { duc: 2, lvra: 1, lvm: 1, tin: 1 },
    af_MAC2_1: { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 },
  });
}

/** Panel del montante (mismo camino que FixturesPanel → useFixtureTarget). */
function panelDe(eng: IPlanoEngineCore, bajId: string): Record<string, number> {
  const b = eng.bajantes.find((x) => x.id === bajId) as unknown as Record<string, unknown>;
  return currentMapDe({
    netId: 'af',
    storageKey: `af_${bajId}_1`,
    targetId: bajId,
    mergeKeys: null,
    isBajanteSan: true,
    planId: '1',
    selElement: b as never,
    counts: JSON.parse(mockStorage[`civilflow_${APARATOS_BY_TRAMO_KEY}`] || '{}'),
    hidroData: {},
    plans: [{ id: '1', nivel: 0 }],
    engineRef: { current: eng } as never,
    agregadoBajante: () => ({}),
    exitsDeBajante: () => new Set(),
  } as unknown as TargetArgs);
}

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  seedMontantesConClavePropia();
});

describe('montante asociado con aparatos en su clave propia', () => {
  it('el panel del asociado muestra SOLO el grupo del superior (no lo propio)', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({ id: 'MAC1', net: 'af', tipo: 'montante', x: 0, y: 0 } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);

    // Motor del piso 1 (el que usa el panel cuando trabajas abajo).
    const eng1 = makeEngine('1');
    const d1 = JSON.parse(mockStorage[`civilflow_${TRAZOS_PREFIX}1`]);
    eng1.ramales = d1.ramales ?? [];
    eng1.bajantes = d1.bajantes ?? [];

    propagarAparatosPresion('af');

    const mapa = panelDe(eng1, 'MAC2');
    expect(mapa).toEqual({ duc: 2, lvra: 1, lvm: 1, tin: 1 });
  });

  it('un libro HUÉRFANO del montante FUENTE (piso superior) no envenena el grupo que baja', () => {
    // Estado EXACTO del dump del usuario: MAC1 del piso superior es fuente pura (sin
    // recibeDeIds) y arrastra un ucAplicado de una era anterior con el grupo VIEJO (grande).
    // collectSourceAgg lo mezclaba con máximo → el rancio ganaba al árbol fresco y bajaba
    // 15.5 en vez de los 4.5 reales del piso superior.
    const d2 = JSON.parse(mockStorage[`civilflow_${TRAZOS_PREFIX}2`]);
    const mac1 = (d2.bajantes as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAC1',
    ) as Record<string, unknown>;
    mac1.ucAplicado = {
      af_LD_MAC1_ac_2: { duc: 3, lvm: 5, lvro: 3, lvp: 2, tin: 5 },
    };
    mockStorage[`civilflow_${TRAZOS_PREFIX}2`] = JSON.stringify(d2);

    const eng = makeEngine('2');
    eng.bajantes.push({ id: 'MAC1', net: 'af', tipo: 'montante', x: 0, y: 0 } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);
    propagarAparatosPresion('af');

    // El libro del asociado lleva el grupo FRESCO del árbol ({duc:2, lvra:1, lvm:1, tin:1}),
    // no el rancio.
    const d1 = JSON.parse(mockStorage[`civilflow_${TRAZOS_PREFIX}1`]) as {
      bajantes?: Array<{ id?: string; ucAplicado?: Record<string, Record<string, number>> }>;
    };
    const b2 = (d1.bajantes || []).find((b) => b.id === 'MAC2') as Record<string, unknown>;
    const libro = b2.ucAplicado as Record<string, Record<string, number>>;
    expect(libro['af_LD_MAC1_1']).toEqual({ duc: 2, lvra: 1, lvm: 1, tin: 1 });
    expect(libro['af_RAC2_1']).toEqual({ duc: 2, lvra: 1, lvm: 1, tin: 1 });
    // Y el libro huérfano del fuente quedó purgado del storage.
    const d2b = JSON.parse(mockStorage[`civilflow_${TRAZOS_PREFIX}2`]);
    const mac1b = (d2b.bajantes as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAC1',
    ) as Record<string, unknown>;
    expect(mac1b.ucAplicado).toBeUndefined();
  });

  it('un libro VIEJO mezclado (propio + heredado) se cura al correr los espejos desde el piso de abajo', () => {
    // Estado real del usuario: el storage del inferior trae el libro contaminado por las
    // doctrinas anteriores (entradas con los aparatos propios del montante mezclados).
    const d1 = JSON.parse(mockStorage[`civilflow_${TRAZOS_PREFIX}1`]);
    const mac2 = (d1.bajantes as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAC2',
    ) as Record<string, unknown>;
    mac2.origenId = '2|MAC1';
    mac2.ucAplicado = {
      af_RAC2_1: { duc: 5, lvro: 3, lvra: 1, lvm: 6, lvp: 2, tin: 6 },
      af_LD_MAC1_1: { duc: 5, lvro: 3, lvra: 1, lvm: 6, lvp: 2, tin: 6 },
    };
    mockStorage[`civilflow_${TRAZOS_PREFIX}1`] = JSON.stringify(d1);

    const eng1 = makeEngine('1');
    eng1.ramales = d1.ramales ?? [];
    eng1.bajantes = d1.bajantes ?? [];

    correrEspejos({
      engineRef: { current: eng1 } as never,
      netId: 'af',
      planId: '1',
      plans: [
        { id: '1', nivel: 0, status: 'confirmed' },
        { id: '2', nivel: 1, status: 'confirmed' },
      ] as never,
      planLoadedTick: 1,
      targetId: null,
      counts: JSON.parse(mockStorage[`civilflow_${APARATOS_BY_TRAMO_KEY}`] || '{}'),
      setCounts: () => {},
      hidroData: {},
      setHidroData: () => {},
      agregadoBajante: () => ({}),
      exitsDeBajante: () => new Set(),
    } as never);

    // El libro del motor queda con el grupo PURO del superior (4.5 UC) — sin la mezcla.
    const vivo = eng1.bajantes.find((b) => b.id === 'MAC2') as unknown as {
      ucAplicado?: Record<string, Record<string, number>>;
    };
    expect(vivo.ucAplicado?.af_RAC2_1).toEqual({ duc: 2, lvra: 1, lvm: 1, tin: 1 });
    expect(vivo.ucAplicado?.af_LD_MAC1_1).toEqual({ duc: 2, lvra: 1, lvm: 1, tin: 1 });
    expect(panelDe(eng1, 'MAC2')).toEqual({ duc: 2, lvra: 1, lvm: 1, tin: 1 });
  });
});
