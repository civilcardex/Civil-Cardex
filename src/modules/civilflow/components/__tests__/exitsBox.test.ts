import { describe, it, expect } from 'vitest';
import { idsSalidasDeBajante } from '../fixturesStorage';

// Bug "la caja AN duplica las UDs del ramal de salida": un ramal de SALIDA con `_tribReversed`
// invertía la geometría cola/cabeza y dejaba de detectarse como salida — el agregado del
// bajante/caja volvía a caminar su subárbol y re-fusionaba las UDs en su propia clave de
// salida, que crecía en cada pasada del efecto de propagación.

const caja = {
  id: 'CAN1',
  code: 'CAN1',
  net: 'san',
  x: 0,
  y: 0,
  recibeDeIds: ['RS2'],
  alimentaIds: ['RS1'],
};

describe('idsSalidasDeBajante — salidas de caja/bajante', () => {
  it('ramal de salida con _tribReversed (ini = código) se detecta por REFERENCIA', () => {
    const rs1 = {
      id: 'RS1',
      net: 'san',
      tipo: 'ramal',
      ini: 'CAN1',
      _tribReversed: true,
      pts: [
        [0, 0],
        [80, 0],
      ],
    };
    const out = idsSalidasDeBajante(caja, [rs1], 1);
    expect(out.has('RS1')).toBe(true);
  });

  it('ramal de salida sin _tribReversed se detecta por geometría (nace en el elemento)', () => {
    const rs1 = {
      id: 'RS1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [80, 0],
      ],
    };
    const out = idsSalidasDeBajante(caja, [rs1], 1);
    expect(out.has('RS1')).toBe(true);
  });

  it('el ramal que LLEGA (descarga en el elemento) NO es salida', () => {
    const rs2 = {
      id: 'RS2',
      net: 'san',
      tipo: 'ramal',
      fin: 'CAN1',
      pts: [
        [80, 40],
        [0, 0],
      ],
    };
    const out = idsSalidasDeBajante(caja, [rs2], 1);
    expect(out.has('RS2')).toBe(false);
  });

  it('ramal CORTO con ambos extremos dentro de la tolerancia: decide la dirección de flujo', () => {
    // Con cajas, _circ es la semidiagonal del cuadro (~0.7m) y se traga ramales cortos:
    // la salida es la que tiene el extremo de DESCARGA lejos del elemento.
    const cajaCirc = { ...caja, _circ: { r: 800 } };
    const corta = {
      id: 'RS1',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [0, 0],
        [30, 0],
      ],
    };
    // Nace en la caja y descarga lejos → salida.
    expect(idsSalidasDeBajante(cajaCirc, [corta], 1).has('RS1')).toBe(true);
    // Mismo trazo pero descargando EN la caja (llegada) → no es salida.
    const llegada = {
      id: 'RS2',
      net: 'san',
      tipo: 'ramal',
      pts: [
        [30, 0],
        [0, 0],
      ],
    };
    expect(idsSalidasDeBajante(cajaCirc, [llegada], 1).has('RS2')).toBe(false);
  });

  it('alimentaIds sin geometría útil también cuenta como salida', () => {
    const rs1 = { id: 'RS1', net: 'san', tipo: 'ramal', pts: [] as number[][] };
    const out = idsSalidasDeBajante(caja, [rs1], 1);
    expect(out.has('RS1')).toBe(true);
  });
});
