import { describe, it, expect, beforeEach } from 'vitest';

/**
 * La lectura del doc de un plano estaba copiada en 6 sitios (tabla de bajantes, canales de
 * lluvias, bajantes de lluvia, contexto de lluvias, filas de bajante-vent y filas de
 * acometida). Esta es la fuente \u00fanica.
 */
const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  const g = globalThis as Record<string, unknown>;
  g.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => {
      mockStorage[k] = v;
    },
    removeItem: (k: string) => {
      delete mockStorage[k];
    },
    get length() {
      return Object.keys(mockStorage).length;
    },
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
  };
});

describe('leerDocDePlan', () => {
  it('devuelve null si el plano no est\u00e1 guardado', async () => {
    const { leerDocDePlan } = await import('../readPlanDrawing');
    expect(leerDocDePlan('99')).toBeNull();
  });

  it('parsea el doc guardado (string JSON) y devuelve el objeto', async () => {
    const { leerDocDePlan } = await import('../readPlanDrawing');
    mockStorage['civilflow_trazos_1'] = JSON.stringify({ ramales: [{ id: 'RS1' }] });
    const doc = leerDocDePlan<{ ramales: Array<{ id: string }> }>('1');
    expect(doc?.ramales[0].id).toBe('RS1');
  });

  it('devuelve null si el JSON est\u00e1 roto (no lanza)', async () => {
    const { leerDocDePlan } = await import('../readPlanDrawing');
    mockStorage['civilflow_trazos_2'] = '{roto';
    expect(leerDocDePlan('2')).toBeNull();
  });
});
