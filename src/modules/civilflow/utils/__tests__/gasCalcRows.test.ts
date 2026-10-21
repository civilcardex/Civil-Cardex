import { describe, expect, it } from 'vitest';
import {
  calculaFilasGas,
  accesoriosDeTramo,
  propiosDeTramo,
  type TramoGasCalc,
} from '../gasCalcRows.ts';
import { factoresGas } from '../gasUtils.ts';

/**
 * Caracterización del núcleo de cálculo de la red de gas (utils/gasCalcRows.ts).
 *
 * Antes de la unificación esta cuenta estaba duplicada: `checkRows` en GasDesign.tsx (con
 * los datos VIVOS de la pantalla) y `computeGasRows` en gasRows.ts (con lo que hay en
 * storage, para la tabla resumen). Estos tests fijan la fórmula compartida.
 */

const factores = factoresGas({ patm: '90.32', temp: '23', densRel: '0.67' });

/** Red de 2 tramos: el troncal "RS1" y el ramal "RS2" que cuelga de su final. */
function redDeDos(): TramoGasCalc[] {
  return [
    {
      id: 'RS1',
      planId: 1,
      piso: 1,
      longitud: 10,
      esTrib: false,
      pts: [
        [0, 0],
        [100, 0],
      ],
    },
    {
      id: 'RS2',
      planId: 1,
      piso: 1,
      longitud: 5,
      esTrib: false,
      pts: [
        [100, 0],
        [200, 0],
      ],
    },
  ];
}

describe('calculaFilasGas — la red se ordena y la presión se hereda', () => {
  it('el padre se calcula antes que el hijo (orden por profundidad del árbol)', () => {
    const filas = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 20,
      accDe: () => ({}),
      propios: new Map(),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    expect(filas.map((f) => f.id)).toEqual(['RS1', 'RS2']);
  });

  it('el hijo hereda la presión de salida del padre: pIni = pFin del padre', () => {
    const filas = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 20,
      accDe: () => ({}),
      propios: new Map(),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    const padre = filas[0];
    const hijo = filas[1];
    // La raíz arranca en la presión del operador.
    expect(padre.pIni).toBe(17);
    expect(hijo.pIni).toBeCloseTo(padre.pFin, 6);
    // Y la pérdida acumulada del hijo incluye la del padre.
    expect(hijo.dPAcum).toBeCloseTo(padre.dPAcum + hijo.dP, 6);
  });

  it('sin diámetro no hay pérdida: el chequeo queda en "—" y dP en 0', () => {
    const filas = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 0,
      accDe: () => ({}),
      propios: new Map(),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    expect(filas[0].dP).toBe(0);
    expect(filas[0].chequeo).toBe('—');
  });

  it('los accesorios suman longitud equivalente (Le) proporcional al diámetro interior', () => {
    const sinAcc = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 20,
      accDe: () => ({}),
      propios: new Map(),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    const conAcc = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 20,
      // 10 codos de 90° estándar (LE_K.codos_90_std = 30) → Le = 20 * 10 * 30 / 1000 = 6 m
      accDe: () => ({ codos_90_std: 10 }),
      propios: new Map(),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    expect(conAcc[0].le).toBeCloseTo(6, 6);
    expect(conAcc[0].le).toBeGreaterThan(sinAcc[0].le);
    // Más longitud equivalente → más pérdida de carga.
    expect(conAcc[0].dP).toBeGreaterThan(sinAcc[0].dP);
  });

  it('el consumo acumulado del tronco incluye el de la red que cuelga de él', () => {
    // RS2 tiene un aparato (estufa) y RS1 es el tronco: RS1 carga con el total de RS2.
    const conAparato = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 20,
      accDe: () => ({}),
      propios: new Map([['1:RS2', { est4: 1 }]]),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    const sinAparato = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 20,
      accDe: () => ({}),
      propios: new Map(),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    expect(conAparato[0].qConsumo).toBeGreaterThan(sinAparato[0].qConsumo);
    expect(conAparato[1].qConsumo).toBeGreaterThan(0);
  });

  it('la clave de cada fila es "piso:id" (los ids de ramal se repiten entre pisos)', () => {
    const filas = calculaFilasGas({
      tramos: redDeDos(),
      dIntDe: () => 20,
      accDe: () => ({}),
      propios: new Map(),
      pMin: 17,
      factores,
      pais: 'Colombia',
    });
    expect(filas[0].clave).toBe('1:RS1');
    expect(filas[1].clave).toBe('1:RS2');
  });
});

describe('accesoriosDeTramo / propiosDeTramo — la clave compuesta por piso', () => {
  it('lee la clave "gas_id_planId" y cae al formato viejo (solo id)', () => {
    const acc = { gas_RS1_1: { codos_90_std: 3 }, RS2: { te_linea: 1 } };
    expect(accesoriosDeTramo(acc, { id: 'RS1', planId: 1 })).toEqual({ codos_90_std: 3 });
    expect(accesoriosDeTramo(acc, { id: 'RS2', planId: 1 })).toEqual({ te_linea: 1 });
  });

  it('los aparatos usan la misma clave que los accesorios', () => {
    const ap = { gas_RS1_1: { est4: 2 } };
    expect(propiosDeTramo(ap, { id: 'RS1', planId: 1 })).toEqual({ est4: 2 });
    expect(propiosDeTramo(ap, { id: 'RS1', planId: 2 })).toEqual({});
  });
});
