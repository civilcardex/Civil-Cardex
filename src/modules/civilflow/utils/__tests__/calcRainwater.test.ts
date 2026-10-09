import { describe, it, expect } from 'vitest';
import {
  chequeoBajanteLluvia,
  chequeoCanalLluvia,
  chequeoEmbocaduraLluvia,
} from '../calcRainwater';

// Valores de referencia: filas de ejemplo del Excel Chequeo_canales_cubierta ffff.xlsx
// (BALL #1 hoja "1. Bajantes"; CNL #1 hoja "2. Canales"). Fórmulas portadas celda a celda:
// Q = C·I·A/3600; Wyly-Eaton D = [Qgpm/(27.8·(0.009/n)·r^(5/3))]^(3/8); Qmáx Manning;
// yn por punto fijo; H vertedero/orificio con Cw=1.7, Cd=0.6, g=9.81.
describe('chequeoBajanteLluvia (hoja 1 Bajantes)', () => {
  it('fila BALL #1 del Excel: Q=2.71, Dcalc=2.54, Qcap=9.07 (Dprop 4")', () => {
    const { Q, dCalc, Qcap, cociente, chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 102.67,
      intensidad: 100,
      coeficienteC: 0.95,
      R: '7/24',
      manning: 0.009,
      diamPropuesto: 4,
    });
    expect(Q).toBeCloseTo(2.71, 2);
    expect(dCalc).toBeCloseTo(2.54, 1);
    expect(Qcap).toBeCloseTo(9.07, 1);
    expect(cociente).toBeCloseTo(0.2987, 2);
    expect(chequeo).toBe('Ok');
  });

  it('Q=0 con areaAcumulada=0', () => {
    const { Q, dCalc, chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 0,
      intensidad: 100,
      coeficienteC: 0.8,
      R: '1/4',
      diamPropuesto: 4,
    });
    expect(Q).toBe(0);
    expect(dCalc).toBe(0);
    // Sin caudal (material sin elegir → C=0) no hay D calculado → SIN chequeo (REQ usuario:
    // el chequeo no debe decir 'Ok' si el diámetro calculado aún no se pudo calcular).
    expect(chequeo).toBe('');
  });

  it('Q=0 con intensidad=0', () => {
    const { Q } = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 0,
      coeficienteC: 0.8,
      R: '1/4',
    });
    expect(Q).toBe(0);
  });

  it('Ok cuando Dcalc <= Dprop (cota del Excel: <=)', () => {
    const { chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 102.67,
      intensidad: 100,
      coeficienteC: 0.95,
      R: '7/24',
      manning: 0.009,
      diamPropuesto: 2.54, // = Dcalc → aún Ok por el <=
    });
    expect(chequeo).toBe('Ok');
  });

  it('No cumple cuando Dcalc > Dprop', () => {
    const { chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 500,
      intensidad: 100,
      coeficienteC: 1,
      R: '1/4',
      manning: 0.009,
      diamPropuesto: 2,
    });
    expect(chequeo).toBe('No cumple');
  });

  it('Sin D propuesto NO juzga (falso positivo: usuario aún no eligió diámetro)', () => {
    const { chequeo } = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.95,
      R: '7/24',
      manning: 0.009,
      diamPropuesto: 0,
    });
    expect(chequeo).toBe('');
  });

  it('R desconocido usa Rv=0 → dCalc=0 y Qcap=0', () => {
    const { dCalc, Qcap } = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.95,
      R: 'otro',
      manning: 0.009,
      diamPropuesto: 4,
    });
    expect(dCalc).toBe(0);
    expect(Qcap).toBe(0);
  });

  it('el ajuste (n_ref/n) sube la capacidad con n mayor al de referencia al revés', () => {
    // n=0.018 (doble del ref) → capacidad a la MITAD que con n=0.009.
    const base = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 1,
      R: '7/24',
      manning: 0.009,
      diamPropuesto: 4,
    });
    const rugoso = chequeoBajanteLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 1,
      R: '7/24',
      manning: 0.018,
      diamPropuesto: 4,
    });
    expect(rugoso.Qcap).toBeCloseTo(base.Qcap / 2, 2);
  });
});

