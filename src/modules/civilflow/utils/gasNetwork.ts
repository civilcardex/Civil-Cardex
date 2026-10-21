import { origenDe, distToSegment } from '../lib/shared/geometry';

/** Tramo de gas (Gas) tal como está guardado: id, a qué piso pertenece y su geometría. */
export interface GasTramoNeto {
  id: string;
  planId: string | number;
  net?: string;
  tipo?: string;
  pts?: number[][];
  _tribReversed?: boolean;
}

// Tolerancia de encuentro extremo↔ramal: la misma del motor de dibujo para uniones gas
// (drawingAngles usa 0.5 unidades).
const TOL = 0.5;

/** Identificador único de tramo ("piso:id"): los ids de ramal se repiten entre pisos. Ej: '2:RS1'. */
export function claveGas(planId: string | number, id: string): string {
  return `${planId}:${id}`;
}

/** Árbol del gas: dice de qué ramal "cuelga" cada tramo (por dónde le entra el gas). Si el origen toca varios, se prefieren los troncos y no los tributarios. */
export function mapaPadresGas(
  tramos: GasTramoNeto[],
  esTributario?: (t: GasTramoNeto) => boolean,
): Map<string, string> {
  const padres = new Map<string, string>();
  for (const r of tramos) {
    if (!r.pts || r.pts.length < 2) continue;
    const o = origenDe(r);
    let mejor: string | null = null;
    let mejorEsTronco = false;
    for (const a of tramos) {
      if (a === r || !a.pts || a.pts.length < 2) continue;
      if (String(a.planId) !== String(r.planId)) continue; // el árbol vive por piso
      let toca =
        Math.hypot(o[0] - (a.pts![0] as number[])[0], o[1] - (a.pts![0] as number[])[1]) <= TOL;
      if (!toca) {
        toca =
          Math.hypot(
            o[0] - (a.pts![a.pts!.length - 1] as number[])[0],
            o[1] - (a.pts![a.pts!.length - 1] as number[])[1],
          ) <= TOL;
      }
      if (!toca) {
        for (let i = 0; i < a.pts!.length - 1 && !toca; i++) {
          const p1 = a.pts![i] as number[];
          const p2 = a.pts![i + 1] as number[];
          toca = distToSegment([o[0], o[1]], [p1[0], p1[1]], [p2[0], p2[1]]) <= TOL;
        }
      }
      if (!toca) continue;
      const esTronco = esTributario ? !esTributario(a) : true;
      if (!mejor || (esTronco && !mejorEsTronco)) {
        mejor = claveGas(a.planId, a.id);
        mejorEsTronco = esTronco;
      }
    }
    if (mejor) padres.set(claveGas(r.planId, r.id), mejor);
  }
  return padres;
}

/** Consumo ACUMULADO de cada tramo: lo suyo más todo lo que alimenta aguas abajo (el tronco lleva la demanda de la red entera que cuelga de él). */
export function acumuladosGas(
  tramos: GasTramoNeto[],
  padres: Map<string, string>,
  propios: Map<string, Record<string, number>>,
): Map<string, Record<string, number>> {
  const acc = new Map<string, Record<string, number>>();
  const profundidad = new Map<string, number>();
  const depth = (k: string, guard = 0): number => {
    if (profundidad.has(k)) return profundidad.get(k)!;
    if (guard > tramos.length) return 0;
    const p = padres.get(k);
    const d = p ? depth(p, guard + 1) + 1 : 0;
    profundidad.set(k, d);
    return d;
  };
  for (const t of tramos) depth(claveGas(t.planId, t.id));
  const orden = [...tramos]
    .map((t) => claveGas(t.planId, t.id))
    .sort((a, b) => (profundidad.get(b) ?? 0) - (profundidad.get(a) ?? 0));
  for (const k of orden) {
    const suma: Record<string, number> = { ...(propios.get(k) || {}) };
    for (const [hijo, padre] of padres) {
      if (padre !== k) continue;
      for (const [ap, n] of Object.entries(acc.get(hijo) || {})) {
        suma[ap] = (suma[ap] || 0) + n;
      }
    }
    acc.set(k, suma);
  }
  return acc;
}
