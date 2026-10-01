import { describe, it, expect } from 'vitest';
import { puntoEnCaja, checkRamalAnglesExcludingConnections } from '../junctionAutoSplit';
import type { IPlanoEngineCore, PlanoBajante, PlanoRamal } from '../PlanoState';

// Entrar a una caja (aguas negras/lluvias) no valida ángulo: el segmento de conexión lo
// dicta la caja, no la cuadrícula. Test a escala real, sin depender de `_circ`.

const cmToPlanePx = (cm: number) => ((cm / 100) * 96) / (2.54 * 0.5);

function makeEngine(bajantes: PlanoBajante[] = [], ramales: PlanoRamal[] = []) {
  return {
    ramales,
    bajantes,
    zoom: 1,
    scaleM: 0.5,
    snapMode: true,
    cmToPlanePx,
  } as unknown as IPlanoEngineCore;
}

const caja = (x: number, y: number, net = 'san'): PlanoBajante =>
  ({
    id: 'CAN1',
    net,
    tipo: 'caja_san',
    code: 'CAN1',
    x,
    y,
  }) as unknown as PlanoBajante;

const ramal = (pts: number[][]): PlanoRamal =>
  ({
    id: 'RS1',
    net: 'san',
    tipo: 'ramal',
    pts,
    label: 'RS1',
  }) as unknown as PlanoRamal;

describe('puntoEnCaja', () => {
  it('centro, borde y esquina dentro; fuera y otra red fuera', () => {
    const eng = makeEngine([caja(0, 0)]);
    expect(puntoEnCaja(eng, [0, 0], 'san')).toBe(true);
    expect(puntoEnCaja(eng, [37, 0], 'san')).toBe(true);
    expect(puntoEnCaja(eng, [30, 30], 'san')).toBe(true);
    expect(puntoEnCaja(eng, [50, 0], 'san')).toBe(false);
    expect(puntoEnCaja(eng, [0, 0], 'll')).toBe(false);
  });
});

describe('llegada a caja exime el ángulo', () => {
  // Codo de 90° en san (inválido): sin caja debe alertar (false), con el extremo dentro
  // de la caja debe pasar (true).
  const kinked = () =>
    ramal([
      [0, 0],
      [100, 0],
      [100, 50],
    ]);
  it('sin caja: el codo 90° no pasa', () => {
    const eng = makeEngine([], [kinked()]);
    expect(checkRamalAnglesExcludingConnections(eng, eng.ramales[0])).toBe(false);
  });
  it('con el extremo dentro de la caja: pasa', () => {
    const r = kinked();
    const eng = makeEngine([caja(100, 50)], [r]);
    expect(checkRamalAnglesExcludingConnections(eng, r)).toBe(true);
  });
});
