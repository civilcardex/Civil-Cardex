import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { clearBajanteAssociation } from '../bajanteAssociation';
import { ldesvioIdFor } from '../associateBajanteAcrossFloors';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState';

// Desasociar desde el piso SUPERIOR (dueño del descargaEnId, vía desplegable Destino)
// debe retirar también el fantasma VIVO del piso abierto (punteada + cuarto de círculo).
// Antes solo se filtraba si el cargado era el TARGET y el fantasma quedaba pintado.

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
] as never[];

const readTrazos = (pid: string) =>
  JSON.parse(localStorage.getItem('civilflow_' + TRAZOS_PREFIX + pid) || '{}') as {
    bajantes?: Array<Record<string, unknown>>;
    ramales?: Array<Record<string, unknown>>;
    crossFloorGhosts?: Array<Record<string, unknown>>;
  };

function seed() {
  const LD = ldesvioIdFor('BAN1');
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '2',
    JSON.stringify({
      bajantes: [
        {
          id: 'BAN1',
          net: 'san',
          tipo: 'bajante',
          code: 'BAN1',
          x: 0,
          y: 0,
          descargaEnId: '1|BAN2',
          dNominal: '4"',
        },
      ],
      ramales: [],
      crossFloorGhosts: [
        { id: 'XFG_BAN2_1', sourcePlanId: '1', sourceBajanteId: 'BAN2', targetBajanteId: 'BAN1' },
        // Otro enlace (cruzado): no se toca.
        { id: 'XFG_BAN9_1', sourcePlanId: '1', sourceBajanteId: 'BAN9', targetBajanteId: 'BAN8' },
      ],
    }),
  );
  localStorage.setItem(
    'civilflow_' + TRAZOS_PREFIX + '1',
    JSON.stringify({
      bajantes: [
        {
          id: 'BAN2',
          net: 'san',
          tipo: 'bajante',
          code: 'BAN2',
          x: 30,
          y: 30,
          origenId: '2|BAN1',
          dNominal: '4"',
        },
      ],
      ramales: [
        {
          id: LD,
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [1, 1],
          ],
          label: 'LD',
        },
      ],
      crossFloorGhosts: [],
    }),
  );
  return LD;
}

function makeEngineUpper() {
  const engine = {
    ramales: [],
    bajantes: [
      {
        id: 'BAN1',
        net: 'san',
        tipo: 'bajante',
        code: 'BAN1',
        x: 0,
        y: 0,
        descargaEnId: '1|BAN2',
        dNominal: '4"',
      },
    ],
    crossFloorGhosts: [
      { id: 'XFG_BAN2_1', sourcePlanId: '1', sourceBajanteId: 'BAN2', targetBajanteId: 'BAN1' },
      { id: 'XFG_BAN9_1', sourcePlanId: '1', sourceBajanteId: 'BAN9', targetBajanteId: 'BAN8' },
    ],
    _loadedPlanId: '2',
    updateElementById(id: string, upd: Record<string, unknown>) {
      const b = (engine.bajantes as unknown as Array<Record<string, unknown>>).find(
        (x) => x.id === id,
      );
      if (b) Object.assign(b, upd);
    },
  } as unknown as IPlanoEngineCore;
  return engine;
}

describe('clearBajanteAssociation desde el superior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retira fantasma vivo + LD + punteros; el enlace cruzado sobrevive', () => {
    const LD = seed();
    const eng = makeEngineUpper();

    clearBajanteAssociation(eng, '2', 'BAN1', 'san', '1|BAN2', PLANS);

    // Motor vivo del piso abierto: sin fantasma (punteada + cuarto de círculo fuera).
    expect(eng.crossFloorGhosts).toHaveLength(1);
    expect((eng.crossFloorGhosts[0] as { id: string }).id).toBe('XFG_BAN9_1');
    // Storage: fantasma fuera del superior, LD fuera del inferior.
    expect(readTrazos('2').crossFloorGhosts ?? []).toHaveLength(1);
    expect((readTrazos('1').ramales ?? []).map((r) => r.id)).not.toContain(LD);
    // Punteros del enlace, nulos en ambos lados.
    const upperBan = readTrazos('2').bajantes?.find((b) => b.id === 'BAN1');
    const lowerBan = readTrazos('1').bajantes?.find((b) => b.id === 'BAN2');
    expect(upperBan?.descargaEnId ?? null).toBeNull();
    expect(lowerBan?.origenId ?? null).toBeNull();
    const liveBan = (eng.bajantes as unknown as Array<Record<string, unknown>>).find(
      (b) => b.id === 'BAN1',
    );
    expect(liveBan?.descargaEnId ?? null).toBeNull();
  });
});
