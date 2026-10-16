/** Aceleración de la gravedad (m/s²): la usa Froude (numero adimensional de regimen) para saber si el flujo va tranquilo o de torrente. */
export const GRAVEDAD: number = 9.80665;
/** Densidad del agua (kg/m³): convierte altura de agua en presión sobre la tubería. */
export const AGUA_DENSIDAD: number = 1000;
/** Rugosidad Manning (formula de flujo en tuberia) del PVC san (Sanitaria): cuánto frena la pared al agua (adimensional, 0.009). */
export const manning_SAN: number = 0.009;

// ─── Factor de simultaneidad (Hunter modificado) ───
/** Factor Hunter (metodo de probabilidad de uso simultaneo) modificado: cuánto se reduce el caudal porque no todos los aparatos descargan a la vez (1/√(n-1), rango (0,1]).
 *  Ej: 10 salidas -> 1/3 = 0.33.
 *  @param numSalidas - N° de salidas de aparatos.
 *  @returns factor de simultaneidad. */
export function factorSimultaneidad(numSalidas: number): number {
  if (numSalidas <= 1) return 1;
  return 1 / Math.sqrt(numSalidas - 1);
}

// ─── Caudal de Hunter (Rodriguez Diaz) ───
/** Q (Caudal) Hunter (metodo de probabilidad de uso simultaneo) en L/s: cuánta agua residual se junta si varios aparatos descargan a la vez (Rodríguez Díaz).
 *  Ej: 40 UD (Unidades de Desague) con K=0.3 -> ~0.44 L/s.
 *  @param UD - UD (Unidades de Desague) totales.
 *  @param K - coeficiente de simultaneidad.
 *  @returns Q (Caudal) de diseño en L/s. */
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
/** Q (Caudal) a tubo lleno por Manning (formula de flujo en tuberia): cuánta agua cabe si la tubería san (Sanitaria) corre completamente llena (m³/s, 0 si inválido).
 *  Ej: PVC de 4" a 1 % de pendiente -> ~7.8 L/s.
 *  @param D_m - diámetro interno (m).
 *  @param n - rugosidad Manning (formula de flujo en tuberia).
 *  @param S - pendiente (m/m).
 *  @returns Q (Caudal) a tubo lleno en m³/s. */
export function caudalTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const A = (Math.PI * D_m * D_m) / 4;
  const Rh = D_m / 4;
  return (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Velocidad a tubo lleno ───
/** Velocidad a tubo lleno por Manning (formula de flujo en tuberia): a qué velocidad viaja el agua si la tubería va llena (m/s, 0 si inválido).
 *  Ej: PVC san (Sanitaria) de 2" a 5 % de pendiente -> ~1.35 m/s.
 *  @param D_m - diámetro interno (m).
 *  @param n - rugosidad Manning (formula de flujo en tuberia).
 *  @param S - pendiente (m/m).
 *  @returns velocidad a tubo lleno en m/s. */
export function velocidadTuboLleno(D_m: number, n: number, S: number): number {
  if (D_m <= 0 || S <= 0) return 0;
  const Rh = D_m / 4;
  return (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Relacion Q/Qo y V/Vo (tablas de Leon/Estopin) ───
/** Razones de flujo parcial Q (Caudal)/Qo (tablas de León/Estopiñán): sirven para calcular qué tan llena viaja la tubería cuando el caudal real es MENOR que el de tubo lleno.
 *  Ej: q/Qo = 0.3 -> la tubería va ~43 % llena.
 *  @param q_Qo - razón Q (Caudal)/Qo (0.01-0.999).
 *  @returns razones v_V0, h_D, alpha y Rh_D. */
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
/** Froude (numero adimensional de regimen) de flujo parcial: compara la velocidad del agua con la de sus propias olas y dice si el flujo es tranquilo o de torrente.
 *  Ej: 2 m/s con 0.1 m de tirante -> ~2 (supercrítico).
 *  @param V - velocidad del flujo (m/s).
 *  @param DH - tirante hidráulico (m).
 *  @returns número Froude (numero adimensional de regimen). */
export function numeroFroude(V: number, DH: number): number {
  if (DH <= 0) return Infinity;
  return V / Math.sqrt(GRAVEDAD * DH);
}

// ─── Fuerza tractiva ───
/**
 * Fuerza tractiva (esfuerzo cortante) en kg/m²: cuánto "jala" el agua las paredes de la tubería san (Sanitaria); si es muy baja, los sólidos se estancan en vez de arrastrarse.
 * Ej: radio hidráulico 0.03 m a 1 % de pendiente -> 0.3 kg/m².
 * @param Rh - Radio hidráulico (m).
 * @param S - Pendiente de tubería (m/m).
 * @returns Fuerza tractiva en kg/m², o 0 si las entradas son inválidas.
 */
export function fuerzaTractiva(Rh: number, S: number): number {
  if (Rh <= 0 || S <= 0) return 0;
  return 1000 * Rh * S;
}

// ─── Tipo de regimen ───
/** Régimen del flujo por Froude (numero adimensional de regimen): Subcrítico (<0.9, tranquilo), Crítico (≤1.1) o Supercrítico (torrente).
 *  Ej: Froude 1.5 -> 'Supercrítico'.
 *  @param Fr - Froude (numero adimensional de regimen).
 *  @returns régimen del flujo. */
export function tipoRegimen(Fr: number): string {
  if (Fr < 0.9) return 'Subcrítico';
  if (Fr <= 1.1) return 'Crítico';
  return 'Supercrítico';
}

// ─── Diámetro calculado por Manning ───
/** Diámetro por Manning (formula de flujo en tuberia): el diámetro mínimo para que la tubería san (Sanitaria) lleve el caudal con esa pendiente (m, 0 si inválido).
 *  Ej: 3 L/s a 1 % con PVC -> ~0.071 m (2 3/4").
 *  @param Q_m3s - Q (Caudal) de diseño (m³/s).
 *  @param n - rugosidad Manning (formula de flujo en tuberia).
 *  @param S - pendiente (m/m).
 *  @returns diámetro requerido en m. */
export function diametroManning(Q_m3s: number, n: number, S: number): number {
  if (S <= 0 || Q_m3s <= 0 || n <= 0) return 0;
  return Math.pow((Q_m3s * n) / (0.312 * Math.sqrt(S)), 3 / 8);
}
