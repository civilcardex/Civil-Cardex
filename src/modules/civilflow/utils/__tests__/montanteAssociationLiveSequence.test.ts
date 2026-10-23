import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { applyBajanteAssociation } from '../bajanteAssociation';
import { propagarAparatosPresion } from '../propagation';
import { correrEspejos } from '../../components/fixtures/useFixtureMirrors.ts';
import { currentMapDe, type TargetArgs } from '../../components/fixtures/useFixtureTarget.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';

// SECUENCIA VIVA completa (orig. usuario: "no se están propagando los aparatos entre pisos
// cuando asocio montantes"): los tests de apply cortan en el storage recién escrito y el E2E
// arranca POST-asociación (origenId sembrado). Aquí va el flujo del usuario ENTERO: piso 2
// cargado → asociar desde el menú (apply) → abrir piso 1 (espejos + propagación) → panel y
// ramales del piso 1 con la herencia.

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

const PLANS = [
  { id: '1', name: 'Piso 1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'Piso 2', nivel: 1, npt: 320, status: 'confirmed' },
] as never[];

// Forma del proyecto REAL del usuario (r53): el montante comparte ID entre pisos (MAC1) y el
// superior arrastra las listas de la era vieja (alimentaIds) con sus ramales ya en cero; los
// aparatos viven en su CLAVE PROPIA (limpieza de la r55).
const GRUPO = { ino: 2, lvm: 2 }; // 4 UC arriba

function seedStorage() {
  // Piso SUPERIOR (plan 2): montante MAC1, ramales servidos (cola sobre él) ya vacíos.
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [
        {
          id: 'RAC6',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [100, 0],
          ],
          ini: 'MAC1',
          label: 'RAC6',
        },
        {
          id: 'RAC1',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [0, 100],
          ],
          ini: 'MAC1',
          label: 'RAC1',
        },
      ],
      bajantes: [
        {
          id: 'MAC1',
          net: 'af',
          tipo: 'montante',
          x: 0,
          y: 0,
          code: 'MAC1',
          pisoBase: 'Piso 2',
          alimentaIds: ['RAC6', 'RAC1'],
          dNominal: '3/4"',
        },
      ],
    }),
  );
  // Piso INFERIOR (plan 1): montante MAC1 (MISMO id, r53) con dos ramales propios.
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [
        {
          id: 'RA1',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [30, 30],
            [130, 30],
          ],
          label: 'RA1',
        },
        {
          id: 'RA2',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [30, 30],
            [30, 130],
          ],
          label: 'RA2',
        },
      ],
      bajantes: [
        {
          id: 'MAC1',
          net: 'af',
          tipo: 'montante',
          x: 30,
          y: 30,
          code: 'MAC1',
          pisoBase: 'Piso 1',
          dNominal: '3/4"',
        },
      ],
    }),
  );
  // Aparatos: el grupo en la clave propia del superior; lo propio del piso 1 en sus ramales.
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({
      af_MAC1_2: { ...GRUPO },
      af_RA1_1: { lvp: 1 },
      af_RA2_1: { duc: 1 },
    }),
  );
}

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
    nivelActual:
      loadedPlanId === '2'
        ? ({ label: 'Piso 2', n: 1, npt: 320 } as never)
        : ({ label: 'Piso 1', n: 0, npt: 0 } as never),
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

function apos(): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');
}

function doc(planId: string): {
  bajantes?: Array<Record<string, unknown>>;
  ramales?: Array<Record<string, unknown>>;
} {
  return JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}');
}

