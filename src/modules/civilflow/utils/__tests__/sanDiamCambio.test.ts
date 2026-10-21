import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pines del movimiento sanDiamChange (Oleada 1): el BFS de propagación del mayor diámetro
// sanitario con ESCRITURA REAL al storage (writeDiametroToDrawing) y bloqueos de guardia.

const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
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
vi.stubGlobal('window', {
  dispatchEvent: (e: Event) => {
    eventos.push(e);
  },
  addEventListener: () => {},
  removeEventListener: () => {},
});

const eventos: Event[] = [];

import { saveToStorage, loadFromStorage } from '../../services/almacenamientoServicio.ts';
import { aplicarCambioDiametroSan, type SanDiamChangeCtx } from '../../components/sanDiamCambio.ts';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlanosContexto.tsx';

const PLAN_ID = 5;
const PLANOS = [{ id: String(PLAN_ID), status: 'confirmed' }] as unknown as PlanItem[];

const T = (o: Partial<Tramo>): Tramo =>
  ({
    id: 'RS1',
    label: 'RS1',
    net: 'san',
    tipo: 'ramal',
    _key: `RS1-${PLAN_ID}`,
    planId: PLAN_ID,
    piso: String(PLAN_ID),
    diamDisPulg: 2,
    material: 'PVC-S',
    ...o,
  }) as unknown as Tramo;

/** Trazos crudos que writeDiametroToDrawing lee: ramal con el diámetro en label. */
function seedTrazos(ramales: Array<{ id: string; diametro: string; pts?: number[][] }>): void {
  saveToStorage(`trazos_${PLAN_ID}`, {
    ramales: ramales.map((r) => ({
      id: r.id,
      net: 'san',
      tipo: 'ramal',
      pts: r.pts ?? [
        [0, 0],
        [40, 0],
      ],
      diametro: r.diametro,
    })),
    bajantes: [],
  });
}

function ctxDe(
  tramos: Tramo[],
  fullChildrenMap: Record<string, string[]> | null,
): { ctx: SanDiamChangeCtx; escritos: Record<string, number> } {
  const escritos: Record<string, number> = {};
  return {
    ctx: {
      tramosSan: tramos,
      fullChildrenMap,
      plans: PLANOS,
      updTramoSan: (id, field, val) => {
        if (field === 'diamDisPulg') escritos[id] = val as number;
        const t = tramos.find((x) => (x._key || x.id) === id);
        if (t && field === 'diamDisPulg')
          (t as { diamDisPulg?: number }).diamDisPulg = val as number;
      },
    },
    escritos,
  };
}

describe('aplicarCambioDiametroSan (pines del movimiento sanDiamChange)', () => {
  it('BFS: subir el diámetro del tronco arrastra al downstream con menor diámetro (escritura real)', () => {
    // fullChildrenMap: parent(downstream) → children(upstream). Cadena RS2 →(descarga en)→
    // RS1 →(descarga en)→ RS0. Subir RS1 a 4" arrastra SOLO a su downstream RS0 (2"→4");
    // RS2 está aguas arriba: sin cambio.
    seedTrazos([
      { id: 'RS0', diametro: '2"' },
      { id: 'RS1', diametro: '2"' },
      { id: 'RS2', diametro: '2"' },
    ]);
    const tramos = [
      T({ id: 'RS0', _key: `RS0-${PLAN_ID}`, diamDisPulg: 2 }),
      T({ id: 'RS1', _key: `RS1-${PLAN_ID}`, diamDisPulg: 2 }),
      T({ id: 'RS2', _key: `RS2-${PLAN_ID}`, diamDisPulg: 2 }),
    ];
    const { ctx, escritos } = ctxDe(tramos, { 'RS0-5': ['RS1-5'], 'RS1-5': ['RS2-5'] });
    aplicarCambioDiametroSan(`RS1-${PLAN_ID}`, 4, ctx);
    expect(escritos[`RS1-${PLAN_ID}`]).toBe(4);
    expect(escritos[`RS0-${PLAN_ID}`]).toBe(4);
    expect(escritos[`RS2-${PLAN_ID}`]).toBeUndefined();
    // Escritura REAL al dibujo (writeDiametroToDrawing persiste en trazos_<planId>).
    const trazos = loadFromStorage<{ ramales: Array<{ id: string; diametro?: string }> } | null>(
      `trazos_${PLAN_ID}`,
      null,
    );
    const rs0 = trazos?.ramales.find((r) => r.id === 'RS0');
    expect(rs0?.diametro).toBe('4"');
  });

  it('hijo que ME DESCARGA con mayor diámetro bloquea la bajada (sanMaxFeederDiam)', () => {
    seedTrazos([
      { id: 'RS1', diametro: '4"' },
      { id: 'RS2', diametro: '4"' },
    ]);
    const tramos = [
      T({ id: 'RS1', _key: `RS1-${PLAN_ID}`, diamDisPulg: 4 }),
      T({ id: 'RS2', _key: `RS2-${PLAN_ID}`, diamDisPulg: 4 }),
    ];
    const { ctx, escritos } = ctxDe(tramos, { 'RS1-5': ['RS2-5'] });
    aplicarCambioDiametroSan(`RS1-${PLAN_ID}`, 2, ctx);
    // El hijo RS2 (me descarga, 4") fija el mínimo: RS1 no baja.
    expect(escritos[`RS1-${PLAN_ID}`]).toBeUndefined();
  });

  it('inodoro en el tramo → no permite bajar de 4"', () => {
    seedTrazos([{ id: 'RS1', diametro: '4"' }]);
    saveToStorage('aparatos_by_tramo_v2', { [`san_RS1_${PLAN_ID}`]: { san: 1 } });
    const tramos = [T({ id: 'RS1', _key: `RS1-${PLAN_ID}`, diamDisPulg: 4 })];
    const { ctx, escritos } = ctxDe(tramos, null);
    aplicarCambioDiametroSan(`RS1-${PLAN_ID}`, 3, ctx);
    expect(escritos[`RS1-${PLAN_ID}`]).toBeUndefined();
    const trazos = loadFromStorage<{ ramales: Array<{ id: string; diametro?: string }> } | null>(
      `trazos_${PLAN_ID}`,
      null,
    );
    expect(trazos?.ramales[0]?.diametro).toBe('4"');
  });
});
