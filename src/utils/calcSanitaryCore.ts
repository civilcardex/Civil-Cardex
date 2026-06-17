export const GRAVEDAD: number = 9.80665;
export const manning_SAN: number = 0.009;
export const manning_SAN_VENT: number = 0.009;

export interface TuberiaSan {
  nominal: string;
  dExt: number;
  dExtPulg: number;
  dInt: number;
  espesor: number;
  espPulg: number;
  peso: number;
}

// ─── Tabla de tuberias sanitarias y ventilacion (del Excel) ───
export const TUBERIAS_SAN: TuberiaSan[] = [
  { nominal: '1½"', dExt: 48.26, dExtPulg: 1.90, dInt: 42.68, espesor: 2.79, espPulg: 0.11, peso: 0.64 },
  { nominal: '2"',   dExt: 60.32, dExtPulg: 2.37, dInt: 54.48, espesor: 2.92, espPulg: 0.11, peso: 0.84 },
  { nominal: '3"',   dExt: 82.56, dExtPulg: 3.25, dInt: 76.20, espesor: 3.18, espPulg: 0.12, peso: 1.27 },
  { nominal: '4"',   dExt: 114.30, dExtPulg: 4.50, dInt: 107.70, espesor: 3.30, espPulg: 0.13, peso: 1.84 },
  { nominal: '6"',   dExt: 168.28, dExtPulg: 6.62, dInt: 160.04, espesor: 4.12, espPulg: 0.16, peso: 3.41 },
];

export const TUBERIAS_VENT: TuberiaSan[] = [
  { nominal: '1½"', dExt: 48.26, dExtPulg: 1.90, dInt: 45.22, espesor: 1.52, espPulg: 0.06, peso: 0.36 },
  { nominal: '2"',   dExt: 60.32, dExtPulg: 2.37, dInt: 56.76, espesor: 1.78, espPulg: 0.07, peso: 0.53 },
  { nominal: '3"',   dExt: 82.56, dExtPulg: 3.25, dInt: 79.00, espesor: 1.78, espPulg: 0.07, peso: 0.73 },
  { nominal: '4"',   dExt: 114.30, dExtPulg: 4.50, dInt: 110.08, espesor: 2.11, espPulg: 0.08, peso: 1.20 },
];

// ─── Factor de simultaneidad (Hunter modificado) ───
export function factorSimultaneidad(numSalidas: number): number {
  if (numSalidas <= 1) return 1;
  return 1 / Math.sqrt(numSalidas - 1);
}

// ─── Caudal de Hunter (Rodriguez Diaz) ───
export function caudalHunterLPS(UD: number, K: number): number {
  let Q;
  if (UD < 240) {
    Q = K * 0.1163 * Math.pow(UD, 0.6875);
  } else {
    Q = K * 0.074 * Math.pow(UD, 0.7504);
  }
  return Q;
}

export interface DiametroComercial {
  pulg: number;
  mm: number;
  nominal: string;
}

// ─── Diametros comerciales sanitarios ───
export const DIAMETROS_COMERCIALES: DiametroComercial[] = [
  { pulg: 1.5, mm: 42.68, nominal: '1½"' },
  { pulg: 2,   mm: 54.48, nominal: '2"' },
  { pulg: 3,   mm: 76.20, nominal: '3"' },
  { pulg: 4,   mm: 107.70, nominal: '4"' },
  { pulg: 6,   mm: 160.04, nominal: '6"' },
];

export function diametroPropuesto(Dcalc_mm: number): DiametroComercial {
  if (Dcalc_mm <= 0) return DIAMETROS_COMERCIALES[0];
  for (const d of DIAMETROS_COMERCIALES) {
    if (d.mm >= Dcalc_mm) return d;
  }
  return DIAMETROS_COMERCIALES[DIAMETROS_COMERCIALES.length - 1];
}

