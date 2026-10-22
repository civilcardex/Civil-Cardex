import { sameNetGroup } from './drawingAngles.ts';

/**
 * Recorte de un trazo nuevo en su primera intersección real con otro ramal de la misma red.
 *
 * POR QUÉ: al dibujar un ramal o tributario que se pasa del punto de unión, el motor rechazaba
 * el trazo entero ("un tributario no puede cruzar un ramal") o lo dejaba atravesando el otro
 * sin dividir nada. Lo correcto es cortar el excedente justo en el cruce: el sobrante
 * desaparece y la unión en T se forma en ese punto.
 * Ej: tributario que termina 30 px después del tronco → se corta en el tronco (queda a 90°/45°)
 * y `autoSplitJunctionAndSumFlow` divide el tronco en la unión.
 */

/** Punto donde el trazo nuevo corta el cuerpo de un ramal existente. */
export interface CruceRecorte {
  /** Coordenadas del corte (sobre el cuerpo del ramal existente). */
  punto: [number, number];
  /** Ramal existente que corta. */
  ramalId: string;
  /** Índice del segmento del trazo nuevo donde cae el corte (0 = primer segmento). */
  segmento: number;
}

export interface OpcionesRecorte {
  /** Ids que no cuentan como host (el propio trazo, o el ramal del que se desvía). */
  ignorarIds?: Array<string | null | undefined>;
  /** Distancia mínima (px) desde el inicio del trazo para considerar un corte. Evita cortar el
   *  arranque del trazo, que siempre "toca" el ramal del que sale. Por defecto 2. */
  minDesdeInicio?: number;
  /** Distancia (px) bajo la cual un corte se considera el aterrizaje normal en la punta. 0.5. */
  omitirCercaDelFinal?: number;
  /** ¿El punto cae dentro del cuadro de una caja? Entrar a la misma caja no es cruzar (el motor
   *  ya lo exime en el chequeo en vivo y en el de ángulos): ahí no se recorta. */
  dentroDeCaja?: (p: [number, number]) => boolean;
}

/** Intersección estricta cuerpo-con-cuerpo (parámetros interiores en el host): un contacto en
 *  el vértice del host NO es un cruce (es una unión extremo-con-extremo, la resuelve el motor). */
function corteCuerpo(
  a1: number[],
  a2: number[],
  b1: number[],
  b2: number[],
): { x: number; y: number; t: number } | null {
  const rx = a2[0] - a1[0];
  const ry = a2[1] - a1[1];
  const sx = b2[0] - b1[0];
  const sy = b2[1] - b1[1];
  const lr = Math.hypot(rx, ry);
  const ls = Math.hypot(sx, sy);
  if (lr < 1e-6 || ls < 1e-6) return null;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null; // colineal: no hay un corte único
  const t = ((b1[0] - a1[0]) * sy - (b1[1] - a1[1]) * sx) / den;
  const u = ((b1[0] - a1[0]) * ry - (b1[1] - a1[1]) * rx) / den;
  // Interior del host con medio píxel de margen (vértices fuera).
  const epsU = 0.5 / ls;
  if (u <= epsU || u >= 1 - epsU) return null;
  if (t < 0 || t > 1) return null;
  return { x: a1[0] + t * rx, y: a1[1] + t * ry, t };
}

/** Primer cruce real del trazo con otro ramal de su red, medido desde su inicio. */
export function primerCruceEstricto(
  pts: number[][],
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  net: string,
  opts: OpcionesRecorte = {},
): CruceRecorte | null {
  if (!pts || pts.length < 2) return null;
  const ignorar = new Set((opts.ignorarIds || []).filter((x): x is string => !!x));
  const minInicio = opts.minDesdeInicio ?? 2;
  const omitirFinal = opts.omitirCercaDelFinal ?? 0.5;
  const fin = pts[pts.length - 1];
  let mejor: { cruce: CruceRecorte; dist: number } | null = null;
  let acumulado = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const r of ramales) {
      if (ignorar.has(r.id) || !r.pts || r.pts.length < 2) continue;
      if (!sameNetGroup(String(r.net || ''), net)) continue;
      for (let j = 0; j < r.pts.length - 1; j++) {
        const hit = corteCuerpo(a, b, r.pts[j], r.pts[j + 1]);
        if (!hit) continue;
        // La punta del trazo aterrizando sobre el host NO es un cruce: es la unión.
        if (Math.hypot(hit.x - fin[0], hit.y - fin[1]) < omitirFinal) continue;
        if (opts.dentroDeCaja && opts.dentroDeCaja([hit.x, hit.y])) continue;
        const dist = acumulado + hit.t * largo;
        if (dist < minInicio) continue;
        if (!mejor || dist < mejor.dist) {
          mejor = {
            dist,
            cruce: { punto: [hit.x, hit.y], ramalId: r.id, segmento: i },
          };
        }
      }
    }
    acumulado += largo;
  }
  return mejor?.cruce ?? null;
}

export interface ResultadoRecorte {
  /** Puntos resultantes (recortados o los originales). */
  pts: [number, number][];
  /** ¿Se cortó el excedente? */
  cortado: boolean;
  /** Cruce donde se cortó (null si no hubo). */
  cruce: CruceRecorte | null;
  /** El corte dejó menos de 2 puntos: el trazo no se puede crear. */
  invalido: boolean;
}

/** Corta el trazo en su primer cruce con otro ramal de la red y devuelve los puntos finales. */
export function recortarEnPrimerCruce(
  pts: number[][],
  ramales: Array<{ id: string; net?: string; pts?: number[][] }>,
  net: string,
  opts: OpcionesRecorte = {},
): ResultadoRecorte {
  const original = (pts || []).map((p) => [p[0], p[1]] as [number, number]);
  const cruce = primerCruceEstricto(pts, ramales, net, opts);
  if (!cruce) return { pts: original, cortado: false, cruce: null, invalido: false };
  const out: [number, number][] = [];
  for (let i = 0; i <= cruce.segmento; i++) out.push([pts[i][0], pts[i][1]]);
  const ultimo = out[out.length - 1];
  if (Math.hypot(ultimo[0] - cruce.punto[0], ultimo[1] - cruce.punto[1]) < 0.5) {
    out[out.length - 1] = cruce.punto;
  } else {
    out.push(cruce.punto);
  }
  if (out.length < 2) return { pts: original, cortado: false, cruce, invalido: true };
  return { pts: out, cortado: true, cruce, invalido: false };
}
