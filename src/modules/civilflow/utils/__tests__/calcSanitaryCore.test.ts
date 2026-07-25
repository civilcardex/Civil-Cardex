import { describe, it, expect } from 'vitest';
import {
  relacionesHidraulicas,
  numeroFroude,
  fuerzaTractiva,
  tipoRegimen,
  diametroManning,
} from '../calcSanitaryCore';

describe('relacionesHidraulicas', () => {
  it('retorna valores en rango para q_Qo=0.03 (rama baja <=0.06)', () => {
    const r = relacionesHidraulicas(0.03);
    expect(r.q_Qo).toBe(0.03);
    expect(r.v_V0).toBeGreaterThan(0);
    expect(r.h_D).toBeGreaterThan(0);
    expect(r.h_D).toBeLessThan(1);
    expect(r.alpha).toBeGreaterThan(0);
    expect(r.Rh_D).toBeGreaterThan(0);
  });

  it('retorna valores en rango para q_Qo=0.15 (rama media 0.06-0.26)', () => {
    const r = relacionesHidraulicas(0.15);
    expect(r.q_Qo).toBe(0.15);
    expect(r.v_V0).toBeGreaterThan(0);
    expect(r.h_D).toBeGreaterThan(0);
  });

  it('retorna valores en rango para q_Qo=0.5 (rama alta >0.26)', () => {
    const r = relacionesHidraulicas(0.5);
    expect(r.q_Qo).toBe(0.5);
    expect(r.v_V0).toBeGreaterThan(0);
    expect(r.h_D).toBeGreaterThan(0);
  });

  it('clampa q_Qo minimo a 0.01', () => {
    const r = relacionesHidraulicas(0);
    expect(r.q_Qo).toBe(0.01);
  });

  it('clampa q_Qo maximo a 0.999', () => {
    const r = relacionesHidraulicas(1.5);
    expect(r.q_Qo).toBe(0.999);
  });

  it('v_V0 crece con q_Qo (monotonico)', () => {
    const r1 = relacionesHidraulicas(0.1);
    const r2 = relacionesHidraulicas(0.7);
    expect(r2.v_V0).toBeGreaterThan(r1.v_V0);
  });

  it('h_D crece con q_Qo (monotonico)', () => {
    const r1 = relacionesHidraulicas(0.1);
    const r2 = relacionesHidraulicas(0.3);
    expect(r2.h_D).toBeGreaterThan(r1.h_D);
  });
});

describe('numeroFroude', () => {
  it('calcula Fr correctamente', () => {
    const Fr = numeroFroude(1, 0.1);
    expect(Fr).toBeCloseTo(1 / Math.sqrt(9.80665 * 0.1), 4);
  });

  it('retorna Infinity para DH=0', () => {
    expect(numeroFroude(1, 0)).toBe(Infinity);
  });

  it('retorna Infinity para DH negativo', () => {
    expect(numeroFroude(1, -0.1)).toBe(Infinity);
  });

  it('Fr < 1 para V baja y DH grande', () => {
    const Fr = numeroFroude(0.5, 1);
    expect(Fr).toBeLessThan(1);
  });

  it('Fr > 1 para V alta y DH chico', () => {
    const Fr = numeroFroude(5, 0.05);
    expect(Fr).toBeGreaterThan(1);
  });
});

describe('fuerzaTractiva', () => {
  it('calcula fuerza tractiva en Pa', () => {
    const tau = fuerzaTractiva(0.05, 0.02);
    expect(tau).toBeCloseTo(1000 * 0.05 * 0.02, 4);
  });

  it('retorna 0 para Rh <= 0', () => {
    expect(fuerzaTractiva(0, 0.02)).toBe(0);
  });

  it('retorna 0 para S <= 0', () => {
    expect(fuerzaTractiva(0.05, 0)).toBe(0);
  });

  it('retorna 0 para ambos <= 0', () => {
    expect(fuerzaTractiva(-0.1, -0.01)).toBe(0);
  });

  it('tau >= 0.15 Pa para pendiente tipica 2% y D=100mm', () => {
    const Rh = 0.1 / 4;
    const tau = fuerzaTractiva(Rh, 0.02);
    expect(tau).toBeGreaterThanOrEqual(0.15);
  });
});

describe('tipoRegimen', () => {
  it('Subcrítico para Fr < 0.9', () => {
    expect(tipoRegimen(0.5)).toBe('Subcrítico');
    expect(tipoRegimen(0.89)).toBe('Subcrítico');
  });

  it('Crítico para 0.9 <= Fr <= 1.1', () => {
    expect(tipoRegimen(0.9)).toBe('Crítico');
    expect(tipoRegimen(1.0)).toBe('Crítico');
    expect(tipoRegimen(1.1)).toBe('Crítico');
  });

  it('Supercrítico para Fr > 1.1', () => {
    expect(tipoRegimen(1.2)).toBe('Supercrítico');
    expect(tipoRegimen(5)).toBe('Supercrítico');
  });

  it('maneja Infinity (Fr por DH=0)', () => {
    expect(tipoRegimen(Infinity)).toBe('Supercrítico');
  });
});

describe('diametroManning edge cases', () => {
  it('retorna 0 para Q_m3s <= 0', () => {
    expect(diametroManning(0, 0.009, 0.02)).toBe(0);
    expect(diametroManning(-0.001, 0.009, 0.02)).toBe(0);
  });

  it('retorna 0 para n <= 0', () => {
    expect(diametroManning(0.005, 0, 0.02)).toBe(0);
    expect(diametroManning(0.005, -0.001, 0.02)).toBe(0);
  });

  it('retorna 0 para S <= 0', () => {
    expect(diametroManning(0.005, 0.009, 0)).toBe(0);
  });

  it('diametro crece con mayor caudal (monotonicidad)', () => {
    const d1 = diametroManning(0.001, 0.009, 0.02);
    const d2 = diametroManning(0.01, 0.009, 0.02);
    expect(d2).toBeGreaterThan(d1);
  });

  it('diametro decrece con mayor pendiente', () => {
    const d1 = diametroManning(0.005, 0.009, 0.01);
    const d2 = diametroManning(0.005, 0.009, 0.04);
    expect(d2).toBeLessThan(d1);
  });
});
