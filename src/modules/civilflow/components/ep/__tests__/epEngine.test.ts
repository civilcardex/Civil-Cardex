/** Paridad del motor EPC contra la PRUEBA DE ACEPTACIÓN de la HU de integración
 *  (docx del 10/11/2026): el EPC integrado debe dar EXACTAMENTE estos valores (verificados
 *  a mano contra el HTML de referencia). Caso red + variante cisterna. */
import { describe, expect, it } from 'vitest';
import { calcularEpc, EP_MATS, type EpcIn } from '../epEngine.ts';
import { apMatch } from '../epAparatos.ts';

const base: EpcIn = {
  modo: 'red',
  qac: 12.8,
  hfac: 11.9,
  pred: 10,
  pmin: 7.13,
  apcrit: 'Ducha',
  apsel: apMatch('Ducha'),
  pmax: 50,
  zbomba: -2.5,
  ztop: 31.7,
  poffmax: 63.6,
  altitud: 0,
  temp: 20,
  margen: 2,
  dif: 5,
  qminp: 10,
  ciclos: 20,
  etab: 0.72,
  etam: 0.9,
  fs: 1.25,
  vsuc: 1.2,
  vimp: 2,
  nt: 2,
  nr: 1,
  mat: 'pvc40',
  hfauto: true,
  hfotros: 0,
  zcis: 0,
  hfcis: 0,
  diasauto: 1,
  vincendio: 0,
  usos: [],
  cisHu: 2,
  cisHs: 0.1,
  cisBl: 0.3,
  cisQa: null,
  cisHsum: 24,
  cisDc: false,
  potSel: 0,
};

describe('motor EPC — prueba de aceptación de la HU (caso red)', () => {
  const R = calcularEpc(base);
  const cer = (x: number, esperado: number): void =>
    expect(x).toBeCloseTo(esperado, Math.max(0, 2 - Math.floor(Math.log10(Math.abs(esperado)))));

  it('P mínima en la descarga = 53,23 m.c.a.', () => cer(R.pdesc, 53.23));
  it('Arranque 56,0 · P objetivo 58,5 · parada 61,0', () => {
    expect(R.ponMca).toBe(56);
    expect(R.pset).toBe(58.5);
    expect(R.poffMca).toBe(61);
  });
  it('Hf_otros calculado = 1,43 m.c.a.', () => expect(R.hfotros).toBeCloseTo(1.43, 2));
  it('HMT de selección 49,93 · altura a caudal cero 51,0', () => {
    expect(R.hmt).toBeCloseTo(49.93, 1);
    expect(R.hcero).toBeCloseTo(51, 0);
  });
  it('NPSH disponible 19,82 m (0 msnm, 20 °C)', () => expect(R.npshd).toBeCloseTo(19.82, 1));
  it('Qb 6,40 · potencia sugerida 8,11 HP · motor 10 HP (7,5 kW)', () => {
    expect(R.qb).toBeCloseTo(6.4, 2);
    expect(R.pins).toBeCloseTo(8.11, 1);
    expect(R.potComHp).toBe(10);
    expect(R.potComKw).toBe(7.5);
  });
  it('Tanque 449 L · precarga N₂ 50,4 m.c.a.', () => {
    expect(R.vtk).toBeCloseTo(449, 0);
    expect(R.pn2Mca).toBeCloseTo(50.4, 1);
  });
  it('Colectores succión / impulsión DN 150 / DN 100', () => {
    expect(R.dnSuc.dn).toBe(150);
    expect(R.dnImp.dn).toBe(100);
  });
  it('Tarado PSV 67,1 m.c.a.', () => expect(R.psv).toBeCloseTo(67.1, 1));
  it('Sin alertas', () => expect(R.alertas).toEqual([]));
  it('Sin datos incompletos', () => expect(R.incompleto).toBeNull());
});

