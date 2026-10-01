import { describe, it, expect, vi } from 'vitest';
import { computeLlQMap } from '../rainwaterRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

// Caudal real de aguas lluvias (orig. usuario): se calcula con la columna TOTAL =
// Parcial + Otras. La parcial del dibujo (override manual del bajante primero, total del
// piso como fallback); Otras editable con default 0.

vi.mock('../../services/storageService', () => ({
  loadFromStorage: vi.fn(() => null), // sin dibujo → areaAcumMap vacío
  saveToStorage: vi.fn(),
}));

describe('computeLlQMap: caudal real con área TOTAL (parcial + otras)', () => {
  const plans = [{ id: '1', nivel: 1, name: 'P1' }] as unknown as PlanItem[];

  const tramoRamal = {
    _key: 'R1-1',
    id: 'R1',
    tipo: 'ramal',
    esBajante: false,
    piso: 1,
  } as unknown as Tramo;

  it('Total = areaParcial + areaOtras del bajante', () => {
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
          coeficienteC: 0.0278,
        },
      ],
      { 'R1-1': ['BAN1-P1'] },
    );
    const esperado = (50 * 100 * 0.0278) / 100; // Q = (40+10) × I × C / 100
    expect(q['R1-1']).toBeCloseTo(esperado, 5);
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
          coeficienteC: 0.0278,
        },
      ],
      { 'R1-1': ['BAN1-P1'] },
    );
    const esperado = (50 * 100 * 0.0278) / 100;
    expect(q['R1-1']).toBeCloseTo(esperado, 5);
  });

  it('sin parcial ni otras → fallback al total del piso (áreas dibujadas), Q en 0 aquí', () => {
    const q = computeLlQMap(
      [tramoRamal],
      plans,
      [{ id: 'BAN1', bajante: 'BAN1-P1', intensidad: 100, coeficienteC: 0.0278 }],
      { 'R1-1': ['BAN1-P1'] },
    );
    expect(q['R1-1']).toBe(0);
  });
});
