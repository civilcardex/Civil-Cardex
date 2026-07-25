import { describe, it, expect } from 'vitest';
import { chequeoBajanteLluvia, chequeoCanalLluvia, BORDE_LIBRE_CANAL_CM } from '../calcRainwater';

describe('chequeoBajanteLluvia', () => {
  it('Q=0 con areaAcumulada=0', () => {
    const { Q, dCalc, chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 0,
      intensidad: 100,
      coeficienteC: 0.8,
      R: '1/4',
      diamPropuesto: 100,
    });
    expect(Q).toBe(0);
    expect(dCalc).toBe(0);
    expect(chequeo).toBe('—');
  });

  it('Q=0 con intensidad=0', () => {
    const { Q } = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 0,
      coeficienteC: 0.8,
      R: '1/4',
      diamPropuesto: 100,
    });
    expect(Q).toBe(0);
  });

  it('calcula Q y dCalc con datos validos R=1/4', () => {
    const { Q, dCalc, chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 200,
      intensidad: 150,
      coeficienteC: 0.8,
      R: '1/4',
      diamPropuesto: 100,
    });
    expect(Q).toBeGreaterThan(0);
    expect(dCalc).toBeGreaterThan(0);
    expect(['Ok', 'No cumple', 'Sin diseño']).toContain(chequeo);
  });

  it('OK cuando dCalc < diamPropuesto', () => {
    const { chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 50,
      intensidad: 100,
      coeficienteC: 0.7,
      R: '1/4',
      diamPropuesto: 200,
    });
    expect(chequeo).toBe('Ok');
  });

  it('No cumple cuando dCalc >= diamPropuesto', () => {
    const { chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 500,
      intensidad: 100,
      coeficienteC: 0.8,
      R: '1/4',
      diamPropuesto: 10,
    });
    expect(chequeo).toBe('No cumple');
  });

  it('R=7/24 produce Rv=7/24', () => {
    const { Q } = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      R: '7/24',
    });
    expect(Q).toBeGreaterThan(0);
  });

  it('R desconocido usa Rv=0 → dCalc=0', () => {
    const { dCalc, chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      R: 'otro',
      diamPropuesto: 100,
    });
    expect(dCalc).toBe(0);
    expect(chequeo).toBe('—');
  });
});

describe('chequeoCanalLluvia', () => {
  it('Qreal=0 con areaAcumulada=0', () => {
    const { Qreal, Qmax, chequeo } = chequeoCanalLluvia({
      areaAcumulada: 0,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0.009,
      pendiente: 2,
      b: 30,
      h: 20,
    });
    expect(Qreal).toBe(0);
    expect(Qmax).toBeGreaterThan(0);
    expect(chequeo).toBe('—');
  });

  it('Qmax=0 con b=0', () => {
    const { Qmax, chequeo } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0.009,
      pendiente: 2,
      b: 0,
      h: 20,
    });
    expect(Qmax).toBe(0);
    expect(chequeo).toBe('Sin sección');
  });

  it('Ok cuando Qmax > Qreal', () => {
    const { chequeo } = chequeoCanalLluvia({
      areaAcumulada: 50,
      intensidad: 80,
      coeficienteC: 0.7,
      manning: 0.009,
      pendiente: 2,
      b: 40,
      h: 30,
    });
    expect(chequeo).toBe('Ok');
  });

  it('No cumple cuando Qmax < Qreal', () => {
    const { chequeo } = chequeoCanalLluvia({
      areaAcumulada: 5000,
      intensidad: 200,
      coeficienteC: 0.9,
      manning: 0.009,
      pendiente: 0.5,
      b: 10,
      h: 5,
    });
    expect(chequeo).toBe('No cumple');
  });

  it('totalStr suma borde libre 10cm', () => {
    const { totalStr } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0.009,
      pendiente: 2,
      b: 30,
      h: 20,
    });
    expect(totalStr).toBe(`30 x ${20 + BORDE_LIBRE_CANAL_CM}`);
  });

  it('totalStr "—" sin dimensiones', () => {
    const { totalStr } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0.009,
      pendiente: 2,
      b: 0,
      h: 0,
    });
    expect(totalStr).toBe('—');
  });

  it('manning default 0.009 cuando no se pasa', () => {
    const { Qmax } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0,
      pendiente: 2,
      b: 30,
      h: 20,
    });
    expect(Qmax).toBeGreaterThan(0);
  });

  it('Qmax=0 con n <= 0', () => {
    const { Qmax } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0,
      pendiente: 2,
      b: 30,
      h: 0,
    });
    expect(Qmax).toBe(0);
  });
});
