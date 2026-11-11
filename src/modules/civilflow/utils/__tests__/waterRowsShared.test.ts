import { describe, it, expect } from 'vitest';
import {
  isAf,
  isContador,
  isAC1,
  isAC2,
  chequeoPresionAparato,
  APARATO_PMAX_BY_CODE,
  HEATER_LOSS_FACTOR,
} from '../waterRowsShared.ts';
import type { Tramo } from '../../context/tramosReducer.ts';

/**
 * Clasificación de tramos de ac (Agua Caliente) y chequeo de presión por aparato:
 * AC-01 es el lado frío (red pública → contador) y AC-02 el caliente (contador → montante).
 * Ej: ini 'RP' siempre es AC-01; ini 'CNT...' siempre es AC-02.
 */

const t = (ini: string, fin: string): Tramo => ({ id: 'x', piso: 0, ini, fin, fixtures: {} });

describe('isAf / isContador', () => {
  it('solo la red "af" es agua fría', () => {
    expect(isAf('af')).toBe(true);
    expect(isAf('ac')).toBe(false);
    expect(isAf('san')).toBe(false);
  });

  it('contador por prefijo CNT/cntAF', () => {
    expect(isContador('CNT-1')).toBe(true);
    expect(isContador('cntAF-2')).toBe(true);
    expect(isContador('M1')).toBe(false);
  });
});

describe('isAC1 · lado frío', () => {
  it('todo tramo que toca la red pública (RP) es AC-01', () => {
    expect(isAC1(t('RP', 'CNT1'))).toBe(true);
    expect(isAC1(t('CNT1', 'RP'))).toBe(true);
  });

  it('red pública gana: aunque llegue al contador por el fin, sigue siendo AC-01', () => {
    expect(isAC1(t('RP', 'M1'))).toBe(true);
  });

  it('llega al contador desde un no-montante → AC-01', () => {
    expect(isAC1(t('AC-01', 'CNT1'))).toBe(true);
  });

  it('desde montante o bomba hacia el contador NO es AC-01 (es el lado caliente)', () => {
    expect(isAC1(t('M1', 'CNT1'))).toBe(false);
    expect(isAC1(t('B1', 'CNT1'))).toBe(false);
  });
});

describe('isAC2 · lado caliente', () => {
  it('tocar RP lo excluye aunque el ini sea contador', () => {
    expect(isAC2(t('CNT1', 'RP'))).toBe(false);
    expect(isAC2(t('RP', 'M1'))).toBe(false);
  });

  it('arranca en contador → AC-02', () => {
    expect(isAC2(t('CNT1', 'M1'))).toBe(true);
  });

  it('llega al contador desde montante/bomba → AC-02', () => {
    expect(isAC2(t('M1', 'CNT1'))).toBe(true);
    expect(isAC2(t('B2', 'CNT1'))).toBe(true);
  });

  it('otro tramo cualquiera no es AC-02', () => {
    expect(isAC2(t('M1', 'M2'))).toBe(false);
    expect(isAC2(t('RAF1', 'LAV'))).toBe(false);
  });
});

describe('chequeoPresionAparato · rango pmin–pmax NTC 1500', () => {
  it('fin "LVM" (lavamanos, 0.51–5.63 m.c.a.) dentro del rango → O.K.', () => {
    expect(chequeoPresionAparato('M1', 'LVM', 1, 2)).toBe('O.K.');
  });

  it('bajo pmin o sobre pmax → NO', () => {
    expect(chequeoPresionAparato('M1', 'LVM', 1, 0.3)).toBe('NO');
    expect(chequeoPresionAparato('M1', 'LVM', 1, 6)).toBe('NO');
  });

  it('el fin se chequea primero; si no da veredicto, cae al ini', () => {
    // fin sin presión >0 no dice nada → juzga el ini
    expect(chequeoPresionAparato('LVM', 'M2', 2, 0)).toBe('O.K.');
    // fin juzgado mal manda aunque el ini esté bien
    expect(chequeoPresionAparato('LVM', 'LVM', 2, 0.2)).toBe('NO');
  });

  it('el code se normaliza (trim + mayúsculas + sin ":"), igual que escribe el motor', () => {
    expect(chequeoPresionAparato('M1', ' lvm ', 1, 2)).toBe('O.K.');
  });

  it('sin aparato conocido, presión ausente o no positiva → cadena vacía (no juzga)', () => {
    expect(chequeoPresionAparato('M1', 'ZZZ', 1, 2)).toBe('');
    expect(chequeoPresionAparato('', '', 1, 2)).toBe('');
    expect(chequeoPresionAparato('M1', 'LVM', 1, 0)).toBe('');
  });

  it('los mapas por sigla usan la misma sigla que dibuja el motor ("Lvm:" → "LVM") y conservan el alias legacy HOR', () => {
    expect(APARATO_PMAX_BY_CODE.LVM).toBe(5.63);
    expect(APARATO_PMAX_BY_CODE.HORG).toBe(25); // horno grande
    expect(APARATO_PMAX_BY_CODE.HOR).toBe(25); // dibujos viejos con 'Hor:' renombrado a 'HorG:'
  });
});

describe('HEATER_LOSS_FACTOR', () => {
  it('el calentador se come el 10% de presión (0.9)', () => {
    expect(HEATER_LOSS_FACTOR).toBe(0.9);
  });
});
