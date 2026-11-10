/** Catálogo de normativa RCI por país: 6 países activos, fallback Colombia (país eliminado o
 *  desconocido), CO trae NSR-10 y bloque sísmico; BO sin regla sísmica RCI verificable.
 *  Ej: perfilRciDe('Perú').codLocal = 'RNE A.130 · NTP 350.043-1'. */
import { describe, it, expect } from 'vitest';
import { NORMAS_RCI_PAIS, perfilRciDe, rciTxt } from '../rciCountryStandards.ts';
import { NORMAS_PAIS } from '../countryStandards.ts';

describe('normativa RCI por país', () => {
  it('los 6 países activos tienen perfil RCI', () => {
    for (const p of NORMAS_PAIS) expect(NORMAS_RCI_PAIS[p.id]).toBeTruthy();
    expect(Object.keys(NORMAS_RCI_PAIS)).toHaveLength(6);
  });

  it('cada perfil trae código local y cita de norma', () => {
    for (const [, p] of Object.entries(NORMAS_RCI_PAIS)) {
      expect(p.codLocal.length).toBeGreaterThan(0);
      expect(p.citaRci).toContain('NFPA 13');
    }
  });

  it('fallback Colombia: país eliminado o desconocido', () => {
    expect(perfilRciDe('México').codLocal).toBe(NORMAS_RCI_PAIS.CO.codLocal);
    expect(perfilRciDe('Atlántida').codLocal).toBe(NORMAS_RCI_PAIS.CO.codLocal);
    expect(perfilRciDe(undefined).citaRci).toBe(NORMAS_RCI_PAIS.CO.citaRci);
  });

  it('CO trae NSR-10 y bloque sísmico completo', () => {
    const co = perfilRciDe('Colombia');
    expect(co.codLocal).toContain('NSR-10');
    expect(co.reqSismo).toBe('Sí');
    expect(co.normSis).toContain('NSR-10');
    expect(co.parLabel).toContain('Aa');
  });

  it('BO sin regla sísmica RCI verificable: bloque sísmico vacío', () => {
    const bo = perfilRciDe('Bolivia');
    expect(bo.reqSismo).toBeUndefined();
    expect(bo.normSis).toBeUndefined();
  });

  it('rciTxt devuelve la cita corta', () => {
    expect(rciTxt('Chile')).toContain('DS 44');
    expect(rciTxt('Perú')).toContain('RNE A.130');
  });
});
