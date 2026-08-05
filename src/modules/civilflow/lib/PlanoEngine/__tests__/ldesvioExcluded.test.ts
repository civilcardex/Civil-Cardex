import { describe, it, expect, vi } from 'vitest';
import { SAN_SYNC_KEY, HYDRO_DATA_STORAGE_KEY } from '../../../constants/storage-keys';
import { isLdesvioRamalId, ldesvioIdFor } from '../../../utils/associateBajanteAcrossFloors';
import { _renumberRamales } from '../networkRenumber';
import { loadSanLlTramos } from '../../../utils/buildTramos';
import type { IPlanoEngineCore, PlanoRamal } from '../PlanoState';

// Ldesvio connector ramales (id `LD_<bajanteId>`) are drawing aids, not hydraulic pipes. They
// must never leak into design tables (bogus empty tramos like "RS1") nor get renamed by the
// renumber pass (which would turn `LD_BAN2` into a real-looking `RS1` with no data).

const sanSyncFixture = {
  planes: {
    san_1: {
      planoId: '1',
      ramales: [
        {
          id: 'LD_BAN2',
          label: 'R9',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 0],
            [10, 0],
          ],
        },
        {
          id: 'RS1',
          label: 'RS1',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 10],
            [10, 10],
          ],
        },
        {
          id: 'RS2',
          label: 'RS2',
          net: 'san',
          tipo: 'ramal',
          pts: [
            [0, 20],
            [10, 20],
          ],
        },
      ],
    },
  },
  aparatosByTramo: {},
  updatedAt: 0,
};

vi.mock('../../../services/storageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/storageService')>();
  return {
    ...actual,
    loadFromStorage: vi.fn((key: string, fallback: unknown) => {
      if (key === SAN_SYNC_KEY) return sanSyncFixture;
      if (key === HYDRO_DATA_STORAGE_KEY) return {};
      return fallback;
    }),
    saveToStorage: vi.fn(),
  };
});

function makeRamal(id: string, net = 'san'): PlanoRamal {
  return {
    id,
    net,
    tipo: 'ramal',
    padre: null,
    pts: [
      [0, 0],
      [10, 0],
    ],
    totalL: 5,
    label: id,
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
    pendiente: 0,
    bloqueado: true,
  } as PlanoRamal;
}

function makeEngine(ramales: PlanoRamal[]): IPlanoEngineCore {
  const engine: Partial<IPlanoEngineCore> = {
    ramales,
    bajantes: [],
    _netCounts: {
      san: { ramal: 0, tributario: 0 },
      ll: { ramal: 0, tributario: 0 },
    },
    _loadedPlanId: '1',
  };
  return engine as IPlanoEngineCore;
}

describe('isLdesvioRamalId', () => {
  it('matches LD_ ids and nothing else', () => {
    expect(isLdesvioRamalId(ldesvioIdFor('BAN2'))).toBe(true);
    expect(isLdesvioRamalId('LD_RS1')).toBe(true);
    expect(isLdesvioRamalId('RS1')).toBe(false);
    expect(isLdesvioRamalId(null)).toBe(false);
    expect(isLdesvioRamalId(undefined)).toBe(false);
    expect(isLdesvioRamalId('')).toBe(false);
  });
});

describe('_renumberRamales — Ldesvio excluded', () => {
  it('renumbers only real ramales, leaves LD_ ids untouched, counts exclude LD_', () => {
    const engine = makeEngine([makeRamal('LD_BAN2'), makeRamal('RS3'), makeRamal('RS1')]);
    _renumberRamales(engine, 'san');
    const ids = engine.ramales.map((r) => r.id).sort();
    expect(ids).toEqual(['LD_BAN2', 'RS1', 'RS2']);
    expect(engine._netCounts.san.ramal).toBe(2);
  });

  it('does not renumber a san network containing only an Ldesvio', () => {
    const engine = makeEngine([makeRamal('LD_BAN2')]);
    _renumberRamales(engine, 'san');
    expect(engine.ramales[0].id).toBe('LD_BAN2');
    expect(engine._netCounts.san.ramal).toBe(0);
  });
});

describe('loadSanLlTramos — Ldesvio excluded', () => {
  it('skips LD_ ramales when building sanIncoming', () => {
    const { sanIncoming, llIncoming } = loadSanLlTramos();
    const ids = sanIncoming.map((t) => t.id);
    expect(ids).toEqual(['RS1', 'RS2']);
    expect(ids).not.toContain('LD_BAN2');
    expect(llIncoming).toHaveLength(0);
  });
});
