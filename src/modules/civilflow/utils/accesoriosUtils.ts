import { DIAMETROS_AF, DIAMETROS_AC } from '../constants/hydraulicData';

// NOTE: See also LE_ACCESORIOS in calcHydraulics.ts for hardcoded Le arrays by diameter
export const LE_ACC_DEF = [
  { id: 'codo90rc', n: 'Codo radio corto 90', a: 0.76, b: 0.17 },
  { id: 'codo45rc', n: 'Codo radio corto 45', a: 0.38, b: 0.02 },
  { id: 'codo90rm', n: 'Codo radio medio 90', a: 0.67, b: 0.09 },
  { id: 'codo90rmSube', n: 'Codo radio medio 90 sube', a: 0.67, b: 0.09 },
  { id: 'codo90rmBaja', n: 'Codo radio medio 90 baja', a: 0.67, b: 0.09 },
  { id: 'codoReventilado', n: 'Codo reventilado', a: 0.52, b: 0.04 },
  { id: 'codo90rl', n: 'Codo radio largo 90', a: 0.52, b: 0.04 },
  { id: 'teeDirecto', n: 'Tee paso directo normal', a: 0.53, b: 0.04 },
  { id: 'teeReduccion', n: 'Tee paso directo con red.', a: 0.56, b: 0.33 },
  { id: 'teeLado', n: 'Tee paso lado', a: 1.56, b: 0.37 },
  { id: 'valvGlobo', n: 'Válvula de globo abierta', a: 8.44, b: 0.5 },
  { id: 'valvCompuerta', n: 'Válvula de compuerta abierta', a: 0.17, b: 0.03 },
  { id: 'valvCheque', n: 'Válvula cheque', a: 3.2, b: 0.03 },
  { id: 'valvPie', n: 'Válvula de pie con coladera', a: 6.38, b: 0.4 },
  { id: 'valvAngulo', n: 'Válvula de ángulo abierta', a: 4.27, b: 0.25 },
  { id: 'reduccion', n: 'Reducción', a: 0.15, b: 0.01 },
  { id: 'ampliacion', n: 'Ampliación', a: 0.31, b: 0.01 },
  { id: 'otros', n: 'Otros (definir la Le)', a: 0, b: 0 },
];

function lookupInternoPulg(pulg: number, tabla: { pulg: number; dInt: number }[]): number | null {
  if (!pulg || pulg <= 0) return null;
  const matches = tabla.filter((d) => Math.abs(d.pulg - pulg) < 0.01);
  if (matches.length === 0) return null;
  return matches[matches.length - 1].dInt;
}

export const lookupInterno = (pulg: number) => lookupInternoPulg(pulg, DIAMETROS_AF);
export const lookupInternoAC = (pulg: number) => lookupInternoPulg(pulg, DIAMETROS_AC);

export function calcLeAcces(
  accesorios: Record<string, number>,
  diamPulg: number,
  c: number,
): number {
  if (!accesorios || !diamPulg || diamPulg <= 0) return 0;
  const D = diamPulg;
  const k = Math.pow(120 / c, 1.85);
  let sum = 0;
  let otrosCount = 0;
  for (const def of LE_ACC_DEF) {
    const cnt = accesorios[def.id] || 0;
    if (def.id === 'otros') {
      otrosCount = cnt;
      continue;
    }
    if (cnt > 0) sum += cnt * (def.a * D + def.b);
  }
  return k * sum + otrosCount;
}