/** Paso 1 del usuario: asociar desde el piso SUPERIOR cargado (menú → Destino). */
function asociarDesdeArriba(): void {
  const eng = makeEngine('2');
  eng.bajantes.push({
    id: 'MAC1',
    net: 'af',
    tipo: 'montante',
    x: 0,
    y: 0,
    code: 'MAC1',
    pisoBase: 'Piso 2',
    alimentaIds: ['RAC6', 'RAC1'],
    dNominal: '3/4"',
  } as never);
  eng.ramales.push(
    {
      id: 'RAC6',
      net: 'af',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [100, 0],
      ],
      ini: 'MAC1',
    } as never,
    {
      id: 'RAC1',
      net: 'af',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [0, 100],
      ],
      ini: 'MAC1',
    } as never,
  );
  applyBajanteAssociation(
    eng,
    {
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
    } as never,
    {
      planId: '1',
      id: 'MAC1',
      x: 30,
      y: 30,
      net: 'af',
      dNominal: '3/4"',
      code: 'MAC1',
      nivelN: 0,
      npt: 0,
      tipo: 'montante',
    } as never,
    PLANS,
  );
}

/** Paso 2 del usuario: abrir el piso INFERIOR — espejos + propagación como los dispara el panel. */
function abrirPisoInferior(): IPlanoEngineCore {
  const eng1 = makeEngine('1');
  eng1.bajantes.push(
    // Proyección del superior que atraviesa la altura (r53): mismo id, pisoBase ajeno.
    {
      id: 'MAC1',
      net: 'af',
      tipo: 'montante',
      x: 501,
      y: 849,
      code: 'MAC1',
      pisoBase: 'Piso 2',
    } as never,
    // El real del piso 1, ya asociado.
    {
      id: 'MAC1',
      net: 'af',
      tipo: 'montante',
      x: 30,
      y: 30,
      code: 'MAC1',
      pisoBase: 'Piso 1',
      origenId: '2|MAC1',
      dNominal: '3/4"',
    } as never,
  );
  eng1.ramales.push(
    {
      id: 'RA1',
      net: 'af',
      tipo: 'ramal',
      pts: [
        [30, 30],
        [130, 30],
      ],
    } as never,
    {
      id: 'RA2',
      net: 'af',
      tipo: 'ramal',
      pts: [
        [30, 30],
        [30, 130],
      ],
    } as never,
    {
      id: 'LD_MAC1',
      net: 'af',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [30, 30],
      ],
    } as never,
  );
  correrEspejos({
    engineRef: { current: eng1 } as never,
    netId: 'af',
    planId: '1',
    plans: PLANS,
    planLoadedTick: 1,
    targetId: null,
    counts: apos(),
    setCounts: () => {},
    hidroData: {},
    setHidroData: () => {},
    agregadoBajante: () => ({}),
    exitsDeBajante: () => new Set(),
  } as never);
  propagarAparatosPresion('af');
  propagarAparatosPresion('af');
  return eng1;
}

function panelDelAsociado(eng1: IPlanoEngineCore): Record<string, number> {
  const real = eng1.bajantes.find(
    (b) => b.id === 'MAC1' && (b as { pisoBase?: string }).pisoBase === 'Piso 1',
  ) as unknown as Record<string, unknown>;
  return currentMapDe({
    netId: 'af',
    storageKey: 'af_MAC1_1',
    targetId: 'MAC1',
    mergeKeys: null,
    isBajanteSan: true,
    planId: '1',
    selElement: real as never,
    counts: apos(),
    hidroData: {},
    plans: PLANS,
    engineRef: { current: eng1 } as never,
    agregadoBajante: () => ({}),
    exitsDeBajante: () => new Set(),
  } as unknown as TargetArgs) as Record<string, number>;
}

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

describe('secuencia viva: asociar desde arriba → abrir abajo → la herencia está', () => {
  it('el apply dejó el grupo en el LD y en el libro del asociado', () => {
    asociarDesdeArriba();
    expect(apos()['af_LD_MAC1_1']).toEqual(GRUPO);
    const tb = doc('1').bajantes?.find((b) => b.id === 'MAC1') as
      { ucAplicado?: Record<string, Record<string, number>>; ucAcum?: number } | undefined;
    expect(tb?.ucAplicado?.['af_LD_MAC1_1']).toEqual(GRUPO);
    expect(tb?.ucAcum).toBe(4);
  });

  it('el panel del asociado (piso 1) muestra el grupo del superior', () => {
    asociarDesdeArriba();
    const eng1 = abrirPisoInferior();
    expect(panelDelAsociado(eng1)).toEqual(GRUPO);
  });
});
