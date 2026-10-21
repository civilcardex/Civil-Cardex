/** Detectores de uniones, separados de junctionAutoSplit: a qué familia pertenece un ramalito y
 *  cuál es su ramal principal (padre) cuando aterriza sobre otro. Movidos tal cual. */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoEstado.ts';

/** ¿Puede engancharse este ramalito (tributario) al ramal destino? Solo entre ramalitos de la
 *  misma familia: la regla de "tener el mismo padre" se revisa aguas arriba. */
export function canJoinTributario(engine: IPlanoEngineCore, target: PlanoRamal): boolean {
  if (engine.tipoTramo !== 'tributario') return false;
  if (target.tipo !== 'tributario') return false;
  return true;
}

/** Busca el ramal PRINCIPAL (padre) de un ramalito recién dibujado: el que su punta toca más de
 *  cerca (dentro de 0.5 px). Ante empate, gana el que no sea ramalito. */
export function detectTributaryPadre(
  engine: IPlanoEngineCore,
  pts: number[][],
  net: string,
): string | null {
  if (!pts || pts.length < 2) return null;
  const TOL = 0.5;
  // Distancia de un punto `p` al segmento [a,b] (para elegir el ramal al que el tributario se
  // conecta MÁS directamente, en vez de devolver el primer ramal del array que lo toque — el bug
  // reportado: todo tributario caía en el primer ramal de la red).
  const segDist = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const sameGroup = (o: string) =>
    o === net || ((o === 'san' || o === 'vent') && (net === 'san' || net === 'vent'));
  const tribEps = [pts[0], pts[pts.length - 1]];
  const mid: number[] = [
    (pts[0][0] + pts[pts.length - 1][0]) / 2,
    (pts[0][1] + pts[pts.length - 1][1]) / 2,
  ];
  let best: { id: string; d: number; midD: number } | null = null;
  for (const other of engine.ramales) {
    if (!sameGroup(other.net) || !other.pts || other.pts.length < 2) continue;
    let d = Infinity;
    for (const p of tribEps) {
      for (let i = 0; i < other.pts.length - 1; i++) {
        d = Math.min(d, segDist(p, other.pts[i], other.pts[i + 1]));
      }
      d = Math.min(d, segDist(p, other.pts[0], other.pts[0]));
      d = Math.min(d, segDist(p, other.pts[other.pts.length - 1], other.pts[other.pts.length - 1]));
    }
    if (d > TOL) continue;
    // distancia del punto medio del tributario al padre para desempate en Y compartida
    let midD = Infinity;
    for (let i = 0; i < other.pts.length - 1; i++) {
      midD = Math.min(midD, segDist(mid, other.pts[i], other.pts[i + 1]));
    }
    if (!best) {
      best = { id: other.id, d, midD };
    } else if (d + 1e-9 < best.d) {
      best = { id: other.id, d, midD };
    } else if (Math.abs(d - best.d) < 1e-9) {
      if (midD + 1e-9 < best.midD) {
        best = { id: other.id, d, midD };
      } else if (Math.abs(midD - best.midD) < 1e-9 && other.tipo !== 'tributario') {
        const cur = engine.ramales.find((rr) => rr.id === best!.id);
        if (cur?.tipo === 'tributario') best = { id: other.id, d, midD };
      }
    }
  }
  return best ? best.id : null;
}
