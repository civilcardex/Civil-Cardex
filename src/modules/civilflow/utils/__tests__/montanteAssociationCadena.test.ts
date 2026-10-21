import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { APARATOS_BY_TRAMO_KEY, TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { applyBajanteAssociation } from '../bajanteAssociation';
import { buildTramos } from '../buildTramos.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';

// CADENA de montantes entre pisos: piso 3 -> piso 2 -> piso 1. El montante del piso 2 recibe
// 3 UC del piso 3 y, al asociarlo con el del piso 1, ese de abajo debe tomar LOS MISMOS 3.

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
  { id: '1', name: 'P1', nivel: 0, npt: 0, status: 'confirmed' },
  { id: '2', name: 'P2', nivel: 1, npt: 320, status: 'confirmed' },
  { id: '3', name: 'P3', nivel: 2, npt: 640, status: 'confirmed' },
] as never[];

function seedStorage() {
  // Piso 3: montante MAF3 con el ramal RAF1 (3 UC).
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '3',
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
      bajantes: [{ id: 'MAF3', net: 'af', tipo: 'montante', x: 0, y: 0, recibeDeIds: ['RAF1'] }],
    }),
  );
  // Piso 2: montante MAF2 SIN ramales propios (solo baja la carga).
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      ramales: [],
      bajantes: [{ id: 'MAF2', net: 'af', tipo: 'montante', x: 10, y: 10 }],
    }),
  );
  // Piso 1: montante MAF1 con su ramal RAF2.
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
      ],
      bajantes: [{ id: 'MAF1', net: 'af', tipo: 'montante', x: 30, y: 30, recibeDeIds: ['RAF2'] }],
    }),
  );
  localStorage.setItem(
    'civilflow_' + APARATOS_BY_TRAMO_KEY,
    JSON.stringify({ af_RAF1_3: { ino: 2, lvm: 1 } }),
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
    nivelActual: { label: 'P3', n: 2, npt: 640 } as never,
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

const apos = (): Record<string, Record<string, number>> =>
  JSON.parse(localStorage.getItem('civilflow_' + APARATOS_BY_TRAMO_KEY) || '{}');

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

describe('cadena de montantes entre pisos', () => {
  it('el montante del piso 1 toma los mismos 3 UC que el del piso 3', () => {
    // 3 -> 2
    const eng3 = makeEngine('3');
    eng3.bajantes.push({
      id: 'MAF3',
      net: 'af',
      tipo: 'montante',
      x: 0,
      y: 0,
      recibeDeIds: ['RAF1'],
    } as never);
    applyBajanteAssociation(
      eng3,
      {
        planId: '3',
        id: 'MAF3',
        x: 0,
        y: 0,
        net: 'af',
        dNominal: '3/4"',
        code: 'MAF3',
        nivelN: 2,
        npt: 640,
        tipo: 'montante',
      } as never,
      {
        planId: '2',
        id: 'MAF2',
        x: 10,
        y: 10,
        net: 'af',
        dNominal: '3/4"',
        code: 'MAF2',
        nivelN: 1,
        npt: 320,
        tipo: 'montante',
      } as never,
      PLANS,
    );
    expect(apos()['af_LD_MAF3_2']).toEqual({ ino: 2, lvm: 1 });

    // El montante intermedio (piso 2) NO tiene ramales: su fila en Cálculo UC solo puede
    // mostrar los 3 UC si el libro de herencia manda como fuente única.
    {
      const d2 = JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + '2') || '{}');
      const tramos = buildTramos(
        'af',
        {
          af_1: {
            planoId: '2',
            ramales: d2.ramales as never,
            bajantes: d2.bajantes as never,
          },
        },
        {},
        apos(),
      );
      const fila = tramos.find((t) => t.id === 'MAF2');
      expect(fila).toBeDefined();
      expect(fila!.fixturesAgg).toEqual({ ino: 2, lvm: 1 });
    }

    // 2 -> 1
    const eng2 = makeEngine('2');
    eng2.bajantes.push({
      id: 'MAF2',
      net: 'af',
      tipo: 'montante',
      x: 10,
      y: 10,
    } as never);
    applyBajanteAssociation(
      eng2,
      {
        planId: '2',
        id: 'MAF2',
        x: 10,
        y: 10,
        net: 'af',
        dNominal: '3/4"',
        code: 'MAF2',
        nivelN: 1,
        npt: 320,
        tipo: 'montante',
      } as never,
      {
        planId: '1',
        id: 'MAF1',
        x: 30,
        y: 30,
        net: 'af',
        dNominal: '3/4"',
        code: 'MAF1',
        nivelN: 0,
        npt: 0,
        tipo: 'montante',
      } as never,
      PLANS,
    );

    // El montante del piso 1 (y su Ldesvio) con los MISMOS 3 UC. En presión la carga viaja
    // por UN camino (Ldesvio → montante → sus ramales de salida): el ramal que LLEGA al
    // montante (aguas arriba) no la carga — viene de arriba, no de abajo.
    expect(apos()['af_LD_MAF2_1']).toEqual({ ino: 2, lvm: 1 });
  });
});
