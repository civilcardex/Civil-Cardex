import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/almacenamientoClaves.ts';
import { propagarAparatosPresion } from '../propagation';
import { correrEspejos } from '../../components/aparatos/useAparatoEspejos.ts';
import { currentMapDe, type TargetArgs } from '../../components/aparatos/useAparatoObjetivo.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoEstado.ts';

// E2E INTEGRAL (espec. usuario): la herencia de montantes debe mostrar ABAJO exactamente lo
// que muestra ARRIBA — con TODO el estado rancio real acumulado por las doctrinas viejas:
// junk en ramales con campo aparato, libros rancios en el storage de AMBOS pisos y la
// proyección fantasma del superior conviviendo con el real en el motor del piso abierto.

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  if (!g.document)
    g.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => ({}),
    };
  if (!g.window)
    g.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    };
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

const GRUPO_REAL = { duc: 1, lvro: 1, lvm: 1, lvp: 1, tin: 1 }; // 4.5 UC arriba ✓
const RANCIO = { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 }; // 15.5+ de eras viejas

function seedTodoElRancio() {
  // Piso SUPERIOR: la carga real vive en la CLAVE PROPIA del montante; ramales viejos con
  // campo aparato y junk listados en alimentaIds; libro rancio de una era anterior.
  mockStorage[`civilflow_${TRAZOS_PREFIX}2`] = JSON.stringify({
    scaleM: 0.5,
    ramales: [
      {
        id: 'RAFA',
        net: 'ac',
        tipo: 'ramal',
        pts: [
          [0, 0],
          [100, 0],
        ],
        label: 'RAFA',
        aparatoFin: 'duc',
      },
    ],
    bajantes: [
      {
        id: 'MAC1_ac',
        net: 'ac',
        tipo: 'montante',
        x: 0,
        y: 0,
        code: 'MAC1',
        alimentaIds: ['RAFA'],
        ucAplicado: { ac_LD_MAC1_ac_1: { ...RANCIO } },
      },
    ],
  });
  // Piso INFERIOR: montante asociado (origenId) con libro RANCIO heredado de la era vieja.
  mockStorage[`civilflow_${TRAZOS_PREFIX}1`] = JSON.stringify({
    scaleM: 0.5,
    ramales: [],
    bajantes: [
      {
        id: 'MAC1_ac',
        net: 'ac',
        tipo: 'montante',
        x: 30,
        y: 30,
        code: 'MAC1',
        pisoBase: 'Piso 1',
        origenId: '2|MAC1_ac',
        ucAplicado: { ac_LD_MAC1_ac_1: { ...RANCIO } },
      },
    ],
  });
  mockStorage[`civilflow_${APARATOS_BY_TRAMO_KEY}`] = JSON.stringify({
    ac_MAC1_ac_2: { ...GRUPO_REAL },
    ac_RAFA_2: { duc: 2, lvro: 2, lvm: 4, lvp: 1, tin: 4 },
  });
}

function makeEngine(): IPlanoEngineCore {
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
    activeNet: 'ac',
    tipoTramo: 'ramal',
    _loadedPlanId: '1',
    nivelActual: { label: 'Piso 1', n: 0, npt: 0 } as never,
    scaleM: 0.5,
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    updateElementById: () => {},
  };
  return engine as IPlanoEngineCore;
}

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  seedTodoElRancio();
});

describe('E2E: con todo el rancio acumulado, abajo muestra lo mismo que arriba', () => {
  it('espejos + propagación dejan el panel del asociado y el LD en el grupo real', () => {
    const eng1 = makeEngine();
    // El motor del piso abierto: el real del piso 1 Y la proyección del superior (mismo id,
    // pisoBase ajeno, libro rancio) — como en la sesión real del usuario.
    eng1.bajantes.push(
      {
        id: 'MAC1_ac',
        net: 'ac',
        tipo: 'montante',
        x: 501,
        y: 849,
        code: 'MAC1',
        pisoBase: 'Piso 2',
        ucAplicado: { ac_LD_MAC1_ac_1: { ...RANCIO } },
      } as never,
      {
        id: 'MAC1_ac',
        net: 'ac',
        tipo: 'montante',
        x: 30,
        y: 30,
        code: 'MAC1',
        pisoBase: 'Piso 1',
        origenId: '2|MAC1_ac',
        ucAplicado: { ac_LD_MAC1_ac_1: { ...RANCIO } },
      } as never,
    );
    eng1.ramales.push({
      id: 'LD_MAC1_ac',
      net: 'ac',
      tipo: 'ramal',
      pts: [
        [501, 849],
        [30, 30],
      ],
    } as never);

    // El ciclo vivo: espejos (cura el libro desde abajo) + propagación.
    correrEspejos({
      engineRef: { current: eng1 } as never,
      netId: 'ac',
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
    propagarAparatosPresion('ac');
    propagarAparatosPresion('ac');

    // Panel del montante ASOCIADO (piso inferior): grupo real, sin rancio.
    const real = eng1.bajantes.find(
      (b) => b.id === 'MAC1_ac' && (b as { pisoBase?: string }).pisoBase === 'Piso 1',
    ) as unknown as Record<string, unknown>;
    const panel = currentMapDe({
      netId: 'ac',
      storageKey: 'ac_MAC1_ac_1',
      targetId: 'MAC1_ac',
      mergeKeys: null,
      isBajanteSan: true,
      planId: '1',
      selElement: real as never,
      counts: JSON.parse(mockStorage[`civilflow_${APARATOS_BY_TRAMO_KEY}`] || '{}'),
      hidroData: {},
      plans: [
        { id: '1', nivel: 0 },
        { id: '2', nivel: 1 },
      ],
      engineRef: { current: eng1 } as never,
      agregadoBajante: () => ({}),
      exitsDeBajante: () => new Set(),
    } as unknown as TargetArgs);
    expect(panel).toEqual(GRUPO_REAL);

    // El LDesvio también quedó con el grupo real (storage).
    const apos = JSON.parse(mockStorage[`civilflow_${APARATOS_BY_TRAMO_KEY}`] || '{}');
    expect(apos['ac_LD_MAC1_ac_1']).toEqual(GRUPO_REAL);

    // Y el libro del asociado (motor vivo) quedó curado — sin entradas rancias.
    const ucAp = (real.ucAplicado ?? {}) as Record<string, Record<string, number>>;
    for (const v of Object.values(ucAp)) expect(v).toEqual(GRUPO_REAL);
  });
});
