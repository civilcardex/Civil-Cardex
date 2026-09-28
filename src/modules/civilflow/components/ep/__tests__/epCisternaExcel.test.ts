import { describe, it, expect } from 'vitest';
import { dec } from '../../../utils/parseDecimal';

// Comparación contra el Excel CIVILFLOW_EPC hojas "CÁLCULO EPC" + "CISTERNA"
// con sus valores de ejemplo (modo cisterna). Fórmulas extraídas del dump OOXML.
const X = {
  qac: 0.8, // C22
  qasc: 0.4, // C23
  hfac: 8.5, // C27
  hfacs: 5.2, // C28
  hfotros: 0, // C29
  pred: 20.39, // C33
  pmin: 7.13, // C34
  pmax: 51, // C35
  zbomba: 0, // C36
  ztop: 28, // C37
  zcis: -3, // CISTERNA C6
  hfcis: 0.5, // CISTERNA C7
  nt: 2, // C41
  etab: 0.72, // C48
  etam: 0.92, // C49
  fs: 1.25, // C50
  ciclos: 6, // C51
  alfa: 0.3, // C53
  // Valores cacheados del Excel (resultados):
  X_HMT_CIST: 47.13, // CISTERNA C10
  X_HgTotal: 31, // CISTERNA C8
  X_HfTotal: 9, // CISTERNA C9
  X_Qd: 0.8, // C65
  X_Qm3h: 2.88, // C66
  X_Qgpm: 0.8 * 15.8503, // C67
  X_Qb: 0.4, // C68
  X_Phew: 182.38752, // C82
  X_PfrenW: 275.34347826086963, // C83
  X_PfrenHP: 0.36924162298628083, // C84
  X_PinsHP: 0.46155202873285106, // C85
  X_PinsKW: 0.34417934782608706, // C86
  X_Pon: 47.13, // C92 con HMT cisterna
  X_Poff: 47.13 * 1.1, // C93
  X_PonBar: (47.13 * 9.81) / 100, // C94
  X_Vu: 2, // C97
  X_Vt: 6.666666666666667, // C98
  X_VolConsumo: 20000, // CISTERNA C18
  X_VolTotal: 20000, // CISTERNA C19
  X_NPSHd: 4.8599999999999994, // CISTERNA C27
};

const appCalc = (ep: Record<string, number>) => {
  const Qd = Math.max(ep.qac, ep.qasc);
  const Qb = ep.nt > 0 ? Qd / ep.nt : Qd;
  const Hg = ep.ztop - ep.zcis; // cisterna
  const HfCrit = Math.max(ep.hfac, ep.hfacs);
  const Hf = HfCrit + ep.hfotros + ep.hfcis;
  const HMT = Hg + Hf + ep.pmin; // cisterna: sin Pred
  const Phid = 1000 * 9.81 * (Qd / 1000) * (HMT > 0 ? HMT : 0);
  const PfrenW = ep.etab * ep.etam > 0 ? Phid / (ep.etab * ep.etam) : 0;
  const PfrenHP = PfrenW / 745.7;
  const PinsHP = PfrenHP * ep.fs;
  const PinsKW = (PfrenHP * 745.7 * ep.fs) / 1000;
  const Pon = HMT;
  const Poff = Pon * 1.1;
  const PonBar = (Pon * 9.81) / 100;
  const Vu = ep.ciclos > 0 ? (Qd * 60) / (4 * ep.ciclos) : 0;
  const Vt = ep.alfa > 0 ? Vu / ep.alfa : 0;
  const volConsumo = ep.dotL * ep.nUsuarios * ep.diasAut;
  const volTotal = volConsumo + ep.bciL;
  const npshd = ep.patm - ep.pv - Math.abs(ep.zcis) - ep.hfcis;
  return {
    Qd,
    Qb,
    Hg,
    HfCrit,
    Hf,
    HMT,
    Phid,
    PfrenW,
    PfrenHP,
    PinsHP,
    PinsKW,
    Pon,
    Poff,
    PonBar,
    Vu,
    Vt,
    volConsumo,
    volTotal,
    npshd,
  };
};