// ─── Caudal a tubo lleno (Manning) ───
export function caudalTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const A = Math.PI * D_m * D_m / 4;
  const Rh = D_m / 4;
  return (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Velocidad a tubo lleno ───
export function velocidadTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const Rh = D_m / 4;
  return (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Propiedades geometricas seccion circular parcialmente llena ───
export function calcPropiedadesGeometricas(h_D: number): {
  hD: number;
  alpha: number;
  A_D2: number;
  Rh_D: number;
  T_D: number;
  A: (_alpha: number) => (D_m: number) => number;
  Rh: number;
} {
  const hD = Math.min(Math.max(h_D, 0.001), 0.999);
  const alpha = 2 * Math.acos(1 - 2 * hD);
  const A_D2 = (alpha - Math.sin(alpha)) / 8;
  const Rh_D = (1 / 4) * (1 - Math.sin(alpha) / alpha);
  const T_D = Math.sin(alpha / 2);
  return {
    hD,
    alpha,
    A_D2,
    Rh_D,
    T_D,
    A: (_alpha: number) => (D_m: number) => A_D2 * D_m * D_m,
    Rh: Rh_D,
  };
}

// ─── Relacion Q/Qo y V/Vo (tablas de Leon/Estopin) ───
export function relacionesHidraulicas(q_Qo: number): {
  q_Qo: number;
  v_V0: number;
  h_D: number;
  alpha: number;
  Rh_D: number;
} {
  let v_V0, h_D;
  const r = Math.min(Math.max(q_Qo, 0.01), 0.999);

  if (r <= 0.06) {
    v_V0 = Math.pow(10, 0.029806 + 0.29095 * Math.log10(r));
  } else if (r <= 0.26) {
    v_V0 = Math.pow(10, 0.013778 + 0.28597 * Math.log10(r));
  } else {
    v_V0 = Math.pow(10, 0.021763 + 0.289951 * Math.log10(r));
  }

  if (r < 0.11) {
    h_D = 0.3827 + 0.0645 * Math.log(r);
  } else if (r < 0.21) {
    h_D = 0.60025 + 0.15471 * Math.log(r);
  } else {
    h_D = 0.225 + 0.667 * r;
  }

  h_D = Math.min(Math.max(h_D, 0.01), 0.98);

  const alpha = 2 * Math.acos(1 - 2 * h_D);
  const Rh_D = (1 / 4) * (1 - Math.sin(alpha) / alpha);

  return { q_Qo: r, v_V0, h_D, alpha, Rh_D };
}

// ─── Tirante critico Yc (condicion Fr = 1 en seccion circular) ───
export function tiranteCritico(D_m: number, Q_m3s: number): number {
  if (Q_m3s <= 0 || D_m <= 0) return 0;

  let hD_lo = 0.01, hD_hi = 0.99;

  for (let i = 0; i < 100; i++) {
    const hD_mid = (hD_lo + hD_hi) / 2;
    const alpha = 2 * Math.acos(1 - 2 * hD_mid);
    const A = (D_m * D_m / 4) * (alpha - Math.sin(alpha)) / 2;
    const T = D_m * Math.sin(alpha / 2);
    const Fr2 = (Q_m3s * Q_m3s * T) / (GRAVEDAD * Math.pow(A, 3));

    if (Fr2 < 1) {
      hD_lo = hD_mid;
    } else {
      hD_hi = hD_mid;
    }
  }

  const hD = (hD_lo + hD_hi) / 2;
  return hD * D_m;
}

// ─── Tirante normal Yn (Manning iterativo) ───
export function tiranteNormal(D_m: number, Q_m3s: number, n: number, S: number): number {
  if (Q_m3s <= 0 || D_m <= 0 || S <= 0 || n <= 0) return 0;

  const Qo = caudalTuboLleno(D_m, n, S);
  const q_Qo = Q_m3s / Qo;

  if (q_Qo <= 0.01) return 0.01 * D_m;
  if (q_Qo >= 1.0) return 0.95 * D_m;

  const rel = relacionesHidraulicas(q_Qo);
  return rel.h_D * D_m;
}

// ─── Numero de Froude ───
export function numeroFroude(V: number, DH: number): number {
  if (DH <= 0) return Infinity;
  return V / Math.sqrt(GRAVEDAD * DH);
}

// ─── Fuerza tractiva ───
export function fuerzaTractiva(Rh: number, S: number): number {
  if (Rh <= 0 || S <= 0) return 0;
  return 1000 * Rh * S;
}

// ─── Tipo de regimen ───
export function tipoRegimen(Fr: number): string {
  if (Fr < 0.9) return 'Subcritico';
  if (Fr <= 1.1) return 'Critico';
  return 'Supercritico';
}

// ─── Diámetro calculado por Manning ───
export function diametroManning(Q_m3s: number, n: number, S: number): number {
  if (S <= 0 || Q_m3s <= 0 || n <= 0) return 0;
  return Math.pow((Q_m3s * n) / (0.312 * Math.sqrt(S)), 3 / 8);
}



