import { describe, it, expect, vi } from 'vitest';
import {
  computeLlQMap,
  materialComun,
  repartirOtrasCanal,
  sumaOtrasAsociados,
} from '../rainwaterRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

// Caudal real de aguas lluvias (orig. usuario): se calcula con la columna TOTAL =
// Parcial + Otras. La Parcial con la fórmula COMPARTIDA areaParcialBajanteLl (área dibujada
// del tramo bajante > override manual; total del piso como último fallback) — la MISMA que
// el chequeo de bajantes y el canal, para que el Q no diverja entre tablas.
// Otras editable con default 0.
// REQ material absoluto: sin materialCubierta elegido el cálculo NO dispara (C=0 → Q=0),
// ni con áreas ni con el caudal manual del dibujo (t.qLps).

vi.mock('../../services/storageService', () => ({
  loadFromStorage: vi.fn(() => null), // sin dibujo → areaAcumMap vacío
  saveToStorage: vi.fn(),
}));

// Material con C conocido del catálogo (Losa impermeabilizada → C = 0.95).
const MATERIAL = 'Losa impermeabilizada (manto / membrana)';

describe('computeLlQMap: caudal real con área TOTAL (parcial + otras)', () => {
  const plans = [{ id: '1', nivel: 1, name: 'P1' }] as unknown as PlanItem[];

  const tramoRamal = {
    _key: 'R1-1',
    id: 'R1',
    tipo: 'ramal',
    esBajante: false,
    piso: 1,
  } as unknown as Tramo;

  it('Total = areaParcial + areaOtras del bajante (con material elegido)', () => {
    const q = computeLlQMap(
      [tramoRamal],
      plans,
      [
        {
          id: 'BAN1',
          bajante: 'BAN1-P1',
          areaParcial: 40,
          areaOtras: 10,
          intensidad: 100,
          coeficienteC: 0.95,
          materialCubierta: MATERIAL,
        },
      ],
      { 'R1-1': ['BAN1-P1'] },
    );
    const esperado = (50 * 100 * 0.95) / 3600; // Q = (40+10)·I·C/3600 (el chequeo redondea a 2 dec)
    expect(q['R1-1']).toBeCloseTo(esperado, 2);
  });

  it('sin Otras → Total = Parcial sola (default 0 no rompe)', () => {
    const q = computeLlQMap(
      [tramoRamal],
      plans,
      [
        {
          id: 'BAN1',
          bajante: 'BAN1-P1',
          areaParcial: 50,
          intensidad: 100,
          coeficienteC: 0.95,
          materialCubierta: MATERIAL,
        },
      ],
      { 'R1-1': ['BAN1-P1'] },
    );
    const esperado = (50 * 100 * 0.95) / 3600;
    expect(q['R1-1']).toBeCloseTo(esperado, 2);
  });

  it('sin parcial ni otras → fallback al total del piso (áreas dibujadas), Q en 0 aquí', () => {
    const q = computeLlQMap(
      [tramoRamal],
      plans,
      [
        {
          id: 'BAN1',
          bajante: 'BAN1-P1',
          intensidad: 100,
          coeficienteC: 0.95,
          materialCubierta: MATERIAL,
        },
      ],
      { 'R1-1': ['BAN1-P1'] },
    );
    expect(q['R1-1']).toBe(0);
  });

  it('REQ material absoluto: con áreas pero SIN materialCubierta → Q=0 (antes C=1)', () => {
    const q = computeLlQMap(
      [tramoRamal],
      plans,
      [
        {
          id: 'BAN1',
          bajante: 'BAN1-P1',
          areaParcial: 40,
          areaOtras: 10,
          intensidad: 100,
          coeficienteC: 0.95,
        },
      ],
      { 'R1-1': ['BAN1-P1'] },
    );
    expect(q['R1-1']).toBe(0);
  });

  it('REQ material absoluto: caudal manual del dibujo (qLps) del bajante tampoco dispara sin material', () => {
    const tramoBaj = {
      _key: 'BAN1-1',
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      esBajante: true,
      piso: 1,
      qLps: 5,
    } as unknown as Tramo;
    // Sin áreas en el override: el caudal manual (qLps) es el único camino → gated.
    const overrides = {
      id: 'BAN1',
      bajante: 'BAN1',
      areaParcial: 0,
      areaOtras: 0,
      intensidad: 100,
      coeficienteC: 0.95,
    };
    const sinMaterial = computeLlQMap([tramoBaj], plans, [overrides], {});
    expect(sinMaterial['BAN1-1']).toBe(0);
    const conMaterial = computeLlQMap(
      [tramoBaj],
      plans,
      [{ ...overrides, materialCubierta: MATERIAL }],
      {},
    );
    expect(conMaterial['BAN1-1']).toBe(5);
  });

  it('REQ material absoluto: caudal manual del ramal (qLps) gated por el material de SUS bajantes', () => {
    const tramoRamalManual = { ...tramoRamal, qLps: 7 } as unknown as Tramo;
    const base = {
      id: 'BAN1',
      bajante: 'BAN1-P1',
      intensidad: 100,
      coeficienteC: 0.95,
    };
    // Con asociado SIN material: ni Q racional (área 0) ni caudal manual → 0.
    const sinMaterial = computeLlQMap([tramoRamalManual], plans, [base], {
      'R1-1': ['BAN1-P1'],
    });
    expect(sinMaterial['R1-1']).toBe(0);
    // Con asociado CON material (pero área 0 → Q racional 0): el manual del dibujo sí aplica.
    const conMaterial = computeLlQMap(
      [tramoRamalManual],
      plans,
      [{ ...base, materialCubierta: MATERIAL }],
      {
        'R1-1': ['BAN1-P1'],
      },
    );
    expect(conMaterial['R1-1']).toBe(7);
  });

  it('I-7: Parcial con la fórmula COMPARTIDA — área dibujada del tramo bajante gana al override manual (igual que Chequeo bajantes)', () => {
    // El tramo bajante trae el área dibujada (buildTramos: area_m2 del glifo); el override
    // manual tiene areaParcial distinta. Chequeo bajantes y canal usan la DIBUJADA — el
    // tramo colector de Diseño de red no puede divergir (antes: manual primero).
    const trBaj = {
      _key: 'BAN1-1',
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      esBajante: true,
      piso: 1,
      area_m2: 30,
    } as unknown as Tramo;
    const q = computeLlQMap(
      [trBaj, tramoRamal],
      plans,
      [
        {
          id: 'BAN1',
          bajante: 'BAN1-P1',
          areaParcial: 40, // manual distinto del dibujado (30)
          areaOtras: 5,
          intensidad: 100,
          coeficienteC: 0.95,
          materialCubierta: MATERIAL,
        },
      ],
      // Código pelado, como buildLlBajanteAssociations (empuja b.code sin piso).
      { 'R1-1': ['BAN1'] },
    );
    const esperado = ((30 + 5) * 100 * 0.95) / 3600; // Parcial 30 (dibujo) + Otras 5
    expect(q['R1-1']).toBeCloseTo(esperado, 2);
  });

  it('I-7: sin área dibujada ni override → conservan el fallback al total del piso', () => {
    const trBaj = {
      _key: 'BAN1-1',
      id: 'BAN1',
      code: 'BAN1',
      tipo: 'bajante',
      esBajante: true,
      piso: 1,
    } as unknown as Tramo;
    const q = computeLlQMap(
      [trBaj, tramoRamal],
      plans,
      [
        {
          id: 'BAN1',
          bajante: 'BAN1',
          intensidad: 100,
          coeficienteC: 0.95,
          materialCubierta: MATERIAL,
        },
      ],
      { 'R1-1': ['BAN1'] },
    );
    // Sin dibujo (storage mockeado a null) el fallback del piso es 0 → Q racional 0.
    expect(q['R1-1']).toBe(0);
  });
});

