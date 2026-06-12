import { manning_SAN, diametroManning, diametroPropuesto, type DiametroComercial } from './calcSanitaryCore';

// ─── Metodo Racional para Aguas lluvias ───
export function caudalRacional(C: number, I: number, A: number): number {
  return (C * I * A) / 360;
}

export interface BajanteALLParams {
  bajante?: string;
  area_parcial?: number;
  area_acum?: number;
  intensidad?: number;
  C?: number;
  r?: number;
  n?: number;
  pendiente?: number;
}

export interface BajanteALLResult {
  bajante: string;
  area_parcial: number;
  area_acum: number;
  intensidad: number;
  C: number;
  Q_Ls: number;
  Dcalc_pulg: number;
  Dprop_nominal: string;
  Dprop_pulg: number;
  Dprop_mm: number;
  chequeo: string;
}

// ─── Chequeo bajante Aguas lluvias ───
export function calculateDownpipe(params: BajanteALLParams): BajanteALLResult {
  const {
    bajante = '',
    area_parcial = 0,
    area_acum = 0,
    intensidad = 100,
    C = 0.0278,
    r = 7 / 24,
    n = manning_SAN,
    pendiente = 0.02,
  } = params;

  const Q_Ls = caudalRacional(C, intensidad, area_parcial);
  const Q_m3s = Q_Ls / 1000;

  const Dcalc_m = diametroManning(Q_m3s, n, pendiente);
  const Dcalc_pulg = Dcalc_m * 1000 / 25.4;
  const Dprop = diametroPropuesto(Dcalc_m * 1000);

  return {
    bajante,
    area_parcial: parseFloat(area_parcial.toFixed(2)),
    area_acum: parseFloat(area_acum.toFixed(2)),
    intensidad,
    C,
    Q_Ls: parseFloat(Q_Ls.toFixed(2)),
    Dcalc_pulg: parseFloat(Dcalc_pulg.toFixed(2)),
    Dprop_nominal: Dprop.nominal,
    Dprop_pulg: Dprop.pulg,
    Dprop_mm: Dprop.mm,
    chequeo: Dcalc_pulg <= Dprop.pulg ? 'Ok' : 'No cumple',
  };
}

// ─── Chequeo bajante Aguas lluvias (UI inline formula) ───
export function chequeoBajanteLluvia({ areaAcumulada = 0, intensidad = 0, coeficienteC = 0, R = '', diamPropuesto = 0 }: {
  areaAcumulada?: number;
  intensidad?: number;
  coeficienteC?: number;
  R?: string;
  diamPropuesto?: number;
}): { Q: number; dCalc: number; chequeo: string } {
  const Rv = R === '1/4' ? 0.25 : (R === '7/24' ? 7 / 24 : 0);
  const Q = areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
    ? Math.round(areaAcumulada * intensidad * coeficienteC / 100 * 100) / 100
    : 0;
  const dCalc = Q > 0 && Rv > 0
    ? Math.round(Math.pow(Q / (1.754 * Math.pow(Rv, 5 / 3)), 3 / 8) * 100) / 100
    : 0;
  const chequeo = dCalc > 0 && diamPropuesto > 0
    ? (dCalc < diamPropuesto ? 'Ok' : 'No cumple')
    : (dCalc > 0 ? 'Sin diseño' : '—');
  return { Q, dCalc, chequeo };
}

// ─── Chequeo canal cubierta Aguas lluvias (UI inline formula) ───
export function chequeoCanalLluvia({ areaAcumulada = 0, intensidad = 0, coeficienteC = 0, manning = 0, pendiente = 0, b = 0, h = 0 }: {
  areaAcumulada?: number;
  intensidad?: number;
  coeficienteC?: number;
  manning?: number;
  pendiente?: number;
  b?: number;
  h?: number;
}): { Qreal: number; Qmax: number; chequeo: string; totalStr: string } {
  const Qreal = areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
    ? Math.round(areaAcumulada * intensidad * coeficienteC / 100 * 100) / 100
    : 0;
  const n = manning || 0.009;
  const S = (pendiente || 0) / 100;
  const b_m = b / 100;
  const h_m = h / 100;
  const Qmax = b_m > 0 && h_m > 0 && n > 0 && S > 0
    ? Math.round(1000 * b_m * h_m / n * Math.sqrt(S) * Math.pow(b_m * h_m / (b_m + 2 * h_m), 2 / 3) * 100) / 100
    : 0;
  const chequeo = Qmax > 0 && Qreal > 0
    ? (Qmax > Qreal ? 'Ok' : 'No cumple')
    : (Qreal > 0 ? 'Sin sección' : '—');
  const totalStr = b > 0 || h > 0 ? `${b} x ${h}` : '—';
  return { Qreal, Qmax, chequeo, totalStr };
}

export interface CanalALLParams {
  sector?: string;
  area_parcial?: number;
  area_acum?: number;
  intensidad?: number;
  C?: number;
  n?: number;
  pendiente?: number;
  b_m?: number;
  h_m?: number;
  bordeLibre_m?: number;
}

export interface CanalALLResult {
  sector: string;
  area_parcial: number;
  area_acum: number;
  intensidad: number;
  C: number;
  Q_real_Ls: number;
  n: number;
  pendiente: number;
  b_m: number;
  h_m: number;
  bordeLibre_m: number;
  seccion: string;
  Q_max_Ls: number;
  chequeo: string;
}

// ─── Chequeo canal cubierta ALL ───
export function calculateChannel(params: CanalALLParams): CanalALLResult {
  const {
    sector = '',
    area_parcial = 0,
    area_acum = 0,
    intensidad = 100,
    C = 0.0278,
    n = manning_SAN,
    pendiente = 0.02,
    b_m = 0,
    h_m = 0,
    bordeLibre_m = 0,
  } = params;

  const Q_real = caudalRacional(C, intensidad, area_acum);
  const Q_real_Ls = Q_real * 1000;

  const h_util = h_m - bordeLibre_m;
  const A = b_m * h_util;
  const P = b_m + 2 * h_util;
  const Rh = A / P;

  const Q_max = (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(pendiente, 0.5);
  const Q_max_Ls = Q_max * 1000;

  return {
    sector,
    area_parcial: parseFloat(area_parcial.toFixed(2)),
    area_acum: parseFloat(area_acum.toFixed(2)),
    intensidad,
    C,
    Q_real_Ls: parseFloat(Q_real_Ls.toFixed(2)),
    n,
    pendiente,
    b_m,
    h_m,
    bordeLibre_m,
    seccion: `${(b_m * 100).toFixed(0)} x ${(h_m * 100).toFixed(0)}`,
    Q_max_Ls: parseFloat(Q_max_Ls.toFixed(2)),
    chequeo: Q_real_Ls <= Q_max_Ls ? 'Ok' : 'No cumple',
  };
}

export { calculateDownpipe as calcularBajanteALL, calculateChannel as calcularCanalALL };
