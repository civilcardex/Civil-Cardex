import { describe, it, expect, beforeEach } from 'vitest';
import { bombsImmediateLowerFloor, bajantesImmediateUpperFloor } from '../pumpQueries.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

/**
 * Los desplegables de asociación bomba↔bajante entre pisos: solo el piso INMEDIATO
 * (el más cercano) y solo planos confirmados. Ej: estando en Piso 2, la bomba del
 * Sótano 1 aparece aunque también exista una en Sótano -2.
 */

beforeEach(() => {
  localStorage.clear();
});

const plan = (id: string, nivel: number, status = 'confirmed'): PlanItem =>
  ({ id, nivel, status }) as unknown as PlanItem;

const trazos = (planId: string, bajantes: unknown[]) => {
  localStorage.setItem('civilflow_trazos_' + planId, JSON.stringify({ bajantes }));
};

const bomba = (over: Record<string, unknown>) => ({
  id: 'bm1',
  tipo: 'bomba',
  net: 'san',
  x: 11,
  y: 22,
  code: undefined,
  cajaOrigenId: undefined,
  ...over,
});

describe('bombsImmediateLowerFloor · bombas del piso de abajo', () => {
  it('lista las bombas del piso inferior inmediato con piso, caja y posición', () => {
    trazos('p1', [
      bomba({ id: 'bm1', code: 'BOM1', cajaOrigenId: 'cj9' }),
      bomba({ id: 'bm2', tipo: 'bajante' }), // no es bomba: fuera
    ]);
    const rows = bombsImmediateLowerFloor([plan('p1', 0), plan('p2', 1)], 'p2');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      planId: 'p1',
      id: 'bm1',
      code: 'BOM1',
      caja: 'cj9',
      nivel: 'Piso 0',
      nivelN: 0,
      x: 11,
      y: 22,
      net: 'san',
    });
  });

  it('el piso inmediato es el MÁXIMO de los menores: ignora bombas dos pisos abajo', () => {
    trazos('p1', [bomba({ id: 'bmCercana' })]); // Sótano/estacionamiento justo abajo (nivel 1)
    trazos('p0', [bomba({ id: 'bmProfunda' })]); // dos niveles abajo: fuera
    const rows = bombsImmediateLowerFloor([plan('p0', 0), plan('p1', 1), plan('p2', 2)], 'p2');
    expect(rows.map((r) => r.id)).toEqual(['bmCercana']);
  });

  it('sin bomba code cae al id, sin caja pone "—" y sin net pone "san"', () => {
    trazos('p1', [{ id: 'b-x', tipo: 'bomba' }]);
    const rows = bombsImmediateLowerFloor([plan('p1', -1), plan('p2', 0)], 'p2');
    expect(rows[0]).toMatchObject({ code: 'b-x', caja: '—', net: 'san' });
  });

  it('casos vacíos: plan actual inexistente, nivel no numérico o sin inferiores', () => {
    expect(bombsImmediateLowerFloor([plan('p1', 0)], 'nope')).toEqual([]);
    expect(bombsImmediateLowerFloor([plan('p1', null as never), plan('p2', 0)], 'p2')).toEqual([]);
    // solo hay plans de nivel ≥ al actual
    expect(bombsImmediateLowerFloor([plan('p2', 2), plan('p1', 1)], 'p1')).toEqual([]);
  });

  it('los planos no confirmados no aportan bombas', () => {
    trazos('p1', [bomba({ id: 'bmBorrador' })]);
    const rows = bombsImmediateLowerFloor([plan('p1', 0, 'draft'), plan('p2', 1)], 'p2');
    expect(rows).toEqual([]);
  });
});

describe('bajantesImmediateUpperFloor · bajantes del piso de arriba', () => {
  it('lista bajantes del piso superior inmediato con D nominal y enlace a bomba', () => {
    trazos('p2', [
      {
        id: 'ba1',
        tipo: 'bajante',
        code: 'BAN1',
        net: 'san',
        dNominal: '4"',
        x: 5,
        y: 6,
        bombaEnId: 'bm1',
      },
      { id: 'ba2', tipo: 'bomba' }, // no es bajante: fuera
    ]);
    const rows = bajantesImmediateUpperFloor([plan('p1', 0), plan('p2', 1)], 'p1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      planId: 'p2',
      id: 'ba1',
      code: 'BAN1',
      dNominal: '4"',
      nivel: 'Piso 1',
      nivelN: 1,
      bombaEnId: 'bm1',
    });
  });

  it('el piso inmediato es el MÍNIMO de los mayores; defaults cuando faltan datos', () => {
    trazos('p2', [{ id: 'baCerca', tipo: 'bajante' }]);
    trazos('p3', [{ id: 'baLejos', tipo: 'bajante' }]);
    const rows = bajantesImmediateUpperFloor([plan('p1', 0), plan('p2', 1), plan('p3', 2)], 'p1');
    expect(rows.map((r) => r.id)).toEqual(['baCerca']);
    expect(rows[0]).toMatchObject({ code: 'baCerca', dNominal: '', net: 'san', bombaEnId: null });
  });

  it('casos vacíos: sin plan actual o sin superiores', () => {
    expect(bajantesImmediateUpperFloor([plan('p1', 0)], 'nope')).toEqual([]);
    expect(bajantesImmediateUpperFloor([plan('p1', 0), plan('p0', -1)], 'p1')).toEqual([]);
  });
});
