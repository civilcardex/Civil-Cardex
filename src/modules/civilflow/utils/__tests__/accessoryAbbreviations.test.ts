import { describe, it, expect } from 'vitest';
import { ACC_ABBR, bajanteLabel, ramalLabel } from '../accessoryAbbreviations.ts';

/**
 * Las etiquetas compactas de accesorios y de bajantes/ramales con sufijo de piso.
 * Ej: bajante BAN2 con pisoBase "Piso 2" → "BAN2-P2" (el canvas muestra lo mismo).
 */

describe('ACC_ABBR · abreviaturas por id de accesorio', () => {
  it('cada id del catálogo tiene abreviatura corta y estable', () => {
    expect(ACC_ABBR.sifon).toBe('SIF');
    expect(ACC_ABBR.codo90rm).toBe('C90M');
    expect(ACC_ABBR.valvCheque).toBe('VCHE');
    expect(ACC_ABBR.te_linea).toBe('TLIN');
    expect(ACC_ABBR.valvula_bola).toBe('VBOL');
  });

  it('los alias de sube/baja comparten abreviatura con sus equivalentes del catálogo', () => {
    expect(ACC_ABBR.codoSube).toBe(ACC_ABBR.codo90rmSube); // 'CSUB'
    expect(ACC_ABBR.codoBaja).toBe(ACC_ABBR.codo90rmBaja); // 'CBAJ'
    expect(ACC_ABBR.codo90rl).toBe(ACC_ABBR.codos_90_rl); // 'C90L'
  });
});

describe('bajanteLabel · "code-piso"', () => {
  it('pisoBase del objeto manda sobre el nivelLabel de respaldo', () => {
    expect(bajanteLabel({ code: 'BAN2', pisoBase: 'Piso 2' }, 'Piso 7')).toBe('BAN2-P2');
  });

  it('sin pisoBase usa el nivelLabel; sin ninguno deja solo el código', () => {
    expect(bajanteLabel({ code: 'BAN2' }, 'Sótano 1')).toBe('BAN2-S1');
    expect(bajanteLabel({ code: 'BAN2' })).toBe('BAN2');
  });

  it('pisoBase ya corto ("P2") y "Cubierta" pasan por shortenPiso', () => {
    expect(bajanteLabel({ code: 'BAN1', pisoBase: 'P2' })).toBe('BAN1-P2');
    expect(bajanteLabel({ code: 'BAN1', pisoBase: 'Cubierta' })).toBe('BAN1-C');
    expect(bajanteLabel({ code: 'BAN1', pisoBase: 'Sótano 2' })).toBe('BAN1-S2');
  });

  it('sin code cae al id; null sin nivel deja cadena vacía', () => {
    expect(bajanteLabel({ id: 'b-42', pisoBase: 'Piso 1' })).toBe('b-42-P1');
    expect(bajanteLabel(null)).toBe('');
  });

  it('dato: bajante null CON nivelLabel sí arma sufijo ("-P3") — el código es "" y el piso se añade igual', () => {
    expect(bajanteLabel(undefined, 'Piso 3')).toBe('-P3');
  });

  it('un piso que no es "Piso N"/"Sótano N"/"Cubierta" se deja tal cual', () => {
    expect(bajanteLabel({ code: 'BAN1', pisoBase: 'Mezanine' })).toBe('BAN1-Mezanine');
  });
});

describe('ramalLabel · igual que el canvas', () => {
  it('label + nivelLabel → "RS1-P1"', () => {
    expect(ramalLabel({ label: 'RS1' }, 'Piso 1')).toBe('RS1-P1');
  });

  it('sin label usa id; null con nivel devuelve "-P2" (código vacío + sufijo, igual que bajanteLabel)', () => {
    expect(ramalLabel({ id: 'r-9' }, 'Piso 2')).toBe('r-9-P2');
    expect(ramalLabel({ label: 'RS1' })).toBe('RS1');
    expect(ramalLabel(null, 'Piso 2')).toBe('-P2');
  });
});
