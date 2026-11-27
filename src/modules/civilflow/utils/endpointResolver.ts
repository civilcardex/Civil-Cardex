/**
 * Resolución de extremos de ramal COMPARTIDA por los grafos de agua (waterRows/connectivity)
 * y lluvias (rainwaterRows): dado un punto, qué conecta ahí — bajante explícita (recibeDeIds),
 * bajante por cercanía (<2 px) o otro ramal por distancia a su polilínea. Ej: el extremo final
 * de RAF3 cae a 0.5 px de la bajante B2 -> { tipo: 'bajante', id: 'B2' }.
 */
import { distToPolyline } from '../lib/shared/geometry';

export interface RamalEndpointRef {
  id: string;
  pts?: number[][];
  label?: string;
}

export interface BajanteEndpointRef {
  id?: string;
  x?: number;
  y?: number;
}

export type Conexion = { type: 'bajante' | 'ramal'; id: string } | null;

/** Qué conecta el punto `pt` del ramal `r`: bajante explícita (recibeDeIds), bajante cerca
 *  (<2 px) o el ramal más cercano por su polilínea (también <2 px). `recibePorBajante` trae
 *  el Set de ids/labels que cada bajante recibe. Ej: ver módulo. */
export function checkEndpointDe<Rx extends RamalEndpointRef>(
  r: Rx,
  pt: number[],
  pStart: number[],
  pEnd: number[],
  bajantes: BajanteEndpointRef[],
  recibePorBajante: Map<string, Set<string>>,
  ramales: Rx[],
): Conexion {
  for (const b of bajantes) {
    const recibe = b.id ? recibePorBajante.get(b.id) : undefined;
    const isExplicit = !!recibe && (recibe.has(r.id) || (!!r.label && recibe.has(r.label)));
    const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
    if (isExplicit) {
      const otherPt = pt === pEnd ? pStart : pEnd;
      const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
      if (dist < otherDist) return { type: 'bajante', id: b.id! };
      continue;
    }
    if (dist < 2.0) {
      return { type: 'bajante', id: b.id! };
    }
  }
  let bestRx: Rx | null = null;
  let minDist = Infinity;
  for (const rx of ramales) {
    if (rx.id === r.id) continue;
    if (!rx.pts || rx.pts.length < 2) continue;
    const dist = distToPolyline(pt, rx.pts);
    if (dist < 2.0 && dist < minDist) {
      minDist = dist;
      bestRx = rx;
    }
  }
  if (bestRx) return { type: 'ramal', id: bestRx.id };
  return null;
}