describe('chequeoCanalLluvia (hoja 2 Canales)', () => {
  it('fila CNL #1 del Excel: Q=2.71, Qmax=124.3, yn=0.0143, v=0.77', () => {
    const { Qreal, Qmax, yn, velocidad, chequeo } = chequeoCanalLluvia({
      areaAcumulada: 102.67,
      muroVertical: 0,
      intensidad: 100,
      coeficienteC: 0.95,
      manning: 0.01,
      pendiente: 2,
      b: 24.5,
      h: 20,
      bordeLibreCm: 10,
    });
    expect(Qreal).toBeCloseTo(2.71, 2);
    expect(Qmax).toBeCloseTo(124.3, 0);
    expect(yn).toBeCloseTo(0.014292, 4);
    expect(velocidad).toBeCloseTo(0.77, 2);
    expect(chequeo).toBe('Ok');
  });

  it('A efectiva = A + 0.5·muro vertical (hoja 2 col. E)', () => {
    const { aEfectiva, Qreal } = chequeoCanalLluvia({
      areaAcumulada: 100,
      muroVertical: 20,
      intensidad: 100,
      coeficienteC: 1,
      manning: 0.01,
      pendiente: 2,
      b: 30,
      h: 20,
    });
    expect(aEfectiva).toBe(110);
    // Q = 1·100·110/3600 = 3.0555… → 3.06
    expect(Qreal).toBeCloseTo(3.06, 2);
  });

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
    // REQ: chequeo incompleto = 'No cumple' (antes '—').
    expect(chequeo).toBe('No cumple');
  });

  it('Qreal=0 con coeficienteC=0 (sin material — requisito absoluto)', () => {
    const { Qreal, chequeo } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0,
      manning: 0.009,
      pendiente: 2,
      b: 30,
      h: 20,
    });
    expect(Qreal).toBe(0);
    expect(chequeo).toBe('No cumple');
  });

  it('Qmax=0 con b=0 (REQ: fuera "Sin sección")', () => {
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
    expect(chequeo).toBe('No cumple');
  });

  it('No cumple cuando Qreal > Qmax', () => {
    const { chequeo } = chequeoCanalLluvia({
      areaAcumulada: 5000,
      muroVertical: 0,
      intensidad: 200,
      coeficienteC: 0.9,
      manning: 0.009,
      pendiente: 0.5,
      b: 10,
      h: 5,
    });
    expect(chequeo).toBe('No cumple');
  });

  it('totalStr usa el borde libre de la fila (editable, default 10)', () => {
    const { totalStr } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0.009,
      pendiente: 2,
      b: 30,
      h: 20,
      bordeLibreCm: 15,
    });
    expect(totalStr).toBe('30x35');
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

  it('sin manning (material canal sin asignar): sin cálculo ni chequeo (REQ 2026-10-06)', () => {
    const { Qmax, yn, velocidad, chequeo } = chequeoCanalLluvia({
      areaAcumulada: 100,
      intensidad: 100,
      coeficienteC: 0.8,
      manning: 0,
      pendiente: 2,
      b: 30,
      h: 20,
    });
    expect(Qmax).toBe(0);
    expect(yn).toBe(0);
    expect(velocidad).toBe(0);
    expect(chequeo).toBe('');
  });
});

describe('chequeoEmbocaduraLluvia (hoja 2 AE/AG)', () => {
  it('fila CNL #1 del Excel: Hreq = H vertedero = 0.0292 m ≤ h → Ok', () => {
    const { QporBajante, Hreq, chequeo } = chequeoEmbocaduraLluvia({
      Qreal: 2.71,
      numBajantes: 1,
      diamPulg: 4,
      hUtilM: 0.2,
    });
    expect(QporBajante).toBeCloseTo(2.71, 2);
    expect(Hreq).toBeCloseTo(0.0292, 3);
    expect(chequeo).toBe('Ok');
  });

  it('N bajantes reparten el Q; H baja con más bajantes', () => {
    const uno = chequeoEmbocaduraLluvia({ Qreal: 4, numBajantes: 1, diamPulg: 4, hUtilM: 0.2 });
    const dos = chequeoEmbocaduraLluvia({ Qreal: 4, numBajantes: 2, diamPulg: 4, hUtilM: 0.2 });
    expect(dos.QporBajante).toBeCloseTo(2, 2);
    expect(dos.Hreq).toBeLessThan(uno.Hreq);
  });

  it('sin bajantes asociados → "Revisar bajante"', () => {
    const { chequeo } = chequeoEmbocaduraLluvia({
      Qreal: 4,
      numBajantes: 0,
      diamPulg: 0,
      hUtilM: 0.2,
    });
    expect(chequeo).toBe('Revisar bajante');
  });

  it('No cumple cuando Hreq > h útil', () => {
    const { chequeo } = chequeoEmbocaduraLluvia({
      Qreal: 60,
      numBajantes: 1,
      diamPulg: 2,
      hUtilM: 0.05,
    });
    expect(chequeo).toBe('No cumple');
  });

  it('No cumple con Qreal=0 (REQ: fuera "—")', () => {
    const { chequeo } = chequeoEmbocaduraLluvia({
      Qreal: 0,
      numBajantes: 1,
      diamPulg: 4,
      hUtilM: 0.2,
    });
    expect(chequeo).toBe('No cumple');
  });

  it('No cumple sin altura útil (REQ: fuera "Sin sección")', () => {
    const { chequeo } = chequeoEmbocaduraLluvia({
      Qreal: 4,
      numBajantes: 1,
      diamPulg: 4,
      hUtilM: 0,
    });
    expect(chequeo).toBe('No cumple');
  });
});
