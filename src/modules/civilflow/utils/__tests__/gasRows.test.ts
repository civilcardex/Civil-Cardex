import { describe, it, expect, beforeEach } from 'vitest';
import { computeGasRows, lookupDn, listaDn, GAS_DATOS_DEFAULT } from '../gasRows.ts';
import { GAS } from '../../constants/engineeringDataGas.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

/**
 * La tabla de gas para reportes lee storage (mismo cálculo que la pantalla viva):
 * tramos de ramales net:'gas' de planos confirmados → Renouard (fórmula de pérdida
 * en gas). Ej: un tramo de 10 m en cobre 1/2" sin aparatos cae al piso de diseño 2.7 m³/h.
 */

beforeEach(() => {
  localStorage.clear();
});

const plan = (id = 'p1', nivel = 0): PlanItem =>
  ({ id, status: 'confirmed', nivel }) as unknown as PlanItem;

const tramoGas = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  net: 'gas',
  ini: '',
  fin: '',
  totalL: 10,
  material: 'Cobre rígido',
  diametro: '1/2"',
  pts: [
    [0, 0],
    [10, 0],
  ],
  piso: 0,
  ...over,
});

describe('lookupDn / listaDn · catálogo de diámetros de gas', () => {
  it('busca por material + etiqueta y devuelve K y diámetro interior', () => {
    const hit = lookupDn('Cobre rígido', '1/2"');
    expect(hit).toMatchObject({ mat: 'Cobre rígido', K: 54.2, dn: '1/2"', d: 10.9 });
  });

  it('normaliza la etiqueta (¾" unicode → 3/4") antes de buscar', () => {
    expect(lookupDn('Acero galvanizado', '¾"')).toMatchObject({ d: 19.0, dn: '3/4"' });
  });

  it('PEAD resuelve a las filas de PE al PE (la tabla no trae filas propias)', () => {
    const pe = lookupDn('PE al PE', '1/2"');
    expect(pe).not.toBeNull();
    expect(lookupDn('PEAD', '1/2"')).toMatchObject({ mat: 'PE al PE', d: pe!.d });
  });

  it('material o diámetro inexistente → null (no inventa diámetro interior)', () => {
    expect(lookupDn('Vidrio', '1/2"')).toBeNull();
    expect(lookupDn('Cobre rígido', '99"')).toBeNull();
  });

  it('listaDn expone el catálogo completo aplanado por material', () => {
    const total = GAS.reduce((s, g) => s + g.rows.length, 0);
    expect(listaDn()).toHaveLength(total);
    expect(listaDn()[0]).toHaveProperty('mat');
    expect(listaDn()[0]).toHaveProperty('K');
    expect(listaDn()[0]).toHaveProperty('d');
  });
});

