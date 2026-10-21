import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/almacenamientoClaves.ts';
import { collectSourceAgg } from '../bajanteAssociation';
import { propagarAparatosPresion } from '../propagation';
import { correrEspejos } from '../../components/aparatos/useAparatoEspejos.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoEstado.ts';

// REPRO dump v58: el montante SUPERIOR es una FUENTE (sin origenId/bomba, recibeDeIds y
// clave propia vacíos) cuyo ucAplicado trae un libro ramal-claveado de una asociación
// antigua con roles invertidos (entrada con la clave del LD del piso de abajo). Con el
// árbol vacío, el passthrough mezclaba ese libro rancio → abajo 15.5 sin que arriba haya
// nada que lo justifique. Regla: solo ESLABONES (origenId/bombaEnId) mezclan libro.

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

const RANCIO = { duc: 3, lvro: 3, lvm: 5, lvp: 2, tin: 5 };

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
});

describe('una FUENTE con libro rancio ramal-claveado no aporta su libro al grupo', () => {
  it('collectSourceAgg: árbol vacío + sin origenId → libro NO mezclado', () => {
    const { agg } = collectSourceAgg({
      net: 'ac',
      planId: '2',
      bajId: 'MAC1_ac',
      liveBaj: null,
      liveRamales: null,
      storedBaj: {
        id: 'MAC1_ac',
        tipo: 'montante',
        x: 0,
        y: 0,
        code: 'MAC1',
        ucAplicado: { ac_LD_MAC1_ac_1: { ...RANCIO } },
      },
      storedRamales: [],
      counts: {},
      hidro: {},
    });
    expect(agg).toEqual({});
  });

  // La purga en MEMORIA pasa (macRefresh la registra) y el propagador es storage-driven:
  // se verifica en el DOC del piso (el mockStorage captura la escritura).
  it('5bis purga el libro rancio de la fuente (conserva la entrada anidada de su clave)', () => {
    mockStorage[`civilflow_${TRAZOS_PREFIX}2`] = JSON.stringify({
      // Al menos un ramal de la red: sin piezas, la propagación sale antes de la fase 5bis
      // (no hay red que propagar) y la purga nunca se ejecutaría.
      ramales: [
        {
          id: 'RAC1',
          net: 'ac',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [100, 0],
          ],
        },
      ],
      bajantes: [
        {
          id: 'MAC1_ac',
          net: 'ac',
          tipo: 'montante',
          // pid: el piso dueño del bajante (lo asigna el cargador al abrir el plano). La
          // purga de 5bis compara contra la clave propia `${net}_${id}_${pid}`: sin pid, la
          // clave propia no coincide y se purgaría también (el test quedaba sin poder
          // verificar la conservación de la entrada anidada).
          pid: '2',
          x: 0,
          y: 0,
          code: 'MAC1',
          ucAplicado: {
            ac_LD_MAC1_ac_1: { ...RANCIO },
            ac_MAC1_ac_2: { lvm: 1 },
          },
        },
      ],
    });
    propagarAparatosPresion('ac');
    // El propagador es storage-driven: la purga se verifica en el DOC del piso.
    const d2 = JSON.parse(mockStorage[`civilflow_${TRAZOS_PREFIX}2`]) as {
      bajantes?: Array<{ ucAplicado?: Record<string, Record<string, number>> }>;
    };
    const vivo = (d2.bajantes || [])[0];
    // Solo sobrevive la entrada anidada de su propia clave.
    expect(vivo.ucAplicado).toEqual({ ac_MAC1_ac_2: { lvm: 1 } });
  });

  it('el asociado de una fuente vacía queda sin rancio tras los espejos', () => {
    mockStorage[`civilflow_${TRAZOS_PREFIX}2`] = JSON.stringify({
      ramales: [
        {
          id: 'RACX',
          net: 'ac',
          tipo: 'ramal',
          pts: [
            [500, 500],
            [600, 600],
          ],
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
          ucAplicado: { ac_LD_MAC1_ac_1: { ...RANCIO } },
        },
      ],
    });
    mockStorage[`civilflow_${TRAZOS_PREFIX}1`] = JSON.stringify({
      ramales: [
        {
          id: 'RACY',
          net: 'ac',
          tipo: 'ramal',
          pts: [
            [300, 300],
            [400, 400],
          ],
        },
      ],
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
    mockStorage[`civilflow_${APARATOS_BY_TRAMO_KEY}`] = JSON.stringify({});

    const eng1: Partial<IPlanoEngineCore> = {
      ramales: [],
      bajantes: [
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
      ],
      dims: [],
      textAnnots: [],
      areas: [],
      crossFloorGhosts: [],
      guideLines: [],
      selId: null,
      _hiddenNets: new Set(),
      activeNet: 'ac',
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
      counts: {},
      setCounts: () => {},
      hidroData: {},
      setHidroData: () => {},
      agregadoBajante: () => ({}),
      exitsDeBajante: () => new Set(),
    } as never);
    propagarAparatosPresion('ac');

    const real = (
      eng1.bajantes as unknown as Array<{
        id: string;
        pisoBase?: string;
        ucAplicado?: Record<string, Record<string, number>>;
      }>
    ).find((b) => b.pisoBase === 'Piso 1');
    const libro = real?.ucAplicado || {};
    for (const v of Object.values(libro)) expect(v).not.toEqual(RANCIO);
    // La fuente quedó purgada en storage.
    const d2 = JSON.parse(mockStorage[`civilflow_${TRAZOS_PREFIX}2`]) as {
      bajantes?: Array<{ ucAplicado?: Record<string, unknown> }>;
    };
    expect((d2.bajantes || [])[0].ucAplicado).toBeUndefined();
  });
});
