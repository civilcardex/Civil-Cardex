import { describe, it, expect, beforeEach } from 'vitest';
import { computeEpTables, epAlertas } from '../equipmentRows.ts';
import { AGUA_DENSIDAD, GRAVEDAD } from '../calcSanitaryCore.ts';
import { NEMA_HP } from '../../components/ep/calcs.ts';
import type { EPData } from '../../components/ep/EPShared';

/**
 * Las 12 tablas de memoria del Equipo de Presión (ep) replican las fórmulas de las
 * pantallas leyendo storage. Ej: HMT = Hg + Hf + pmin − pred (red) — con ztop 10,
 * zbomba 0, hf 2.5, pmin 10 y pred 20 → HMT 2.5 m.c.a.
 */

beforeEach(() => {
  localStorage.clear();
});

const epBase: EPData = {
  qac: '5',
  qasc: '3',
  hfac: '2',
  hfacs: '1',
  hfotros: '0.5',
  pred: '20',
  pmin: '10',
  pmax: '60',
  zbomba: '0',
  ztop: '10',
  zcis: '0',
  hfcis: '0',
  nt: '2',
  nr: '1',
  etab: '0.65',
  etam: '0.85',
  fs: '1.15',
  ciclos: '6',
  alfa: '0.3',
  vsuc: '1.5',
  vimp: '2.0',
  dnsuc: '',
  dnimp: '',
  modo: 'red',
  pcomercial: '',
  dotL: '',
  nUsuarios: '',
  diasAut: '',
  bciL: '',
} as unknown as EPData;

const guardar = (ep: EPData) => localStorage.setItem('civilflow_ep', JSON.stringify(ep));
const fila = (t: { title: string; rows: unknown[][] }, label: string) =>
  t.rows.find((r) => r[0] === label) as unknown[] | undefined;