describe('EPC cisterna — paridad con Excel (hojas 1 y 2)', () => {
  const ep = {
    ...X,
    dotL: 200, // CISTERNA C14
    nUsuarios: 100, // C15
    diasAut: 1, // C16
    bciL: 0, // C17
    patm: 8.6, // C24
    pv: 0.24, // C25
    npshr: 2, // C26
  };
  const a = appCalc(ep);
  const close = (app: number, xl: number, tol = 1e-6) =>
    Math.abs(app - xl) < tol * Math.max(1, Math.abs(xl));

  it('Hg_total = z_top − z_cis (C8)', () => expect(close(a.Hg, X.X_HgTotal)).toBe(true));
  it('Hf_total = MAX + otros + Hf_suc (C9)', () => expect(close(a.Hf, X.X_HfTotal)).toBe(true));
  it('HMT cisterna = Hg+Hf+Pmin (C10)', () => expect(close(a.HMT, X.X_HMT_CIST)).toBe(true));
  it('Qd = MAX (C65)', () => expect(close(a.Qd, X.X_Qd)).toBe(true));
  it('Qd m³/h (C66)', () => expect(close(a.Qd * 3.6, X.X_Qm3h)).toBe(true));
  it('Qd GPM factor 15.8503 (C67)', () => expect(close(a.Qd * 15.8503, X.X_Qgpm)).toBe(true));
  it('Qb = Qd/Nt (C68)', () => expect(close(a.Qb, X.X_Qb)).toBe(true));
  // Los caches C82-C86 del Excel quedaron del estado RED (HMT 23.24, C76=23.24 cache);
  // en modo CISTERNA el Excel calcularía con HMT=47.13 (C10). Verifico AMBOS con la
  // fórmula C82/C83/C84/C85/C86 exacta:
  const pot = (hmt: number) => {
    const Phid = 1000 * 9.81 * (X.qac / 1000) * hmt;
    const PfrenW = Phid / (X.etab * X.etam);
    const PfrenHP = PfrenW / 745.7;
    return {
      Phid,
      PfrenW,
      PfrenHP,
      PinsHP: PfrenHP * X.fs,
      PinsKW: (PfrenHP * 745.7 * X.fs) / 1000,
    };
  };
  const potCist = pot(X.X_HMT_CIST); // modo cisterna → HMT 47.13
  it('P_hid con HMT cisterna (fórmula C82)', () => expect(close(a.Phid, potCist.Phid)).toBe(true));
  it('P_freno W (fórmula C83)', () => expect(close(a.PfrenW, potCist.PfrenW)).toBe(true));
  it('P_freno HP (fórmula C84)', () => expect(close(a.PfrenHP, potCist.PfrenHP)).toBe(true));
  it('P ×F.S. HP (fórmula C85)', () => expect(close(a.PinsHP, potCist.PinsHP)).toBe(true));
  it('P ×F.S. kW (fórmula C86)', () => expect(close(a.PinsKW, potCist.PinsKW)).toBe(true));
  it('modos RED: potencia del cache Excel (HMT 23.24) también matchea la fórmula', () => {
    const potRed = pot(23.24);
    expect(close(potRed.Phid, X.X_Phew)).toBe(true);
    expect(close(potRed.PfrenW, X.X_PfrenW)).toBe(true);
    expect(close(potRed.PinsHP, X.X_PinsHP)).toBe(true);
    expect(close(potRed.PinsKW, X.X_PinsKW)).toBe(true);
  });
  it('P_on = HMT (C92/C10)', () => expect(close(a.Pon, X.X_Pon)).toBe(true));
  it('P_off = ×1.10 (C93)', () => expect(close(a.Poff, X.X_Poff)).toBe(true));
  it('P_on bar = ×9.81/100 (C94)', () => expect(close(a.PonBar, X.X_PonBar)).toBe(true));
  it('Vu = Qd·60/(4n) (C97)', () => expect(close(a.Vu, X.X_Vu)).toBe(true));
  it('Vt = Vu/α (C98)', () => expect(close(a.Vt, X.X_Vt)).toBe(true));
  it('Volumen consumo (CISTERNA C18)', () =>
    expect(close(a.volConsumo, X.X_VolConsumo)).toBe(true));
  it('Volumen total (CISTERNA C19)', () => expect(close(a.volTotal, X.X_VolTotal)).toBe(true));
  it('NPSHd = Patm − Pv − |z_cis| − Hf_suc (C27)', () =>
    expect(close(a.npshd, X.X_NPSHd)).toBe(true));
  it('NPSHd ≥ NPSHr + 0.5 → ✓ (C28)', () => expect(a.npshd >= ep.npshr + 0.5).toBe(true));
  it('desc() tolera coma decimal (input usuario)', () => expect(dec('2,88')).toBeCloseTo(2.88, 9));
});
