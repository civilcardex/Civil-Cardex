import { describe, it, expect } from 'vitest';
import {
  sanMinDiamPulgForApparatus,
  sanDiamAllowedForApparatus,
  sanDiamLabelAllowedForApparatus,
  INODORO_APP_ID,
} from '../sanitaryDiamCompat';

// Ítems 7/8: la regla "inodoro → 4" mínimo" es una sola fuente de verdad, consistente
// entre asignación automática, panel derecho y menú contextual.

describe('sanitaryDiamCompat — regla central', () => {
  it('inodoro exige mínimo 4"', () => {
    expect(sanMinDiamPulgForApparatus(INODORO_APP_ID)).toBe(4);
    expect(sanDiamAllowedForApparatus(4, INODORO_APP_ID)).toBe(true);
    expect(sanDiamAllowedForApparatus(6, INODORO_APP_ID)).toBe(true);
    expect(sanDiamAllowedForApparatus(2, INODORO_APP_ID)).toBe(false);
    expect(sanDiamAllowedForApparatus(3, INODORO_APP_ID)).toBe(false);
  });

  it('otros aparatos no restringen el diámetro (el 2" es solo relleno)', () => {
    expect(sanMinDiamPulgForApparatus('lv')).toBe(0);
    expect(sanDiamAllowedForApparatus(2, 'lv')).toBe(true);
    expect(sanDiamAllowedForApparatus(1.5, 'lv')).toBe(true);
    expect(sanDiamAllowedForApparatus(4, 'lv')).toBe(true);
  });

  it('sin aparato (null/undefined) no restringe', () => {
    expect(sanMinDiamPulgForApparatus(undefined)).toBe(0);
    expect(sanMinDiamPulgForApparatus(null)).toBe(0);
    expect(sanDiamAllowedForApparatus(1, null)).toBe(true);
    expect(sanDiamAllowedForApparatus(2, undefined)).toBe(true);
  });

  it('valida desde la etiqueta completa del diámetro', () => {
    expect(sanDiamLabelAllowedForApparatus('4" — 100 mm', INODORO_APP_ID)).toBe(true);
    expect(sanDiamLabelAllowedForApparatus('2" — 50 mm', INODORO_APP_ID)).toBe(false);
    expect(sanDiamLabelAllowedForApparatus('1/2" — 12.7 mm', INODORO_APP_ID)).toBe(false);
    expect(sanDiamLabelAllowedForApparatus('1/2" — 12.7 mm', 'lv')).toBe(true);
  });
});