describe('helpers puros del canal con asociados (materialComun / sumaOtrasAsociados / repartirOtrasCanal)', () => {
  it('materialComun: uniforme no vacío → ese material', () => {
    expect(materialComun(['Teja', 'Teja'])).toBe('Teja');
    expect(materialComun([MATERIAL])).toBe(MATERIAL);
  });

  it("materialComun: mezclado, con vacíos/undefined o vacío → '' (sin C, canal no calcula)", () => {
    expect(materialComun(['Teja', 'Zinc'])).toBe('');
    expect(materialComun(['Teja', undefined])).toBe('');
    expect(materialComun(['Teja', ''])).toBe('');
    expect(materialComun([])).toBe('');
    expect(materialComun([undefined, undefined])).toBe('');
  });

  it('sumaOtrasAsociados: Σ con overrides parciales (fila ausente o sin campo → 0)', () => {
    expect(sumaOtrasAsociados([{ areaOtras: 2 }, { areaOtras: 3 }, undefined, {}])).toBe(5);
    expect(sumaOtrasAsociados([])).toBe(0);
  });

  it('repartirOtrasCanal N=1 → [total]', () => {
    expect(repartirOtrasCanal(5, 1)).toEqual([5]);
  });

  it('repartirOtrasCanal N=3 con residuo → Σ exacta al total (centavos de m²)', () => {
    const vals = repartirOtrasCanal(5, 3);
    expect(vals).toEqual([1.68, 1.66, 1.66]);
    expect(Math.round(sumaOtrasAsociados(vals.map((v) => ({ areaOtras: v }))) * 100) / 100).toBe(5);
  });

  it('repartirOtrasCanal total 0 o N=0 → todo 0 / vacío', () => {
    expect(repartirOtrasCanal(0, 3)).toEqual([0, 0, 0]);
    expect(repartirOtrasCanal(5, 0)).toEqual([]);
  });

  it('repartirOtrasCanal idempotente: re-editar el mismo total no cambia el reparto (I-1: sin inflado N×)', () => {
    const primera = repartirOtrasCanal(5, 3);
    // El context muestra la Σ real; re-editar ese MISMO total debe dar el mismo reparto.
    const segunda = repartirOtrasCanal(
      Math.round(sumaOtrasAsociados(primera.map((v) => ({ areaOtras: v }))) * 100) / 100,
      3,
    );
    expect(segunda).toEqual(primera);
  });
});
