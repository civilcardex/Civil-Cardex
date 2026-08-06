/** Aceleración gravitacional (m/s²). */
export const GRAVEDAD: number = 9.80665;
/** Densidad del agua (kg/m³). */
export const AGUA_DENSIDAD: number = 1000;
/** Coeficiente de rugosidad de Manning para PVC sanitario. */
export const manning_SAN: number = 0.009;

// ─── Factor de simultaneidad (Hunter modificado) ───
/**
 * Factor de simultaneidad de Hunter modificado.
 * @param numSalidas - Número de salidas de aparatos.
 * @returns Factor en rango (0, 1] usando 1/√(n-1).
 */
export function factorSimultaneidad(numSalidas: number): number {
  if (numSalidas <= 1) return 1;
  return 1 / Math.sqrt(numSalidas - 1);
}

// ─── Caudal de Hunter (Rodriguez Diaz) ───
/**
 * Caudal de Hunter (método Rodríguez Díaz), en L/s.
 * @param UD - Unidades de descarga totales.
 * @param K - Coeficiente de simultaneidad.
 * @returns Caudal de diseño en L/s.
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
 * Descarga a tubo lleno vía la ecuación de Manning.
 * @param D_m - Diámetro interno de tubería (m).
 * @param n - Coeficiente de rugosidad de Manning.
 * @param S - Pendiente de tubería (m/m).
 * @returns Caudal a tubo lleno (m³/s), o 0 si las entradas son inválidas.
 */
export function caudalTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const A = (Math.PI * D_m * D_m) / 4;
  const Rh = D_m / 4;
  return (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Velocidad a tubo lleno ───
/**
 * Velocidad a tubo lleno vía la ecuación de Manning.
 * @param D_m - Diámetro interno de tubería (m).
 * @param n - Coeficiente de rugosidad de Manning.
 * @param S - Pendiente de tubería (m/m).
 * @returns Velocidad a tubo lleno (m/s), o 0 si las entradas son inválidas.
 */
export function velocidadTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const Rh = D_m / 4;
  return (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Relacion Q/Qo y V/Vo (tablas de Leon/Estopin) ───
/**
 * Razones hidráulicas de flujo parcial (tablas de León/Estopiñán).
 * @param q_Qo - Razón de descarga real a descarga a tubo lleno.
 * @returns Objeto con razón de velocidad v_V0, razón de tirante h_D, ángulo alpha y razón de
 * radio hidráulico Rh_D.
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
 * Número de Froude para flujo en canal abierto / tubería parcialmente llena.
 * @param V - Velocidad del flujo (m/s).
 * @param DH - Tirante hidráulico (m).
 * @returns Número de Froude adimensional; Infinity si DH ≤ 0.
 */
export function numeroFroude(V: number, DH: number): number {
  if (DH <= 0) return Infinity;
  return V / Math.sqrt(GRAVEDAD * DH);
}

// ─── Fuerza tractiva ───
/**
 * Fuerza tractiva (esfuerzo cortante) en kg/m².
 * @param Rh - Radio hidráulico (m).
 * @param S - Pendiente de tubería (m/m).
 * @returns Fuerza tractiva en kg/m², o 0 si las entradas son inválidas.
 */
export function fuerzaTractiva(Rh: number, S: number): number {
  if (Rh <= 0 || S <= 0) return 0;
  return 1000 * Rh * S;
}

// ─── Tipo de regimen ───
/**
 * Clasifica el régimen de flujo según el número de Froude.
 * @param Fr - Número de Froude.
 * @returns 'Subcrítico', 'Crítico' o 'Supercrítico'.
 */
export function tipoRegimen(Fr: number): string {
  if (Fr < 0.9) return 'Subcrítico';
  if (Fr <= 1.1) return 'Crítico';
  return 'Supercrítico';
}

// ─── Diámetro calculado por Manning ───
/**
 * Diámetro teórico de tubería a partir de la ecuación de Manning (tubo lleno, sección circular).
 * @param Q_m3s - Caudal de diseño (m³/s).
 * @param n - Coeficiente de rugosidad de Manning.
 * @param S - Pendiente de tubería (m/m).
 * @returns Diámetro requerido (m), o 0 si las entradas son inválidas.
 */
export function diametroManning(Q_m3s: number, n: number, S: number): number {
  if (S <= 0 || Q_m3s <= 0 || n <= 0) return 0;
  return Math.pow((Q_m3s * n) / (0.312 * Math.sqrt(S)), 3 / 8);
}
