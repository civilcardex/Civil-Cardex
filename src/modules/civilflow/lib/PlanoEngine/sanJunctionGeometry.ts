/**
 * Geometría de uniones san: carga las banderas yee persistidas (yeeDobleAt) y construye los
 * helpers de consulta (direcciones únicas en un punto, par de yee doble, tapón anclado).
 * Extraído verbatim de sanAccessoriesCalc.ts — lo consumen sanJunctionDetect,
 * sanTaponValidation y sanAccessoryCount vía el ctx.
 * Ej: dirsAt(P) devuelve 3 cuando en el punto P confluyen 3 tuberías (unión viva).
 */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';

/** Par de puntos de una yee doble persistida (la bandera se escribe en todos los ramales
 *  que tocan la yee): a y b son las dos derivaciones del glifo doble. */
interface YeePair {
  a: number[];
  b: number[];
}

/** Contexto compartido de los pases de accesorios san: ramales filtrados + helpers de
 *  geometría construidos UNA vez (cada helper cierra sobre sanRamales/persistidas). */
export interface SanJunctionCtx {
  sanRamales: PlanoRamal[];
  /** Puntos de yee persistidos (banderas yeeDobleAt de CUALQUIER ramal, incluidos pares
   *  degenerados [P,P]). Las pasadas siguientes pueden AGREGAR puntos (_taponKeepPts). */
  persistedYeePts: number[][];
  persistedYeePairs: YeePair[];
  nearPt: (p: number[], q: number[]) => boolean;
  /** Direcciones únicas de la red san en un punto: ≥3 = unión viva, 2 = esquina/paso recto. */
  dirsAt: (P: number[]) => number;
  pairOf: (P: number[]) => YeePair | undefined;
  /** ¿El punto PAR de `pair` (el que NO es `at`) sigue siendo una unión viva? Para pares
   *  degenerados [P,P] (doble en un solo punto) devuelve false: el "otro punto" es el mismo. */
  pairOtherAlive: (pair: YeePair, at: number[]) => boolean;
  /** ¿Hay un tapón anclado (extremos o accMed) a <0.5 de `q`? */
  taponAnchoredAt: (q: number[]) => boolean;
}

/** Crea el ctx de geometría para el piso cargado: filtra ramales san y construye los índices
 *  de banderas yee persistidas. Ej: const ctx = crearCtxSanJunction(engine); ctx.dirsAt(P). */
