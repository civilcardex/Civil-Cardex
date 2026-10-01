import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcHydroAccessories } from '../networkSanitary';
import type { IPlanoEngineCore } from '../PlanoState';

// Codos de canal SIN doble conteo (orig. usuario): el ramal de canal cuenta su codo 90° baja
// UNA sola vez (accesorioInicio en la salida del canal) — la inferencia por recibeDeIds de los
// bajantes ll NO debe sumarlo otra vez. Los ramales ll normales sí conservan la inferencia.

const storageMock: Record<string, unknown> = {};
vi.mock('../../../services/storageService', () => ({
  loadFromStorage: vi.fn((k: string, fb: unknown) => storageMock[k] ?? fb),
  saveToStorage: vi.fn((k: string, v: unknown) => {
    storageMock[k] = v;
  }),
}));

function makeEngine(ramales: unknown[], bajantes: unknown[]): IPlanoEngineCore {
  return {
    _loadedPlanId: '1',
    ramales,
    bajantes,
    _hiddenNets: new Set<string>(),
  } as unknown as IPlanoEngineCore;
}

const ramalBase = {
  net: 'll',
  tipo: 'ramal',
  padre: null,
  accMed: undefined,
  aparatoInicio: undefined,
  aparatoFin: undefined,
  nSalidas: 1,
};

beforeEach(() => {
  delete storageMock['tramo_hidro_data_v3'];
});

describe('codos 90° de canal sin doble conteo', () => {
  it('ramal de canal asociado a bajante (direccion baja) → 1 solo codo90rmBaja', () => {
    const eng = makeEngine(
      [
        {
          ...ramalBase,
          id: 'RS1',
          accesorioInicio: 'codo90rmBaja',
          esCanalId: 'CNL1-P1',
          pts: [
            [10, 10],
            [50, 100],
          ],
        },
      ],
      [
        {
          id: 'BAN1-P1',
          net: 'll',
          tipo: 'bajante',
          direccion: 'baja',
          recibeDeIds: ['RS1'],
        },
      ],
    );
    calcHydroAccessories(eng);
    const acc = (
      storageMock['tramo_hidro_data_v3'] as Record<string, { accesorios: Record<string, number> }>
    )['ll_RS1_1'].accesorios;
    expect(acc['codo90rmBaja']).toBe(1);
    expect(acc['codo90rmSube']).toBeUndefined();
  });

  it('ramal ll NORMAL asociado a bajante → la inferencia sigue contando su codo', () => {
    const eng = makeEngine(
      [
        {
          ...ramalBase,
          id: 'RS2',
          pts: [
            [10, 10],
            [50, 100],
          ],
        },
      ],
      [
        {
          id: 'BAN2-P1',
          net: 'll',
          tipo: 'bajante',
          direccion: 'baja',
          recibeDeIds: ['RS2'],
        },
      ],
    );
    calcHydroAccessories(eng);
    const acc = (
      storageMock['tramo_hidro_data_v3'] as Record<string, { accesorios: Record<string, number> }>
    )['ll_RS2_1'].accesorios;
    expect(acc['codo90rmBaja']).toBe(1);
  });
});
