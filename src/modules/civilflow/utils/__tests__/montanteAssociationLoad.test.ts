import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { applyBajanteAssociation } from '../bajanteAssociation';
import { propagarAparatosPresion } from '../propagation';
import { deleteSelected } from '../../lib/PlanoEngine/deleteSelected.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';

// (1) El montante de destino NO puede tomar 12 UC cuando el de arriba tiene 3: el libro de
//     herencia lleva la MISMA carga en cada pieza que la recibió y hay que tomar el MÁXIMO
//     (como hace el panel), no sumarlas.
// (2) Al borrar el Ldesvio (que vive en el piso de abajo) el bajante/montante de abajo debe
//     quedar SIN ORIGEN en el motor vivo (el desplegable) y en el storage.

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
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
  { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' },
] as never[];

/** Piso 2: montante MAF1 con 3 UC. Piso 1: montante MAF2 con TRES ramales (RAF2/3/4) y un
 *  ramal aguas abajo (RAF5, el que alimenta el montante). */
function seedStorage() {
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [
        {
          id: 'RAF1',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [100, 0],
            [0, 0],
          ],
          label: 'RAF1',
        },
      ],
      bajantes: [{ id: 'MAF1', net: 'af', tipo: 'montante', x: 0, y: 0, recibeDeIds: ['RAF1'] }],
    }),
  );
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      ramales: [
        {
          id: 'RAF2',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [50, 50],
            [30, 30],
          ],
          label: 'RAF2',
        },
        {
          id: 'RAF3',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [60, 60],
            [30, 30],
          ],
          label: 'RAF3',
        },
        {
          id: 'RAF4',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [70, 70],
            [30, 30],
          ],
          label: 'RAF4',
        },
        {
          id: 'RAF5',
          net: 'af',
          tipo: 'ramal',
          pts: [
            [30, 30],
            [30, 90],
          ],
          label: 'RAF5',
        },
      ],
      bajantes: [
        {
          id: 'MAF2',
          net: 'af',
          tipo: 'montante',
          x: 30,
          y: 30,
          recibeDeIds: ['RAF2', 'RAF3', 'RAF4'],
          alimentaIds: ['RAF5'],
        },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ af_RAF1_2: { ino: 2, lvm: 1 } }),
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
    nivelActual: { label: 'P2', n: 1, npt: 320 } as never,
    scaleM: 0.5,
    pxToM: (px: number) => px,
    toCvs: (x: number, y: number) => ({ x, y }),
    toPlane: (x: number, y: number) => ({ x, y }),
    render: () => {},
    _emitSelect: () => {},
    _emitStatus: () => {},
    _emitDelete: () => {},
    _markDirty: () => {},
    triggerAlert: () => {},
    updateElementById: () => {},
    _renumberRamales: () => {},
    _renumberBajantes: () => {},
    _renumberAreas: () => {},
  };
  engine.updateElementById = ((id: string, fields: Record<string, unknown>) => {
    const el = [...(engine.bajantes || []), ...(engine.ramales || [])].find(
      (x) => (x as { id: string }).id === id,
    );
    if (el) Object.assign(el, fields);
  }) as never;
  return engine as IPlanoEngineCore;
}

const apos = (): Record<string, Record<string, number>> =>
  JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');
const doc = (planId: string): Record<string, never> =>
  JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + planId) || '{}');

const SRC = {
  planId: '2',
  id: 'MAF1',
  x: 0,
  y: 0,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAF1',
  nivelN: 1,
  npt: 320,
  tipo: 'montante',
};
const TGT = {
  planId: '1',
  id: 'MAF2',
  x: 30,
  y: 30,
  net: 'af',
  dNominal: '3/4"',
  code: 'MAF2',
  nivelN: 0,
  npt: 0,
  tipo: 'montante',
};

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

describe('el montante de destino toma la MISMA cantidad, ni una más', () => {
  it('el ramal que el montante alimenta lleva 3 UC, no 12', () => {
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);

    propagarAparatosPresion('af');
    propagarAparatosPresion('af');

    // El libro tiene una entrada por pieza que recibió la carga (Ldesvio + 3 ramales): si se
    // suman, el ramal de abajo carga 4 x 3 = 12 UC en vez de 3.
    const abajo = apos()['af_RAF5_1'];
    const total = Object.values(abajo || {}).reduce((s, v) => s + v, 0);
    expect(total).toBe(3);
  });
});

describe('borrar el Ldesvio deja el montante SIN origen (motor vivo y storage)', () => {
  it('el origen del montante de abajo queda en null', () => {
    // Asociar desde el piso de arriba.
    const eng = makeEngine('2');
    eng.bajantes.push({
      id: 'MAF1',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(eng, SRC as never, TGT as never, PLANS);

    // Abrir el piso de ABAJO: ahí viven el Ldesvio y el montante destino.
    const d1 = doc('1') as unknown as {
      bajantes: Array<Record<string, unknown>>;
      ramales: Array<Record<string, unknown>>;
    };
    const eng1 = makeEngine('1');
    eng1.bajantes = d1.bajantes as never;
    eng1.ramales = d1.ramales as never;
    eng1.nivelActual = { label: 'P1', n: 0, npt: 0 } as never;

    const maf2 = eng1.bajantes.find((b) => b.id === 'MAF2') as unknown as Record<string, unknown>;
    expect(maf2.origenId).toBe('2|MAF1');

    const ld = eng1.ramales.find((r) => r.id === 'LD_MAF1');
    expect(ld).toBeDefined();

    deleteSelected(eng1, ['LD_MAF1']);

    // Motor vivo (lo que pinta el desplegable de origen).
    const maf2b = eng1.bajantes.find((b) => b.id === 'MAF2') as unknown as Record<string, unknown>;
    expect(maf2b.origenId ?? null).toBeNull();
    // Y el storage del piso.
    const b2 = (doc('1').bajantes as unknown as Array<Record<string, unknown>>).find(
      (b) => b.id === 'MAF2',
    );
    expect(b2?.origenId ?? null).toBeNull();
  });
});
