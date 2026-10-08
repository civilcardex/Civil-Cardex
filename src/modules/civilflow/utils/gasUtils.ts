import { APARATOS_DEF } from '../constants';

export const GAS_APPARATUS = APARATOS_DEF.filter((a) => a.grupo === 'g' && (a.qgas || 0) > 0);

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

/** Factores de corrección por altitud, temperatura y densidad relativa (redondeados a
 *  2 decimales, como el Excel), junto con pAtm/DR numéricos para el resto de fórmulas. */
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

/** Q de diseño (celda AE del Excel): máximo entre el consumo corregido (redondeado a
 *  2 decimales tras aplicar los factores) y el piso de 2.7 m³/h. */
export function qDisenoGas(qRenouard: number, f: ReturnType<typeof factoresGas>): number {
  return Math.max(round2(qRenouard * f.fAlt * f.fTemp * f.fDens), 2.7);
}
