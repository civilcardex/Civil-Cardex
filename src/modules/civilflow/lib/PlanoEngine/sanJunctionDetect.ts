/**
 * Detección de uniones yee/tee de la red san: recorre cada vértice del piso, mide las
 * direcciones que confluyen y clasifica yee (lateral a ~45°) o tee (perpendicular), escribiendo
 * la identidad de las yees dobles en TODOS los ramales que tocan el punto. Extraído verbatim
 * de sanAccessoriesCalc.ts. Ej: en una T de 3 tuberías perpendiculares registra una tee.
 */
import type { IPlanoEngineCore } from './PlanoState.ts';
import type { SanJunctionCtx } from './sanJunctionGeometry.ts';
import { uniqDirs } from '../shared/geometry.ts';

/** Resultado de la detección: qué ramal hospeda cada yee (host canónico), en qué punto, el
 *  coseno de su rama lateral (para clasificar simple/doble) y los ramales de cada tee. */
export interface SanJunctionResult {
  junctionRamalIds: string[];
  junctionPositions: { x: number; y: number }[];
  junctionBranchCos: number[];
  teeRamalIds: string[];
}

/** Detecta yees y tees por vértice san. MUTA ramales: el escape de bandera persistida muerta
 *  (yeeDobleAt = undefined) es parte del pase. */
