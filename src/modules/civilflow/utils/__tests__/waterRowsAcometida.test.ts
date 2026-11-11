import { describe, it, expect, beforeEach } from 'vitest';
import { computeAcometidaSummary } from '../waterRowsAcometida.ts';
import { matHazenC } from '../../constants/engineeringDataMaterials.ts';
import type { Tramo } from '../../context/tramosReducer.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';

/**
 * Panel de acometida como función pura (para la memoria, sin depender de la pantalla):
 * tramo Red Pública→Contador (AC-01) y Contador→Montante (AC-02), con Hazen-Williams.
 * Sin nada dibujado cae a sus defaults de pantalla: L1 10 m + 0.47 m de Le y L2 7.54 m.
 */

beforeEach(() => {
  localStorage.clear();
});

const DIAMS = [
  { pulg: 0.75, nominal: '3/4" RDE 11', dInt: 21 },
  { pulg: 1.25, nominal: '1 1/4" RDE 10', dInt: 35.05 },
  { pulg: 2, nominal: '2" RDE 10', dInt: 51.42 },
];

describe('computeAcometidaSummary', () => {
  it('sin tramos AC dibujados: defaults de la pantalla, presión entra en 20 y sale en 20 (Q=0)', () => {
    const s = computeAcometidaSummary([], [] as PlanItem[], DIAMS)!;
    expect(s.tr1).toMatchObject({
      desde: 'Red Pública',
      hasta: 'Contador',
      h: 10.0,
      le: 0.47,
      diamPropuesto: '1 1/4" RDE 10', // default: primera opción de 1.25"
    });
    expect(s.tr2).toMatchObject({ desde: 'Contador', hasta: 'Mon', h: 7.54, le: 0 });
    expect(s.Qaco).toBe(0);
    expect(s.dInt1).toBe(35.05);
    expect(s.V1).toBe(0);
    expect(s.hfPct1).toBe(0);
    expect(s.p1Ini).toBe(20);
    expect(s.p1Fin).toBe(20); // sin caudal no hay pérdida
    expect(s.p2Fin).toBe(20);
    expect(s.diamContador).toBe('1'); // CONTADORES[2] por defecto
    expect(s.Qn).toBe(1.96);
    expect(s.hfContador).toBe(0);
    expect(s.diamConformeOk).toBe(true); // 1.25 − 1 = 0.25 ≤ 0.5
    expect(s.estadoOk).toBe(true); // pResidual 20 ≥ 3 (Colombia) y hfContador ≤ 5
  });

  it('con AC-01 y AC-02 dibujados: usa sus longitudes/materiales y nombra el montante por el fin', () => {
    const tr1 = {
      id: 'AC-01',
      tipo: 'ramal',
      piso: 1,
      ini: 'RP',
      fin: 'CNT-1',
      totalL: 8,
      material: 'PVC-S',
      fixtures: {},
      accesorios: {},
    } as unknown as Tramo;
    const tr2 = {
      id: 'AC-02',
      tipo: 'ramal',
      piso: 1,
      ini: 'CNT-1',
      fin: 'M1',
      totalL: 5,
      material: 'PVC-S',
      fixtures: {},
      accesorios: {},
      nSalidas: 0,
    } as unknown as Tramo;
    const s = computeAcometidaSummary([tr1, tr2], [] as PlanItem[], DIAMS)!;
    expect(s.tr1).toMatchObject({ h: 8, hasta: 'Contador' });
    expect(s.tr2).toMatchObject({ h: 5, hasta: 'M1' });
    expect(s.cHW1).toBe(matHazenC('PVC-S') ?? 150);
    expect(s.cHW2).toBe(s.cHW1);
    expect(s.Lt1).toBe(8); // sin caudal, Lt = h + v + le
    expect(s.p1Fin).toBe(20);
    expect(s.p2Fin).toBe(20);
    expect(s.pResidual).toBe(20);
  });

  it('el diámetro del contador se toma del bajante contador dibujado (tipo contador, net af)', () => {
    localStorage.setItem(
      'civilflow_trazos_p1',
      JSON.stringify({ bajantes: [{ id: 'c1', tipo: 'contador', net: 'af', dNominal: '2"' }] }),
    );
    const s = computeAcometidaSummary(
      [],
      [{ id: 'p1', status: 'confirmed', nivel: 0 } as unknown as PlanItem],
      DIAMS,
    )!;
    expect(s.diamContador).toBe('2');
    expect(s.Qn).toBe(8.4);
    // dValAco 1.25 − dValCont 2 = −0.75 → conforme
    expect(s.diamConformeOk).toBe(true);
  });

  it('Qaco por Hunter cuando hay UC acumulada en AC-02 (0.1163·UC^0.6875 con K de salidas)', () => {
    // AC-02 con aparatos y nSalidas 1 → K = 1/√(1−1)… sin divisor: hunterQ(total>0, nDesc)
    const tr2 = {
      id: 'AC-02',
      tipo: 'ramal',
      piso: 1,
      ini: 'CNT-1',
      fin: 'M1',
      totalL: 5,
      material: 'PVC-S',
      fixtures: { lvm: 4 }, // 4 lavamanos × 0.5 UC_af = 2 UC
      accesorios: {},
      nSalidas: 3,
    } as unknown as Tramo;
    const tr1 = {
      id: 'AC-01',
      tipo: 'ramal',
      piso: 1,
      ini: 'RP',
      fin: 'CNT-1',
      totalL: 8,
      material: 'PVC-S',
      fixtures: {},
      accesorios: {},
    } as unknown as Tramo;
    const s = computeAcometidaSummary([tr1, tr2], [] as PlanItem[], DIAMS)!;
    // K(3) = 1/√2 ≈ 0.7071 — hunterK ya NO redondea (el round a 2 dec era artefacto del HTML)
    const K = 1 / Math.sqrt(2);
    const esperado = Math.round(K * 0.1163 * Math.pow(2, 0.6875) * 1000) / 1000;
    expect(s.Qaco).toBe(esperado);
    expect(s.Qaco).toBeGreaterThan(0);
  });

  it('Pfin se descuenta por tramo en cadena: p2Ini = p1Fin', () => {
    const tr1 = {
      id: 'AC-01',
      tipo: 'ramal',
      piso: 1,
      ini: 'RP',
      fin: 'CNT-1',
      totalL: 10,
      material: 'PVC-S',
      fixtures: {},
      accesorios: {},
    } as unknown as Tramo;
    const tr2 = {
      id: 'AC-02',
      tipo: 'ramal',
      piso: 1,
      ini: 'CNT-1',
      fin: 'M1',
      totalL: 20,
      material: 'PVC-S',
      fixtures: { lvm: 40 },
      accesorios: {},
      nSalidas: 3,
    } as unknown as Tramo;
    const s = computeAcometidaSummary([tr1, tr2], [] as PlanItem[], DIAMS)!;
    expect(s.p2Ini).toBe(s.p1Fin);
    expect(s.hfM1).toBeGreaterThan(0); // con caudal y longitud hay pérdida
    expect(s.p2Fin).toBeLessThan(s.p2Ini);
  });
});
