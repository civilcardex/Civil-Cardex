import { describe, it, expect, vi } from 'vitest';
import { computeLlQMap } from '../rainwaterRows';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';

// Caudal real de aguas lluvias (orig. usuario): se calcula con la columna "Área acumulada"
// PROPIA del elemento; el total dibujado del piso es solo el fallback cuando no hay valor propio.

vi.mock('../../services/storageService', () => ({
  loadFromStorage: vi.fn(() => null), // sin dibujo → areaAcumMap vacío
  saveToStorage: vi.fn(),
}));

describe('computeLlQMap: caudal real con área acumulada propia', () => {
  const plans = [{ id: '1', nivel: 1, name: 'P1' }] as unknown as PlanItem[];

  const tramoRamal = {
    _key: 'R1-1',
    id: 'R1',
    tipo: 'ramal',
    esBajante: false,
    piso: 1,
  } as unknown as Tramo;

  it('usa el área acumulada PROPIA del bajante (override) aunque el total del piso sea mayor', () => {
    const q = computeLlQMap(
      [tramoRamal],
      plans,
      [
        {
          id: 'BAN1',
          bajante: 'BAN1-P1',
          areaAcumulada: 50,
          intensidad: 100,
          coeficienteC: 0.0278,
        },
      ],
      { 'R1-1': ['BAN1-P1'] },
    );
    const esperado = (50 * 100 * 0.0278) / 100; // Q = área × I × C / 100
    expect(q['R1-1']).toBeCloseTo(esperado, 5);
  });

  it('sin área propia del bajante → fallback al total del piso (áreas dibujadas)', () => {
    // areaAcumMap viene del storage (mockeado a null aquí) → 0; sin valor propio el Q cae a 0.
    const q = computeLlQMap(
      [tramoRamal],
      plans,
      [{ id: 'BAN1', bajante: 'BAN1-P1', intensidad: 100, coeficienteC: 0.0278 }],
      { 'R1-1': ['BAN1-P1'] },
    );
    expect(q['R1-1']).toBe(0);
  });
});