export function crearCtxSanJunction(
  _engine: IPlanoEngineCore,
  sanRamales: PlanoRamal[],
): SanJunctionCtx {
  // Puntos de yee persistidos (banderas yeeDobleAt de CUALQUIER ramal, incluidos pares
  // degenerados [P,P] de yees dobles de un solo punto). Se calcula ANTES del loop de detección:
  // un punto persistido cuya geometría quedó reducida a 3 direcciones (tronco recortado que
  // ahora TERMINA en la yee + 2 laterales) se clasifica tee por el par más opuesto — la bandera
  // lo fuerza a yee para que la identidad no muera (orig. usuario: quitar un segmento del brazo
  // principal borraba el símbolo de la yee doble).
  const persistedYeePts: number[][] = [];
  for (const r of sanRamales) {
    if (!r.yeeDobleAt) continue;
    for (const p of r.yeeDobleAt) persistedYeePts.push(p);
  }
  // Pares persistidos deduplicados (la bandera se escribe en todos los ramales que tocan la
  // yee): permiten saber si el punto PAR de una yee doble sigue vivo al contar y al escapar.
  const nearPt = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
  const persistedYeePairs: YeePair[] = [];
  const seenPair = new Set<string>();
  for (const r of sanRamales) {
    if (!r.yeeDobleAt || r.yeeDobleAt.length !== 2) continue;
    const k = [
      `${r.yeeDobleAt[0][0].toFixed(3)}_${r.yeeDobleAt[0][1].toFixed(3)}`,
      `${r.yeeDobleAt[1][0].toFixed(3)}_${r.yeeDobleAt[1][1].toFixed(3)}`,
    ]
      .sort()
      .join('|');
    if (seenPair.has(k)) continue;
    seenPair.add(k);
    persistedYeePairs.push({ a: r.yeeDobleAt[0], b: r.yeeDobleAt[1] });
  }
  const pairOf = (P: number[]) =>
    persistedYeePairs.find((pp) => nearPt(pp.a, P) || nearPt(pp.b, P));
  // Direcciones únicas de la red san en un punto: ≥3 = unión viva, 2 = esquina/paso recto.
  // Compartido por el conteo de yees dobles y la validación de tapones de más abajo.
  const dirsAt = (P: number[]): number => {
    const vecs: number[][] = [];
    for (const rr of sanRamales) {
      if (!rr.pts || rr.pts.length < 2) continue;
      let isVertex = false;
      for (let i = 0; i < rr.pts.length; i++) {
        if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
          isVertex = true;
          if (i > 0) {
            const dx = rr.pts[i - 1][0] - P[0];
            const dy = rr.pts[i - 1][1] - P[1];
            const l = Math.hypot(dx, dy);
            if (l > 0.1) vecs.push([dx / l, dy / l]);
          }
          if (i < rr.pts.length - 1) {
            const dx = rr.pts[i + 1][0] - P[0];
            const dy = rr.pts[i + 1][1] - P[1];
            const l = Math.hypot(dx, dy);
            if (l > 0.1) vecs.push([dx / l, dy / l]);
          }
        }
      }
      if (!isVertex) {
        for (let i = 0; i + 1 < rr.pts.length; i++) {
          const A = rr.pts[i];
          const B = rr.pts[i + 1];
          const dx = B[0] - A[0];
          const dy = B[1] - A[1];
          const lenSq = dx * dx + dy * dy;
          if (lenSq <= 0.001) continue;
          const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq));
          if (Math.hypot(P[0] - (A[0] + t * dx), P[1] - (A[1] + t * dy)) < 0.5) {
            const la = Math.hypot(A[0] - P[0], A[1] - P[1]);
            const lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
            if (la > 0.5) vecs.push([(A[0] - P[0]) / la, (A[1] - P[1]) / la]);
            if (lb > 0.5) vecs.push([(B[0] - P[0]) / lb, (B[1] - P[1]) / lb]);
          }
        }
      }
    }
    const uniq: number[][] = [];
    for (const v of vecs) {
      if (!uniq.some((u) => u[0] * v[0] + u[1] * v[1] > 0.99)) uniq.push(v);
    }
    return uniq.length;
  };
  const pairOtherAlive = (pair: YeePair, at: number[]): boolean => {
    if (nearPt(pair.a, pair.b)) return false;
    const other = nearPt(pair.a, at) ? pair.b : nearPt(pair.b, at) ? pair.a : null;
    return !!other && dirsAt(other) >= 3;
  };
  // ¿Hay un tapón anclado (extremos o accMed) a <0.5 de `q`? El borrado del brazo principal de
  // una yee doble deja tapón en su punto: la pieza física sigue siendo doble mientras exista.
  const taponAnchoredAt = (q: number[]): boolean =>
    sanRamales.some((rr) => {
      if (!rr.pts || rr.pts.length < 2) return false;
      const at = (p: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
      if (rr.accesorioInicio === 'tapon' && at(rr.pts[0])) return true;
      if (rr.accesorioFin === 'tapon' && at(rr.pts[rr.pts.length - 1])) return true;
      if (rr.accMed) {
        for (const [k, v] of Object.entries(rr.accMed)) {
          if (v !== 'tapon') continue;
          const m = k.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          if (idx >= 0 && rr.pts[idx] && at(rr.pts[idx])) return true;
        }
      }
      return false;
    });
  return {
    sanRamales,
    persistedYeePts,
    persistedYeePairs,
    nearPt,
    dirsAt,
    pairOf,
    pairOtherAlive,
    taponAnchoredAt,
  };
}
