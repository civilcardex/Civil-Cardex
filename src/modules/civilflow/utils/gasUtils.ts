import { APARATOS_DEF } from '../constants';

/** Aparatos de gas (Gas) del catálogo con caudal propio (qgas > 0, grupo 'g'): estufa, calentador, secadora... */
export const GAS_APPARATUS = APARATOS_DEF.filter((a) => a.grupo === 'g' && (a.qgas || 0) > 0);
import { CAT_GAS } from '../constants/engineeringDataGas.ts';

/**
 * Caudal probable de una instalación de gas (m³/h) por el criterio de diversidad del método
 * Renouard (fórmula de pérdida en gas): los DOS tipos de mayor consumo cuentan a la mitad (no
 * todos prenden a la vez) y los demás tipos completos. Ej: 4 estufas (1.2) + 1 calentador (2.5)
 * -> (1.2·4 + 2.5·1)/2 = 3.65 m³/h.
 * @param counts cuántos aparatos hay de cada id ('estufa': 4).
 * @returns caudal probable en m³/h; 0 si no hay aparatos.
 */
/** Factor de simultaneidad del gas por número TOTAL de aparatos del tramo (NTC 3728 §5.3):
 *  1–2 → 1.0 · 3–5 → 0.8 · 6–10 → 0.7 · 11–20 → 0.6 · >20 → 0.5. Ej: 7 aparatos → 0.7. */
export function fsGas(nTotal: number): number {
  if (nTotal <= 2) return 1.0;
  if (nTotal <= 5) return 0.8;
  if (nTotal <= 10) return 0.7;
  if (nTotal <= 20) return 0.6;
  return 0.5;
}

/** Caudal probable del tramo de gas (m³/h): suma de consumos por aparato × factor fs de la
 *  tabla NTC 3728 §5.3 según el número TOTAL de aparatos. El consumo por aparato sale del
 *  catálogo según el tipoGas del proyecto: GN (qgas) o GLP (qglp del CAT_GAS).
 *  Ej: {est4: 2} GN → fs(2)=1.0 × 2×1.35 = 2.7 m³/h; {cal11:1} GLP → fs(1)=1.0 × 0.75.
 *  @param counts cuántos aparatos hay de cada id ('estufa': 4).
 *  @param tipoGas tipo de gas del proyecto ('gn' por defecto).
 *  @returns caudal probable en m³/h; 0 si no hay aparatos. */
export function renouardByType(
  counts: Record<string, number>,
  tipoGas: 'gn' | 'glp' = 'gn',
): number {
  let totalN = 0;
  let sumaQ = 0;
  for (const ap of GAS_APPARATUS) {
    const n = counts[ap.id] || 0;
    if (n <= 0) continue;
    totalN += n;
    let q = ap.qgas;
    if (tipoGas === 'glp') {
      const cat = CAT_GAS.find((c) => c.id === ap.id);
      q = cat?.qglp ?? ap.qgas;
    }
    sumaQ += q * n;
  }
  if (totalN === 0) return 0;
  return round2(fsGas(totalN) * sumaQ);
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
