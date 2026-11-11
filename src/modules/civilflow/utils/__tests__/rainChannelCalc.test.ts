import { describe, it, expect } from 'vitest';
import { calcularFilaCanal } from '../rainChannelCalc.ts';
import { BORDE_LIBRE_CANAL_CM } from '../calcRainwater.ts';

/**
 * Una fila de canal de lluvias se calcula sola (sin React): C solo del material de
 * cubierta, n del material de canal y la embocadura de los bajantes asociados.
 * Ej: 200 m² a 100 mm/h con C 0.7 → Qreal 3.89 L/s que la canaleta PVC debe llevar.
 */

const filaBase = {
  id: 'c1',
  drawId: 'c1', // el id del canal dibujado: por él se buscan los chips de bajantes
  materialCubierta: 'Cubierta plana con grava', // C = 0.7
  materialCanal: 'PVC', // n = 0.010
  areaAcumulada: 200,
  intensidad: 100,
  pendiente: 1,
  b: 20,
  h: 15,
  muroVertical: 0,
};

describe('calcularFilaCanal · hidráulica de una fila de canal', () => {
  it('fila completa: C y n derivados del catálogo, Qreal por método racional y sección "b x (h+borde)"', () => {
    const r = calcularFilaCanal(filaBase, {}, {});
    expect(r.Cder).toBe(0.7);
    expect(r.nder).toBe(0.01);
    expect(r.Qreal).toBeCloseTo(3.89, 2); // (200·100·0.7)/3600 = 3.888… → redondeo a 2 dec
    expect(r.totalStr).toBe('20x25'); // b 20 cm, h 15 + borde libre 10
    expect(r.calc).not.toBeNull();
    expect(r.calc!.aEfectiva).toBe(200);
  });

  it('el muro vertical llueve a la mitad: área efectiva = cubierta + 0.5·muro', () => {
    const r = calcularFilaCanal({ ...filaBase, muroVertical: 10 }, {}, {});
    expect(r.aEfectivaSiempre).toBe(205); // 200 + 0.5·10
    expect(r.calc!.aEfectiva).toBe(205);
  });

  it('sin material de canal NO hay cálculo (ni fallback de Manning): calc null y Qreal 0', () => {
    const r = calcularFilaCanal({ ...filaBase, materialCanal: '' }, {}, {});
    expect(r.nder).toBeNull();
    expect(r.calc).toBeNull();
    expect(r.Qreal).toBe(0);
    expect(r.chequeo).toBe('');
    expect(r.emb).toEqual({ Hreq: 0, chequeo: '' });
  });

  it('material de canal desconocido tampoco calcula (nDeCanal null)', () => {
    const r = calcularFilaCanal({ ...filaBase, materialCanal: 'Cartón' }, {}, {});
    expect(r.nder).toBeNull();
    expect(r.calc).toBeNull();
  });

  it('C de cubierta desconocida cae a 0 (guard: sin material no dispara el cálculo)', () => {
    const r = calcularFilaCanal({ ...filaBase, materialCubierta: 'Oro' }, {}, {});
    expect(r.Cder).toBe(0);
  });

  it('los valores ausentes de muroVertical y bordeLibreCm usan sus defaults (0 y 10 cm)', () => {
    const r = calcularFilaCanal(
      {
        materialCubierta: 'Paja / palma',
        materialCanal: 'PVC',
        areaAcumulada: 100,
        intensidad: 80,
        b: 10,
        h: 5,
      },
      {},
      {},
    );
    expect(r.Cder).toBe(0.6);
    expect(r.aEfectivaSiempre).toBe(100);
    expect(r.totalStr).toBe(`10x${5 + BORDE_LIBRE_CANAL_CM}`);
  });

  it('bajantes asociados: ds toma el diámetro de cada chip (>0) y la embocadura reparte Qreal', () => {
    const r = calcularFilaCanal(filaBase, { b1: 4, b2: 3, b3: 0 }, { c1: ['b1', 'b2', 'b3'] });
    expect(r.ds).toEqual([4, 3]); // el chip sin diámetro (0) se filtra
    // dato: el tipo de `emb` solo declara Hreq/chequeo, pero el runtime trae QporBajante
    expect((r.emb as unknown as { QporBajante: number }).QporBajante).toBeCloseTo(3.89 / 3, 1); // Q repartido entre TODOS los chips, incluso el sin D
    expect(r.emb.Hreq).toBeGreaterThan(0);
    expect(['Ok', 'No cumple']).toContain(r.emb.chequeo);
  });

  it('canal sin drawId no mira chips: ds vacío y "Revisar bajante" (Q>0 con 0 bajantes)', () => {
    const r = calcularFilaCanal({ ...filaBase, drawId: undefined }, { b1: 4 }, { otro: ['b1'] });
    expect(r.ds).toEqual([]);
    expect(r.emb.Hreq).toBe(0); // sin bajantes no hay H req que calcular
    expect(r.emb.chequeo).toBe('Revisar bajante');
  });
});
