import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessoryOptions } from '../../../utils/accessoryOptions.ts';
import { calcHydroAccessories } from '../networkSanitary.ts';
import { drawValveSymbols } from '../renderers/accValves.ts';
import { drawRciSymbols } from '../renderers/accRci.ts';
import type { IPlanoEngineCore } from '../PlanoState.ts';

// Rociadores y riostras rci (Red Contra Incendio) — simbología del PDF de referencia: los 6
// rociadores (colgante, montante, colgante seco, de pared, oculto, que fluye) y las 3 riostras
// sísmicas (transversal, longitudinal, cuatro vías) viven SOLO en rci. La extracción de diseño
// (Fase 3) cuenta los rociadores por ramal leyendo los accMed/accesorios de extremo con id
// 'rociador*' (RE_ROCIADOR = /rociador/i en ExtractNetwork.ts) — las riostras no son equipos de
// flujo y no entran al conteo.
const RCI_NUEVOS = [
  'rociadorMontante',
  'rociadorSeco',
  'rociadorPared',
  'rociadorOculto',
  'rociadorArea',
  'riostraLat',
  'riostraLon',
  'riostra4v',
];

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
  it("getAccessoryOptions('rci') ofrece los 8 rociadores/riostras nuevos", () => {
    const ids = getAccessoryOptions('rci').map((o) => o.value);
    for (const id of RCI_NUEVOS) expect(ids).toContain(id);
  });
  it.each(['af', 'ac', 'rec', 'gas', 'san', 'll', 'vent'])(
    "getAccessoryOptions('%s') NO ofrece rociadores ni riostras rci",
    (net) => {
      const ids = getAccessoryOptions(net).map((o) => o.value);
      for (const id of RCI_NUEVOS) expect(ids).not.toContain(id);
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

describe('rociador: glifo círculo + X en la familia de válvulas', () => {
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

  it.each(RCI_NUEVOS)("drawRciSymbols reconoce '%s' (true)", (accType) => {
    expect(drawRciSymbols({ ...baseArgs, accType })).toBe(true);
  });
  it.each(['valvCompuerta', 'teeSube', 'codo90rm', 'sifon', 'rociador'])(
    "drawRciSymbols rechaza '%s' de otra familia (false)",
    (accType) => {
      expect(drawRciSymbols({ ...baseArgs, accType })).toBe(false);
    },
  );
});
