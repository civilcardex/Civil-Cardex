import { describe, it, expect } from 'vitest';
import { sanaCelda, sanaTabla, sanaTablas } from '../sanReport.ts';
import { validaDocTrazos } from '../../services/storage/validateDocStrokes.ts';

// La memoria de cálculo es un ENTREGABLE FIRMABLE: un NaN o un Infinity en una columna de
// cálculo es un defecto legal del documento que se le entrega al cliente.

describe('sanaCelda · la frontera de exportación', () => {
  it('un número finito pasa intacto', () => {
    expect(sanaCelda(4.5)).toBe(4.5);
    expect(sanaCelda(0)).toBe(0);
  });

  it('NaN e Infinity se vuelven guion largo', () => {
    expect(sanaCelda(NaN)).toBe('—');
    expect(sanaCelda(Infinity)).toBe('—');
    expect(sanaCelda(-Infinity)).toBe('—');
  });

  it('null y undefined se vuelven guion largo', () => {
    expect(sanaCelda(null)).toBe('—');
    expect(sanaCelda(undefined)).toBe('—');
  });

  it('una cadena que contiene NaN o Infinity también se sanea', () => {
    expect(sanaCelda('NaN')).toBe('—');
    expect(sanaCelda('Infinity"')).toBe('—');
    expect(sanaCelda('undefined')).toBe('—');
  });

  it('una cadena normal pasa intacta', () => {
    expect(sanaCelda('BAN1')).toBe('BAN1');
    expect(sanaCelda('2,5 m')).toBe('2,5 m');
  });
});

describe('sanaTabla · todas las celdas de la tabla', () => {
  it('limpia cada celda de cada fila y conserva la forma', () => {
    const t = {
      title: 'Bajantes',
      headers: ['Código', 'Radio', 'D. calc'],
      rows: [
        ['BAN1', 0, Infinity],
        ['BAN2', NaN, 2.5],
      ],
    };
    const out = sanaTabla(t);
    expect(out.rows[0]).toEqual(['BAN1', 0, '—']);
    expect(out.rows[1]).toEqual(['BAN2', '—', 2.5]);
    // La tabla original NO se muta (el caller puede seguir usándola).
    expect(t.rows[0][2]).toBe(Infinity);
  });

  it('sanaTablas devuelve undefined si no hay tablas', () => {
    expect(sanaTablas(undefined)).toBeUndefined();
  });
});

describe('validaDocTrazos · forma del doc de un plano', () => {
  it('acepta un doc normal', () => {
    expect(validaDocTrazos({ ramales: [], bajantes: [] })).toBeTruthy();
  });

  it('acepta un doc JSON en string', () => {
    expect(validaDocTrazos('{"ramales":[],"bajantes":[]}')).toBeTruthy();
  });

  it('acepta un doc sin colecciones (piso nuevo)', () => {
    expect(validaDocTrazos({ ts: 1 })).toBeTruthy();
  });

  it('rechaza un doc con "ramales" como objeto (era vieja)', () => {
    // Con esto, dedupPorId iteraba los VALORES y el motor recibía piezas sin id.
    expect(validaDocTrazos({ ramales: { RAF1: { pts: [] } } })).toBeNull();
  });

  it('rechaza un doc con "bajantes" no-array (el piso aparecería vacío)', () => {
    expect(validaDocTrazos({ bajantes: 'nope' })).toBeNull();
  });

  it('rechaza un JSON corrupto sin lanzar', () => {
    expect(validaDocTrazos('{no es json')).toBeNull();
  });

  it('rechaza null/undefined', () => {
    expect(validaDocTrazos(null)).toBeNull();
    expect(validaDocTrazos(undefined)).toBeNull();
  });
});
