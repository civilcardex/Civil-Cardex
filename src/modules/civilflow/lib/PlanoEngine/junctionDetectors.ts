/** Detectores de unión extraídos de junctionAutoSplit (Oleada 1): pertenencia de
 *  tributarios, yee simple y autodetección de padre. Movidos verbatim. */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';

/** ¿Puede unirse un tributario al ramal destino? Solo si ambos son tributarios — la regla de igualdad de padre se valida aguas arriba. */
export function canJoinTributario(engine: IPlanoEngineCore, target: PlanoRamal): boolean {
  if (engine.tipoTramo !== 'tributario') return false;
  if (target.tipo !== 'tributario') return false;
  return true;
}

/** Detecta una yee SIMPLE cerca del extremo que se está dibujando: una unión de 3 vías
 *  formada por empalme sobre el cuerpo de otro ramal, sin marca de tee. Auto-snap
 *  deshabilitado por UX (usuario usa línea guía para yee doble); se mantiene exportada por
 *  si se reactiva. */
export function detectYeeSimpleNear(
  engine: IPlanoEngineCore,
  px: number,
  py: number,
  tol: number,
): { x: number; y: number; trunk: { x: number; y: number } } | null {
  const ramales = engine.ramales.filter((r) => r.net === engine.activeNet);
  if (ramales.length < 2) return null;
  const mp = new Map<string, number[]>();
  for (const r of ramales)
    for (const p of r.pts || []) mp.set(`${p[0].toFixed(3)}_${p[1].toFixed(3)}`, p);
  let best: { x: number; y: number; trunk: { x: number; y: number } } | null = null;
  let bestD = Infinity;
  for (const P of mp.values()) {
    const d = Math.hypot(P[0] - px, P[1] - py);
    if (d > tol) continue;
    const vecs: { x: number; y: number }[] = [];
    for (const rr of ramales) {
      if (!rr.pts) continue;
      for (let i = 0; i < rr.pts.length; i++)
        if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
          if (i > 0) {
            const dx = rr.pts[i - 1][0] - P[0],
              dy = rr.pts[i - 1][1] - P[1];
            const l = Math.hypot(dx, dy);
            if (l > 0.1) vecs.push({ x: dx / l, y: dy / l });
          }
          if (i < rr.pts.length - 1) {
            const dx = rr.pts[i + 1][0] - P[0],
              dy = rr.pts[i + 1][1] - P[1];
            const l = Math.hypot(dx, dy);
            if (l > 0.1) vecs.push({ x: dx / l, y: dy / l });
          }
        }
    }
    const uniq: typeof vecs = [];
    for (const v of vecs) if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
    if (uniq.length < 3 || uniq.length > 4) continue;
    // Par casi opuesto = tronco
    let bestPair = { i: -1, j: -1, dot: 1 };
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++) {
        const dd = uniq[i].x * uniq[j].x + uniq[i].y * uniq[j].y;
        if (dd < bestPair.dot) bestPair = { i, j, dot: dd };
      }
    if (bestPair.dot >= -0.9) continue;
    const branches = uniq.filter((_, k) => k !== bestPair.i && k !== bestPair.j);
    if (branches.length === 0) continue;
    const cosVal = branches[0].x * uniq[bestPair.j].x + branches[0].y * uniq[bestPair.j].y;
    const isYee = Math.abs(cosVal) >= 0.25 && Math.abs(cosVal) <= 0.85;
    if (!isYee) continue;
    // ¿Ya es doble (otra unión a ≤10mm alineada)? Si sí, no empujar más.
    let isDouble = false;
    for (const rr of ramales) {
      if (!rr.pts) continue;
      for (const q of rr.pts) {
        if (q === P) continue;
        const dq = Math.hypot(q[0] - P[0], q[1] - P[1]);
        if (dq > 0 && dq <= 10 && mp.has(`${q[0].toFixed(3)}_${q[1].toFixed(3)}`)) {
          isDouble = true;
          break;
        }
      }
      if (isDouble) break;
    }
    if (isDouble) continue;
    if (d < bestD) {
      bestD = d;
      best = { x: P[0], y: P[1], trunk: uniq[bestPair.i] };
    }
  }
  return best;
}

/** Autodetección de padre para un tributario dibujado sin haber seleccionado padre en la barra
 *  (orig. #5 — feature grande): busca el ramal existente del mismo grupo cuyo cuerpo o extremo
 *  toca el trazo. Devuelve el id del padre, o null. */
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
