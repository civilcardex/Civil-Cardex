/** Gravitational acceleration (m/s²). */
export const GRAVEDAD: number = 9.80665;
/** Water density (kg/m³). */
export const AGUA_DENSIDAD: number = 1000;
/** Manning roughness coefficient for sanitary PVC. */
export const manning_SAN: number = 0.009;

// ─── Factor de simultaneidad (Hunter modificado) ───
/**
 * Modified Hunter simultaneity factor.
 * @param numSalidas - Number of fixture outlets.
 * @returns Factor in range (0, 1] using 1/√(n-1).
 */
export function factorSimultaneidad(numSalidas: number): number {
  if (numSalidas <= 1) return 1;
  return 1 / Math.sqrt(numSalidas - 1);
}

// ─── Caudal de Hunter (Rodriguez Diaz) ───
/**
 * Hunter flow rate (Rodriguez Diaz method), in L/s.
 * @param UD - Total fixture units.
 * @param K - Simultaneity coefficient.
 * @returns Design flow in L/s.
 */
export function caudalHunterLPS(UD: number, K: number): number {
  let Q;
  if (UD < 240) {
    Q = K * 0.1163 * Math.pow(UD, 0.6875);
  } else {
    Q = K * 0.074 * Math.pow(UD, 0.7504);
  }
  return Q;
}

// ─── Caudal a tubo lleno (Manning) ───
/**
 * Full-pipe discharge via Manning equation.
 * @param D_m - Internal pipe diameter (m).
 * @param n - Manning roughness coefficient.
 * @param S - Pipe slope (m/m).
 * @returns Full-pipe flow rate (m³/s), or 0 if invalid inputs.
 */
export function caudalTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const A = (Math.PI * D_m * D_m) / 4;
  const Rh = D_m / 4;
  return (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Velocidad a tubo lleno ───
/**
 * Full-pipe velocity via Manning equation.
 * @param D_m - Internal pipe diameter (m).
 * @param n - Manning roughness coefficient.
 * @param S - Pipe slope (m/m).
 * @returns Full-pipe velocity (m/s), or 0 if invalid inputs.
 */
export function velocidadTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const Rh = D_m / 4;
  return (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Relacion Q/Qo y V/Vo (tablas de Leon/Estopin) ───
/**
 * Partial-flow hydraulic ratios (Leon/Estopin tables).
 * @param q_Qo - Ratio of actual to full-pipe discharge.
 * @returns Object with velocity ratio v_V0, depth ratio h_D, angle alpha, and hydraulic radius ratio Rh_D.
 */
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

// ─── Numero de Froude ───
/**
 * Froude number for open-channel / partially-full pipe flow.
 * @param V - Flow velocity (m/s).
 * @param DH - Hydraulic depth (m).
 * @returns Dimensionless Froude number; Infinity if DH ≤ 0.
 */
export function numeroFroude(V: number, DH: number): number {
  if (DH <= 0) return Infinity;
  return V / Math.sqrt(GRAVEDAD * DH);
}

// ─── Fuerza tractiva ───
/**
 * Tractive force (shear stress) in kg/m².
 * @param Rh - Hydraulic radius (m).
 * @param S - Pipe slope (m/m).
 * @returns Tractive force in kg/m², or 0 if invalid inputs.
 */
export function fuerzaTractiva(Rh: number, S: number): number {
  if (Rh <= 0 || S <= 0) return 0;
  return 1000 * Rh * S;
}

// ─── Tipo de regimen ───
/**
 * Classifies flow regime based on Froude number.
 * @param Fr - Froude number.
 * @returns 'Subcrítico', 'Crítico', or 'Supercrítico'.
 */
export function tipoRegimen(Fr: number): string {
  if (Fr < 0.9) return 'Subcrítico';
  if (Fr <= 1.1) return 'Crítico';
  return 'Supercrítico';
}

// ─── Diámetro calculado por Manning ───
/**
 * Theoretical pipe diameter from Manning equation (full pipe, circular section).
 * @param Q_m3s - Design discharge (m³/s).
 * @param n - Manning roughness coefficient.
 * @param S - Pipe slope (m/m).
 * @returns Required diameter (m), or 0 if invalid inputs.
 */
export function diametroManning(Q_m3s: number, n: number, S: number): number {
  if (S <= 0 || Q_m3s <= 0 || n <= 0) return 0;
  return Math.pow((Q_m3s * n) / (0.312 * Math.sqrt(S)), 3 / 8);
}
