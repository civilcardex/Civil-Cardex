import { describe, it, expect } from 'vitest';
import { pisoOcupadoPor } from '../isLevelTaken';
import { leerPlansMeta, planCalibrado } from '../plansMeta.ts';

/**
 * Los helpers que eran copias:
 *  - "el nivel ya tiene plano" estaba en 5 sitios (listas de planos, modal y configurador).
 *  - la lectura de `plans_meta` estaba en 4 sitios con parseos distintos.
 */
describe('pisoOcupadoPor', () => {
  const planes = [
    { id: '1', nivel: 0 },
    { id: '2', nivel: 1 },
  ];

  it('detecta el nivel ocupado', () => {
    expect(pisoOcupadoPor(planes, 0)).toBe(true);
    expect(pisoOcupadoPor(planes, 1)).toBe(true);
    expect(pisoOcupadoPor(planes, 2)).toBe(false);
  });

  it('el plano que se est\u00e1 asignando no cuenta como ocupado', () => {
    expect(pisoOcupadoPor(planes, 0, '1')).toBe(false);
    expect(pisoOcupadoPor(planes, 0, '2')).toBe(true);
  });

  it('un plano sin nivel no ocupa nada', () => {
    expect(pisoOcupadoPor([{ id: '9' }], 0)).toBe(false);
  });
});

describe('plansMeta', () => {
  it('leerPlansMeta devuelve una lista vac\u00eda si no hay nada guardado', () => {
    expect(leerPlansMeta()).toEqual([]);
  });

  it('planCalibrado solo da true con origen', () => {
    const meta = [
      { id: '1', scale: 0.5, origen: { x_px: 10, y_px: 20 } },
      { id: '2', scale: 0.5, origen: null },
    ];
    expect(planCalibrado(meta, '1')).toBe(true);
    expect(planCalibrado(meta, '2')).toBe(false);
    expect(planCalibrado(meta, '3')).toBe(false);
  });
});
