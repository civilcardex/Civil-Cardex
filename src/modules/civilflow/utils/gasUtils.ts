import { APARATOS_DEF } from '../constants';

/** Aparatos de gas (Gas) del catálogo con caudal propio (qgas > 0, grupo 'g'): estufa, calentador, secadora... */
export const GAS_APPARATUS = APARATOS_DEF.filter((a) => a.grupo === 'g' && (a.qgas || 0) > 0);

/**
 * Caudal probable de una instalación de gas (m³/h) por el criterio de diversidad del método
 * Renouard (fórmula de pérdida en gas): los DOS tipos de mayor consumo cuentan a la mitad (no
 * todos prenden a la vez) y los demás tipos completos. Ej: 4 estufas (1.2) + 1 calentador (2.5)
 * -> (1.2·4 + 2.5·1)/2 = 3.65 m³/h.
 * @param counts cuántos aparatos hay de cada id ('estufa': 4).
 * @returns caudal probable en m³/h; 0 si no hay aparatos.
 */
export function renouardByType(counts: Record<string, number>) {
  const present = [];
  for (const ap of GAS_APPARATUS) {
    const n = counts[ap.id] || 0;
    if (n > 0) present.push({ q: ap.qgas, n });
  }
  const sorted = present.sort((a, b) => b.q - a.q);
  const nTypes = sorted.length;
  if (nTypes === 0) return 0;
  if (nTypes === 1) return (sorted[0].q * sorted[0].n) / 2;
  if (nTypes === 2) return (sorted[0].q * sorted[0].n + sorted[1].q * sorted[1].n) / 2;
  const part1 = (sorted[0].q * sorted[0].n + sorted[1].q * sorted[1].n) / 2;
  const qMayor2 = sorted[1].q;
  const part2 = sorted
    .slice(2)
    .filter((p) => p.q < qMayor2)
    .reduce((s, p) => s + p.q * p.n, 0);
  return part1 + part2;
}

// Factores de corrección del Excel "Calculo red de Gas KML" (celdas AB/AC/AD): cada
// factor se REDONDEA a 2 decimales antes de multiplicar — así lo hace la hoja y así
// debe salir en las columnas "Por Altitud / Por Temperatura / Por Densidad Relativa".
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Presión atmosférica (kPa) que corresponde a una altitud (msnm).
 *
 * Ej: en Bogotá (2640 msnm) da 74.5 kPa — menos aire arriba, así el gas trabaja con menos
 * presión y necesita más caudal para la misma entrega.
 * @param alt - altitud de la ciudad en metros sobre el nivel del mar.
 * @returns la presión atmosférica en kPa, con 2 decimales.
 */
export function patmDeAltitud(alt: string | number): string {
  const m = Number(alt) || 0;
  return String(Math.round(101.325 * Math.pow(1 - m / 44330, 5.256) * 100) / 100);
}

/** Factores que corrigen el consumo de gas (Gas) por la altitud, la temperatura y la densidad del sitio; se redondean a 2 decimales igual que la hoja de cálculo. */
export function factoresGas(datos: { patm: string; temp: string; densRel: string }) {
  const pAtm = Number(datos.patm) || 101.325;
  const T = Number(datos.temp) || 23;
  const DR = Number(datos.densRel) || 0.67;
  return {
    pAtm,
    DR,
    fAlt: round2(101.325 / pAtm),
    fTemp: round2(Math.sqrt(288 / (273 + T))),
    fDens: round2(Math.sqrt(0.67 / DR)),
  };
}

/** Caudal de diseño del tramo de gas (m³/h): el consumo corregido por los factores, y nunca menos de 2.7 (el piso que exige la norma). */
export function qDisenoGas(qRenouard: number, f: ReturnType<typeof factoresGas>): number {
  return Math.max(round2(qRenouard * f.fAlt * f.fTemp * f.fDens), 2.7);
}