describe('computeGasRows · filas de la tabla de gas desde storage', () => {
  it('datos por defecto de Bogotá cuando no hay storage', () => {
    expect(GAS_DATOS_DEFAULT).toMatchObject({
      alt: '959',
      patm: '90.32',
      temp: '23',
      pmin: '17',
      densRel: '0.67',
    });
  });

  it('un tramo de 10 m en cobre 1/2" sin aparatos: qDiseno cae al piso de 2.7 m³/h y Renouard da su dP', () => {
    localStorage.setItem('civilflow_trazos_p1', JSON.stringify({ ramales: [tramoGas()] }));
    const rows = computeGasRows([plan()]);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r).toMatchObject({
      id: 'g1',
      piso: 0,
      material: 'Cobre rígido',
      dn: '1/2"',
      dInt: 10.9,
      K: 54.2,
      longitud: 10,
      qConsumo: 0,
    });
    // sin aparatos qRenouard = 0 → el piso normativo manda: qDiseno = 2.7 m³/h
    expect(r.qDiseno).toBe(2.7);
    // Renouard: dP = 23200·L·q^1.82/d^4.82·DR^0.82 (replicado de gasCalcRows)
    const dPRep =
      ((23200 * 10 * Math.pow(2.7, 1.82)) / Math.pow(10.9, 4.82)) * Math.pow(0.67, 0.82);
    expect(r.dP).toBeCloseTo(dPRep, 6);
    expect(r.dPAcum).toBe(r.dP); // único tramo: acumulado = propio
    // presión de la raíz nace de pMin (17 mbar del dato guardado/default)
    expect(r.pIni).toBe(17);
    expect(r.pFin).toBeCloseTo(17 - r.dP, 6);
    // velocidad Renouard: 354·q·101.325/d²/pAtm (90.32 kPa de Bogotá)
    expect(r.vel).toBeCloseTo((354 * 2.7 * 101.325) / (10.9 * 10.9) / 90.32, 6);
    expect(['O.K.', 'NO', '—']).toContain(r.chequeo);
    expect(r.fAlt).toBeCloseTo(1.12, 2); // 101.325/90.32 → round2
  });

  it('los aparatos por tramo (storage) suben el caudal de diseño', () => {
    localStorage.setItem('civilflow_trazos_p1', JSON.stringify({ ramales: [tramoGas()] }));
    // clave aparatos: gas_{id} o gas_{id}_{planId}; estufa 2Q = 0.68 m³/h y el ÚNICO tipo
    // presente cuenta a la mitad (Renouard): (0.68·40)/2 = 13.6
    localStorage.setItem(
      'civilflow_aparatos_by_tramo_v2',
      JSON.stringify({ gas_g1: { est2: 40 } }),
    );
    const rows = computeGasRows([plan()]);
    expect(rows[0].qConsumo).toBeCloseTo(13.6, 9);
    // 13.6 × fAlt 1.12 × fTemp 0.99 × fDens 1 → round2 = 15.08 (> piso 2.7)
    expect(rows[0].qDiseno).toBe(15.08);
  });

  it('pocos aparatos: el piso normativo de 2.7 m³/h manda aunque Renouard dé menos', () => {
    localStorage.setItem('civilflow_trazos_p1', JSON.stringify({ ramales: [tramoGas()] }));
    localStorage.setItem('civilflow_aparatos_by_tramo_v2', JSON.stringify({ gas_g1: { est2: 4 } }));
    const rows = computeGasRows([plan()]);
    expect(rows[0].qConsumo).toBe(1.36); // (0.68·4)/2
    expect(rows[0].qDiseno).toBe(2.7); // 1.36×1.12×0.99 = 1.51 < 2.7
  });

  it('los planos no confirmados o sin nivel se saltan; sin trazos no hay filas', () => {
    localStorage.setItem('civilflow_trazos_p1', JSON.stringify({ ramales: [tramoGas()] }));
    expect(
      computeGasRows([{ id: 'p1', status: 'draft', nivel: 0 } as unknown as PlanItem]),
    ).toEqual([]);
    expect(
      computeGasRows([{ id: 'p1', status: 'confirmed', nivel: null } as unknown as PlanItem]),
    ).toEqual([]);
    expect(computeGasRows([plan('p9')])).toEqual([]);
  });

  it('solo ramales net gas: los de otras redes no entran a la tabla', () => {
    localStorage.setItem(
      'civilflow_trazos_p1',
      JSON.stringify({ ramales: [tramoGas(), tramoGas({ id: 'raf1', net: 'af' })] }),
    );
    const rows = computeGasRows([plan()]);
    expect(rows.map((r) => r.id)).toEqual(['g1']);
  });

  it('tramo con material/diámetro sin catálogo: dInt 0 y K 0 pero la fila existe', () => {
    localStorage.setItem(
      'civilflow_trazos_p1',
      JSON.stringify({ ramales: [tramoGas({ material: 'Vidrio', diametro: '99"' })] }),
    );
    const rows = computeGasRows([plan()]);
    expect(rows[0]).toMatchObject({ dn: '99"', dInt: 0, K: 0 });
  });

  it('pmin guardado en datos generales manda como presión de la raíz', () => {
    localStorage.setItem(
      'civilflow_gas_datos_generales',
      JSON.stringify({ ...GAS_DATOS_DEFAULT, pmin: '22' }),
    );
    localStorage.setItem('civilflow_trazos_p1', JSON.stringify({ ramales: [tramoGas()] }));
    expect(computeGasRows([plan()])[0].pIni).toBe(22);
  });
});