describe('computeEpTables · memoria Equipo de Presión', () => {
  it('sin equipo guardado no hay tablas y epAlertas da null', () => {
    expect(computeEpTables()).toEqual([]);
    expect(epAlertas()).toBeNull();
  });

  it('modo red: exactamente 12 tablas y la de presiones incluye la acometida', () => {
    guardar(epBase);
    const tabs = computeEpTables();
    expect(tabs).toHaveLength(12);
    const presiones = tabs[1];
    expect(fila(presiones, 'Presión acometida (red pública en entrega)')).toBeDefined();
    const manometrica = tabs[5];
    expect(manometrica.title).toContain('succión directa');
    // en modo red no hay filas de cisterna
    expect(fila(manometrica, 'Desnivel total')).toBeUndefined();
  });

  it('física de caudales: Qd = MAX(qac,qasc), Qm3h ×3.6, Qgpm ×15.85, Qb = Qd/nt', () => {
    guardar(epBase);
    const caudales = computeEpTables()[7];
    expect(fila(caudales, 'Qd = MAX(Qac, Qasc)')![1]).toBe('5.000');
    expect(fila(caudales, 'Qd en m³/h')![1]).toBe('18.00');
    expect(fila(caudales, 'Qd en GPM')![1]).toBe('79.3');
    expect(fila(caudales, 'Qb = Qd / Nt')![1]).toBe('2.500');
  });

  it('HMT en modo red: Hg + Hf + pmin − pred = 10 + 2.5 + 10 − 20 = 2.5', () => {
    guardar(epBase);
    const manometrica = computeEpTables()[5];
    expect(fila(manometrica, 'Altura manométrica total HMT')![1]).toBe('✓ 2.50');
    // sin HMT > pmax: verificación ok
    expect(fila(manometrica, 'Verificación presión máxima del sistema')![1]).toBe(
      '✓ HMT dentro del límite',
    );
  });

  it('potencias: Phid = ρ·g·Q·HMT; al freno ÷(ηb·ηm); en HP ÷745.7; NEMA primera que cubre', () => {
    guardar(epBase);
    const potencia = computeEpTables()[6];
    const Phid = AGUA_DENSIDAD * GRAVEDAD * (5 / 1000) * 2.5; // 122.58 W
    const Pfreno = Phid / (0.65 * 0.85); // 221.88 W
    expect(fila(potencia, 'Potencia hidráulica')![1]).toBe(String(Math.round(Phid)));
    // "Potencia al freno" sale dos veces (W y HP): filas por unidad
    const freno = potencia.rows.filter((r) => r[0] === 'Potencia al freno') as unknown[][];
    expect(freno[0][1]).toBe(String(Math.round(Pfreno)));
    expect(freno[0][2]).toBe('W');
    expect(freno[1][1]).toBe((Pfreno / 745.7).toFixed(3)); // '0.298'
    expect(freno[1][2]).toBe('HP');
    expect(fila(potencia, 'Potencia comercial seleccionada')![1]).toBe('0.5'); // primera NEMA ≥ 0.3425
    expect(NEMA_HP[0]).toBe(0.5);
    expect(fila(potencia, 'Margen potencia comercial vs calculada')![1]).toBe('+46.1%');
    expect(fila(potencia, 'Verificación potencia comercial')![1]).toBe('✓ Adecuada');
  });

  it('setpoint del tanque: Poff = Pon ×1.10, N₂ = 0.90·Pon en bar (÷10.2), Vu y Vt', () => {
    guardar(epBase);
    const setpoint = computeEpTables()[8];
    expect(fila(setpoint, 'Presión de arranque')![1]).toBe('2.50');
    expect(fila(setpoint, 'Presión de paro')![1]).toBe('2.75');
    expect(fila(setpoint, 'Precarga de nitrógeno N₂')![1]).toBe('0.22'); // 2.25/10.2
    expect(fila(setpoint, 'Volumen útil Vu')![1]).toBe('12.5'); // 5·60/(4·6)
    // "Volumen total tanque Vt" sale dos veces (L y m³)
    const vt = setpoint.rows.filter((r) => r[0] === 'Volumen total tanque Vt') as unknown[][];
    expect(vt[0][1]).toBe('41.7'); // 12.5/0.3
    expect(vt[0][2]).toBe('L');
    expect(vt[1][1]).toBe('0.042'); // m³
  });

  it('pcomercial manual pisa la NEMA automática', () => {
    guardar({ ...epBase, pcomercial: '3' } as EPData);
    const potencia = computeEpTables()[6];
    expect(fila(potencia, 'Potencia comercial seleccionada')![1]).toBe('3');
  });

  it('modo cisterna: el desnivel usa zcis y HMT NO descuenta pred (sin fila de acometida)', () => {
    guardar({ ...epBase, modo: 'cisterna', hfcis: '0.5', pred: '' } as EPData);
    const tabs = computeEpTables();
    const manometrica = tabs[5];
    expect(manometrica.title).toContain('cisterna');
    expect(fila(manometrica, 'Presión acometida (red pública en entrega)')).toBeUndefined();
    expect(fila(manometrica, 'Desnivel total')![1]).toBe('10.00'); // Hg = ztop − zcis
    // HMT = Hg + (hfCrit 2 + otros 0.5 + cisterna 0.5) + pmin 10 = 23.00
    expect(fila(manometrica, 'Altura manométrica total HMT')![1]).toBe('✓ 23.00');
  });

  it('diámetros: el DN del usuario pisa el automático y la velocidad real se recalcula con Sch40', () => {
    guardar({ ...epBase, dnsuc: '50', dnimp: '' } as EPData);
    const diam = computeEpTables()[9];
    expect(fila(diam, 'Tubería de succión')![1]).toBe('50');
    // DN 50 → dInt 52.5 mm: Vreal = Qd/1000/A
    const A = (Math.PI * Math.pow(52.5 / 1000, 2)) / 4;
    expect(fila(diam, 'Velocidad real en succión')![1]).toBe((5 / 1000 / A).toFixed(2));
    // impulsión sin DN del usuario → automático con V imp 2.0
    const nominales = computeEpTables()[10];
    expect(String(fila(nominales, 'Impulsión colector (Qd)')![4])).toMatch(/^\d+$/);
  });

  it('las alertas ep replican los marcadores de la tabla (todos ok → [])', () => {
    guardar(epBase);
    expect(epAlertas()).toEqual([]);
  });

  it('alertas: HMT fuera de rango, datos faltantes y acometida sin dato se reportan en orden', () => {
    guardar({
      ...epBase,
      zbomba: '30', // Hg negativo
      hfac: '0',
      hfacs: '0',
      hfotros: '0',
      pmin: '0',
      pred: '',
    } as EPData);
    expect(epAlertas()).toEqual([
      'HMT sin datos',
      'Desnivel geométrico sin dato',
      'Pérdidas de carga críticas sin dato',
      'Presión del punto crítico sin dato',
      'Presión disponible de acometida sin dato',
    ]);
  });

  it('el perfil del país alimenta los comentarios de presión (Colombia por defecto)', () => {
    guardar(epBase);
    const presiones = computeEpTables()[1];
    expect(String(fila(presiones, 'Presión mínima punto crítico')![3])).toMatch(/NTC|RAS/i);
  });
});
