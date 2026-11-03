import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessoryOptions } from '../../../utils/accessoryOptions.ts';
import { calcHydroAccessories } from '../networkSanitary.ts';
import { drawValveSymbols } from '../renderers/accValves.ts';
import type { IPlanoEngineCore } from '../PlanoState.ts';

// Rociador rci (Red Contra Incendio) — FASE 2 RCI: accesorio del cuerpo/extremo del ramal,
// visible SOLO en rci, glifo círculo con cruz (+). La extracción de diseño (Fase 3) cuenta los
// rociadores por ramal leyendo los accMed/accesorios de extremo con id 'rociador' — el conteo
// hidro (calcHydroAccessories) ya los suma a tramo_hidro_data_v3 como cualquier accesorio.

const storageMock: Record<string, unknown> = {};
vi.mock('../../../services/storageService.ts', () => ({
  loadFromStorage: vi.fn((k: string, fb: unknown) => storageMock[k] ?? fb),
  saveToStorage: vi.fn((k: string, v: unknown) => {
    storageMock[k] = v;
  }),
}));

beforeEach(() => {
  delete storageMock['tramo_hidro_data_v3'];
});

describe('rociador: visibilidad SOLO rci en el dropdown de accesorios', () => {
  it("getAccessoryOptions('rci') incluye 'rociador'", () => {
    const ids = getAccessoryOptions('rci').map((o) => o.value);
    expect(ids).toContain('rociador');
  });
  it.each(['af', 'ac', 'rec', 'gas', 'san', 'll', 'vent'])(
    "getAccessoryOptions('%s') NO ofrece 'rociador'",
    (net) => {
      const ids = getAccessoryOptions(net).map((o) => o.value);
      expect(ids).not.toContain('rociador');
    },
  );
});

describe('rociador: conteo hidro por ramal (contrato Fase 3)', () => {
  it('accMed ×2 + extremo ×1 → accesorios.rociador = 3 en tramo_hidro_data_v3', () => {
    const ramales = [
      {
        id: 'RRCI1',
        net: 'rci',
        tipo: 'ramal',
        accMed: { accMed1: 'rociador', accMed2: 'rociador' },
        accesorioFin: 'rociador',
      },
      // Un ramal af con el MISMO accMed NO debe heredar el conteo (rci es por ramal propio).
      {
        id: 'RAF1',
        net: 'af',
        tipo: 'ramal',
        accMed: { accMed1: 'valvCompuerta' },
      },
    ];
    const eng = {
      _loadedPlanId: '1',
      ramales,
      bajantes: [],
      _hiddenNets: new Set<string>(),
    } as unknown as IPlanoEngineCore;
    calcHydroAccessories(eng);
    const hidro = storageMock['tramo_hidro_data_v3'] as Record<
      string,
      { accesorios: Record<string, number> }
    >;
    expect(hidro['rci_RRCI1_1'].accesorios['rociador']).toBe(3);
    expect(hidro['af_RAF1_1'].accesorios['rociador']).toBeUndefined();
  });
});

describe('rociador: glifo círculo + cruz en la familia de válvulas', () => {
  function mkCtx(): CanvasRenderingContext2D {
    return new Proxy(
      {},
      {
        get: (_t, prop) => (prop === 'canvas' ? {} : () => undefined),
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
  }
  const engine = { zoom: 1, lineWidthScale: 1 } as unknown as IPlanoEngineCore;
  const baseArgs = {
    ctx: mkCtx(),
    engine,
    c: { x: 100, y: 100 },
    dx: 1,
    dy: 0,
    px: 0,
    py: 1,
    outX: 0,
    outY: 1,
    rad: 10,
  };
  it("drawValveSymbols reconoce 'rociador' (true)", () => {
    expect(drawValveSymbols({ ...baseArgs, accType: 'rociador' })).toBe(true);
  });
  it('las válvulas existentes siguen dibujando (sin regresión)', () => {
    expect(drawValveSymbols({ ...baseArgs, accType: 'valvCompuerta' })).toBe(true);
    expect(drawValveSymbols({ ...baseArgs, accType: 'valvCheque' })).toBe(true);
  });
  it("tipos de otra familia ('teeSube') no los dibuja esta familia (false)", () => {
    expect(drawValveSymbols({ ...baseArgs, accType: 'teeSube' })).toBe(false);
  });
});