describe('motor EPC — variante cisterna de la HU', () => {
  const R = calcularEpc({
    ...base,
    modo: 'cis',
    zcis: -4,
    hfcis: 0.5,
    diasauto: 1,
    vincendio: 36000,
    usos: [{ k: 0, c: 192, d: 150 }], // 192 hab × 150 L/d
    cisDc: true, // dos compartimentos
  });

  it('HMT 61,85 m', () => expect(R.hmt).toBeCloseTo(61.85, 1));
  it('NPSH 7,90 m', () => expect(R.npshd).toBeCloseTo(7.9, 1));
  it('Motor 12,5 HP', () => expect(R.potComHp).toBe(12.5));
  it('Cisterna 2 × 3,80 × 1,90 m · H 5,25 m · 75,7 m³ construidos', () => {
    expect(R.cis?.nC).toBe(2);
    expect(R.cis?.lC).toBeCloseTo(3.8, 2);
    expect(R.cis?.bC).toBeCloseTo(1.9, 2);
    expect(R.cis?.hTot).toBeCloseTo(5.25, 2);
    expect(R.cis?.vgeo).toBeCloseTo(75.7, 0);
  });
  it('Sin alertas', () => expect(R.alertas).toEqual([]));
});

describe('regresiones de la auditoría (hallazgos cerrados V9→actual)', () => {
  it('β Boyle CON precarga: Vt entrega el volumen pedido (28,8 L útiles por ciclo)', () => {
    const R = calcularEpc(base);
    // Boyle con presiones absolutas: agua entregada = Vt·β = Vu → exacto por construcción.
    expect(R.vu).toBeCloseTo(28.8, 1);
    expect(R.vtk).toBeCloseTo(R.vu / R.alfa, 0);
  });
  it('z_top ≤ z_bomba → dato faltante con la regla explícita', () => {
    const R = calcularEpc({ ...base, ztop: -3 });
    expect(R.incompleto?.some((x) => x.includes('z_top'))).toBe(true);
  });
  it('Banda 0 → el tanque no se calcula (alerta er)', () => {
    const R = calcularEpc({ ...base, dif: 0 });
    expect(R.alertas.some((a) => a.tipo === 'er' && a.msg.includes('banda'))).toBe(true);
  });
  it('Parada sobre la admisible de la tubería → alerta er con material sugerido', () => {
    // PVC40 DN150 admite 126,55 m.c.a.: con banda 75 la parada (131) la supera.
    const R = calcularEpc({ ...base, mat: 'pvc40', poffmax: 999, dif: 75 });
    expect(R.poffMca).toBeGreaterThan(R.paMin ?? 0);
    expect(R.alertas.some((a) => a.msg.includes('supera la admisible'))).toBe(true);
  });
  it('poffmax superada por la parada → recomendación ℹ para la RED (VRP), no error del equipo', () => {
    const R = calcularEpc({ ...base, poffmax: 50 });
    expect(R.alertas.some((a) => a.tipo === 'in' && a.msg.includes('P máx. del sistema'))).toBe(
      true,
    );
  });
  it('Material del cuarto con pa null (cobre) NO dispara la alerta de admisible', () => {
    const R = calcularEpc({ ...base, mat: 'cuL' });
    expect(R.paMin).toBeNull();
    expect(R.alertas.some((a) => a.msg.includes('admisible'))).toBe(false);
  });
  it('nt < 1 se calcula con 1 y alerta er; nr = 0 alerta wa con fix', () => {
    const R = calcularEpc({ ...base, nt: 0, nr: 0 });
    expect(R.alertas.some((a) => a.msg.includes('Bombas en trabajo'))).toBe(true);
    const wa = R.alertas.find((a) => a.msg.includes('bomba de reserva'));
    expect(wa?.fix?.t).toBe('Poner 1 de reserva');
  });
  it('El aparato crítico matchea por regex: «Ducha confort» → Ducha (HU: nombre del Perfil)', () => {
    expect(apMatch('Ducha confort')).toBe(9);
    expect(apMatch('ducha con mezcladora termostática')).toBe(10);
    expect(apMatch('inodoro')).toBe(15);
    expect(apMatch('Xylofagia')).toBe(-1);
  });
  it('MATS: los 6 materiales cargan y el acero admite 200 m.c.a. en todos los DN', () => {
    expect(Object.keys(EP_MATS)).toHaveLength(6);
    expect(EP_MATS.ac40.d.every((x) => x[2] === 200)).toBe(true);
  });
});