export function detectarJunctiones(
  engine: IPlanoEngineCore,
  ctx: SanJunctionCtx,
): SanJunctionResult {
  const { sanRamales, persistedYeePts, pairOf, pairOtherAlive, nearPt } = ctx;
  const junctionRamalIds: string[] = [];
  const junctionPositions: { x: number; y: number }[] = [];
  const junctionBranchCos: number[] = [];
  const teeRamalIds: string[] = [];

  const getPointKey = (x: number, y: number) => `${x.toFixed(3)}_${y.toFixed(3)}`;
  const vertexMap = new Map<string, number[]>();
  sanRamales.forEach((r) => {
    (r.pts || []).forEach((pt) => {
      vertexMap.set(getPointKey(pt[0], pt[1]), pt);
    });
  });

  vertexMap.forEach((P) => {
    const vectors: { x: number; y: number }[] = [];

    sanRamales.forEach((rr) => {
      if (!rr.pts) return;
      let isVertex = false;
      for (let i = 0; i < rr.pts.length; i++) {
        if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
          isVertex = true;
          if (i > 0) {
            const dx = rr.pts[i - 1][0] - P[0],
              dy = rr.pts[i - 1][1] - P[1];
            const len = Math.hypot(dx, dy);
            if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
          }
          if (i < rr.pts.length - 1) {
            const dx = rr.pts[i + 1][0] - P[0],
              dy = rr.pts[i + 1][1] - P[1];
            const len = Math.hypot(dx, dy);
            if (len > 0.1) vectors.push({ x: dx / len, y: dy / len });
          }
        }
      }
      if (!isVertex) {
        for (let i = 0; i < rr.pts.length - 1; i++) {
          const A = rr.pts[i],
            B = rr.pts[i + 1];
          const dx = B[0] - A[0],
            dy = B[1] - A[1];
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 0.001) {
            let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * dx,
              projY = A[1] + t * dy;
            const dist = Math.hypot(P[0] - projX, P[1] - projY);
            const lenA = Math.hypot(A[0] - P[0], A[1] - P[1]);
            const lenB = Math.hypot(B[0] - P[0], B[1] - P[1]);
            if (dist < 0.5 && lenA > 0.5 && lenB > 0.5) {
              vectors.push({ x: (A[0] - P[0]) / lenA, y: (A[1] - P[1]) / lenA });
              vectors.push({ x: (B[0] - P[0]) / lenB, y: (B[1] - P[1]) / lenB });
            }
          }
        }
      }
    });

    const uniq = uniqDirs(vectors);
    if (uniq.length < 3 || uniq.length > 4) return;
    // Punto con bandera yee persistida: aunque el tronco ya no pase por él (recorte que lo
    // deja TERMINANDO en la yee — 3 dirs sin par casi-colineal), la identidad persistida
    // mantiene la unión viva y la clasifica yee (ver comentario de persistedYeePts arriba).
    const onPersistedYee = persistedYeePts.some((p) => Math.hypot(p[0] - P[0], p[1] - P[1]) < 0.5);

    let bestPair = { i: -1, j: -1, dot: 1 };
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++) {
        const d = uniq[i].x * uniq[j].x + uniq[i].y * uniq[j].y;
        if (d < bestPair.dot) bestPair = { i, j, dot: d };
      }
    if (bestPair.dot >= -0.9 && !onPersistedYee) return;

    const branches = uniq.filter((_, k) => k !== bestPair.i && k !== bestPair.j);
    if (branches.length === 0) return;
    const cosVal = branches[0].x * uniq[bestPair.j].x + branches[0].y * uniq[bestPair.j].y;
    const isYee = Math.abs(cosVal) >= 0.25 && Math.abs(cosVal) <= 0.85;
    const isTee = Math.abs(cosVal) < 0.15;

    // Escape de la bandera persistida: geometría de TEE genuina (par colineal + rama
    // perpendicular) y el punto PAR de la yee doble ya NO es una unión viva → la identidad
    // murió: limpiar la bandera y clasificar tee. Sin esto, un punto convertido en tee sobre
    // los restos de la yee quedaba forzado a yee (y contado doble) para siempre. La yee
    // recortada (tronco que TERMINA en el punto, sin par colineal) NO escapa: su forma
    // bestPair.dot >= -0.9 no entra aquí.
    let persistedEscape = false;
    if (onPersistedYee && bestPair.dot < -0.9 && isTee) {
      const pair = pairOf(P);
      if (pair && !pairOtherAlive(pair, P)) {
        for (const rr of sanRamales) {
          if (!rr.yeeDobleAt) continue;
          const [fa, fb] = rr.yeeDobleAt;
          const matches =
            (nearPt(fa, pair.a) && nearPt(fb, pair.b)) ||
            (nearPt(fa, pair.b) && nearPt(fb, pair.a));
          if (matches) rr.yeeDobleAt = undefined;
        }
        persistedEscape = true;
      }
    }

    if (isYee || (onPersistedYee && !persistedEscape)) {
      // TODOS los ramales san que tocan el punto (vértice propio o cuerpo atravesado):
      // tronco + laterales. La identidad de la yee doble se escribe en todos para que el
      // símbolo sobreviva al borrado de CUALQUIERA de ellos (antes solo el primer ramal
      // encontrado llevaba la bandera y al borrarlo el glifo desaparecía — orig. usuario).
      const idsAtP: string[] = [];
      for (const rr of sanRamales) {
        if (!rr.pts) continue;
        let found = false;
        for (let k = 0; k < rr.pts.length && !found; k++) {
          if (Math.hypot(rr.pts[k][0] - P[0], rr.pts[k][1] - P[1]) < 0.5) found = true;
        }
        for (let k = 0; k + 1 < rr.pts.length && !found; k++) {
          const A = rr.pts[k],
            B = rr.pts[k + 1];
          const sdx = B[0] - A[0],
            sdy = B[1] - A[1];
          const sLenSq = sdx * sdx + sdy * sdy;
          if (sLenSq > 0.001) {
            let t = ((P[0] - A[0]) * sdx + (P[1] - A[1]) * sdy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * sdx,
              projY = A[1] + t * sdy;
            if (Math.hypot(P[0] - projX, P[1] - projY) < 0.5) found = true;
          }
        }
        if (found) idsAtP.push(String(rr.id));
      }
      if (idsAtP.length > 0) {
        // Host canónico: primer ramal NO tributario que toca el punto (la tubería principal) —
        // misma regla que el hostKey de la tabla de resumen. Antes el orden del array podía
        // registrar la yee bajo el id del lateral y la tabla la perdía (orig. usuario: contaba
        // 2 de 3 yees simples).
        const hostId =
          idsAtP.find((id) => {
            const rr = engine.ramales.find((x) => x.id === id);
            return !!rr && rr.tipo !== 'tributario';
          }) || idsAtP[0];
        junctionRamalIds.push(hostId);
        junctionPositions.push({ x: P[0], y: P[1] });
        junctionBranchCos.push(cosVal);
      }
    }

    if (isTee && (!onPersistedYee || persistedEscape)) {
      for (const rr of sanRamales) {
        if (!rr.pts) continue;
        for (let k = 0; k < rr.pts.length; k++) {
          if (Math.hypot(rr.pts[k][0] - P[0], rr.pts[k][1] - P[1]) < 0.5) {
            teeRamalIds.push(String(rr.id));
            return;
          }
        }
        for (let k = 0; k < rr.pts.length - 1; k++) {
          const A = rr.pts[k],
            B = rr.pts[k + 1];
          const sdx = B[0] - A[0],
            sdy = B[1] - A[1];
          const sLenSq = sdx * sdx + sdy * sdy;
          if (sLenSq > 0.001) {
            let t = ((P[0] - A[0]) * sdx + (P[1] - A[1]) * sdy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = A[0] + t * sdx,
              projY = A[1] + t * sdy;
            if (Math.hypot(P[0] - projX, P[1] - projY) < 0.5) {
              teeRamalIds.push(String(rr.id));
              return;
            }
          }
        }
      }
    }
  });

  return { junctionRamalIds, junctionPositions, junctionBranchCos, teeRamalIds };
}
