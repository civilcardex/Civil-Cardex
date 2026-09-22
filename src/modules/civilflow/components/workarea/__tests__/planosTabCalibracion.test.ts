import { describe, it, expect } from 'vitest';
import {
  calDataDePlan,
  seedCalData,
  computeGlobalCal,
  computeOrigenesCompartidos,
  stampCalibracion,
  type CalibrationData,
} from '../planosTabCalibracion';

// Módulo puro de calibración de PlanosTab: derivación meta→calData (antes duplicada entre
// initializer y efecto), globalCal, orígenes compartidos y el stamp sobre el doc (re-base
// anclado + ts). Extraído del componente para poder testearlo sin montar React.

const metaDe = (over: Partial<Parameters<typeof calDataDePlan>[0]> = {}) => ({
  id: 1,
  origen: { x_px: 10, y_px: 20 },
  scale: 50,
  status: 'confirmed',
  ...over,
});

describe('seedCalData', () => {
  it('deriva la entrada del meta (scale/100, factores por defecto = scaleM)', () => {
    const cd = calDataDePlan(metaDe());
    expect(cd).toMatchObject({
      origen: { x_px: 10, y_px: 20 },
      scaleM: 0.5,
      factorX: 0.5,
      factorY: 0.5,
      definedScale: 0.5,
    });
  });

  it('purga huérfanos y siembra nuevos sin tocar entradas del usuario', () => {
    const prev: Record<number, CalibrationData> = {
      1: { origen: null, scaleM: 0.4, factorX: 0.4, factorY: 0.4, calGlobal: null },
      9: { origen: null, scaleM: 0.4, factorX: 0.4, factorY: 0.4, calGlobal: null },
    };
    const { next, changed } = seedCalData(prev, [metaDe({ id: 1 }), metaDe({ id: 2 })]);
    expect(changed).toBe(true);
    expect(Object.keys(next).sort()).toEqual(['1', '2']); // 9 purgado, 2 sembrado
    expect(next[1].scaleM).toBe(0.4); // entrada del usuario intacta
    expect(next[2].scaleM).toBe(0.5); // derivada del meta
  });

  it('sin cambios (plans ya reflejados) → changed=false y MISMO objeto', () => {
    const prev: Record<number, CalibrationData> = {};
    const { next, changed } = seedCalData(prev, []);
    expect(changed).toBe(false);
    expect(next).toEqual(prev);
  });
});

describe('computeGlobalCal / computeOrigenesCompartidos', () => {
  it('globalCal exige calGlobal=true y presencia en plans actuales', () => {
    const global: CalibrationData = {
      origen: { x_px: 1, y_px: 2 },
      scaleM: 0.5,
      factorX: 0.5,
      factorY: 0.5,
      calGlobal: true,
    };
    const calData = { 1: global, 7: { ...global, calGlobal: true } };
    expect(computeGlobalCal(calData, [metaDe({ id: 1 })])?.scaleM).toBe(0.5);
    // plans ya no contiene al 1 ni al 7 → sin global válida.
    expect(computeGlobalCal(calData, [])).toBeNull();
  });

  it('orígenes compartidos: solo claves repetidas entre confirmados', () => {
    const o = { x_px: 5, y_px: 6 };
    const plans = [
      metaDe({ id: 1, origen: o, status: 'confirmed' }),
      metaDe({ id: 2, origen: { ...o }, status: 'confirmed' }),
      metaDe({ id: 3, origen: { ...o }, status: 'pending' }), // no confirmado: no cuenta
      metaDe({ id: 4, origen: { x_px: 9, y_px: 9 }, status: 'confirmed' }),
    ];
    const set = computeOrigenesCompartidos(plans);
    expect(set.has('5|6')).toBe(true);
    expect(set.has('9|9')).toBe(false);
  });
});

describe('stampCalibracion', () => {
  const config = (scaleM: number) => ({
    planId: 1,
    origen: { x_px: 100, y_px: 50 },
    scaleM,
    factorX: 1,
    factorY: 1,
    definedScale: scaleM,
  });

  it('escala previa distinta → re-basa la geometría anclada al origen del stamp', () => {
    const doc: Record<string, unknown> = {
      scaleM: 0.5,
      ramales: [{ id: 'R1', pts: [[400, 300]] }],
      dims: [],
    };
    stampCalibracion(config(1), doc);
    // Ancla (100,50): x' = 100 + (400−100)·0.5 = 250; y' = 50 + (300−50)·0.5 = 175.
    expect((doc.ramales as Array<{ pts: number[][] }>)[0].pts[0]).toEqual([250, 175]);
    expect(doc.scaleM).toBe(1);
    expect(typeof doc.ts).toBe('number');
  });

  it('misma escala → solo stamp, geometría intacta', () => {
    const doc: Record<string, unknown> = {
      scaleM: 0.5,
      ramales: [{ id: 'R1', pts: [[400, 300]] }],
      dims: [],
      ts: 12345,
    };
    stampCalibracion(config(0.5), doc);
    expect((doc.ramales as Array<{ pts: number[][] }>)[0].pts[0]).toEqual([400, 300]);
    expect(doc.ts).toBe(12345); // existente no se toca
    expect(doc.origen).toEqual({ x_px: 100, y_px: 50 });
  });
});
