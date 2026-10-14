/** Internos del re-merge extraídos de deleteRemerge (Oleada 2): saneo de vértices,
 *  fusión de pares colineales y distancia a cuerpo. Movidos verbatim. */
import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { calculateRamalLength } from './ramalMeasure';
import { _midpoint } from './PlanoEngineDrawing';
import { scrubAccMedTeeAt, scrubPlanCodoAt } from './deleteJunctionCleanup';
import { dirAt } from './deleteCascade';
import { angleAtHalfLength } from './drawingAngles';

export function healMergedVertices(engine: IPlanoEngineCore, a: PlanoRamal): void {
  const TOL = 0.5;
  if (!a.pts || a.pts.length < 3) return;
  const pointBusy = (p: number[]): boolean => {
    for (const r of engine.ramales) {
      if (r.id === a.id || !r.pts || r.pts.length < 2) continue;
      for (const q of r.pts) {
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < TOL) return true;
      }
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const A = r.pts[i];
        const B = r.pts[i + 1];
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const l2 = dx * dx + dy * dy;
        if (l2 < 1e-9) continue;
        const t = ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2;
        if (t <= 0.001 || t >= 0.999) continue;
        if (Math.hypot(p[0] - (A[0] + t * dx), p[1] - (A[1] + t * dy)) < TOL) return true;
      }
    }
    for (const b of engine.bajantes) {
      if (Math.hypot(b.x - p[0], b.y - p[1]) < TOL) return true;
    }
    return false;
  };
  let i = 1;
  while (i < a.pts.length - 1) {
    const p = a.pts[i];
    const ux = p[0] - a.pts[i - 1][0];
    const uy = p[1] - a.pts[i - 1][1];
    const vx = a.pts[i + 1][0] - p[0];
    const vy = a.pts[i + 1][1] - p[1];
    const lu = Math.hypot(ux, uy);
    const lv = Math.hypot(vx, vy);
    const colinear = lu > 1e-6 && lv > 1e-6 && Math.abs((ux * vx + uy * vy) / (lu * lv)) > 0.9;
    if (!a.accMed?.[`accMed${i}`] && colinear && !pointBusy(p)) {
      a.pts.splice(i, 1);
      if (a.accMed) {
        const shifted: Record<string, string> = {};
        for (const [k, v] of Object.entries(a.accMed)) {
          const m = k.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          shifted[idx > i ? `accMed${idx - 1}` : k] = v;
        }
        a.accMed = shifted;
      }
    } else {
      i++;
    }
  }
  a.totalL = calculateRamalLength(a.pts, engine);
  // Respetar el posicionamiento manual: una etiqueta arrastrada a mano (labelMoved) no vuelve
  // al midpoint del ramal re-unido (misma regla que junctionAutoSplit/editores).
  if (!a.labelMoved) {
    const [mx, my] = _midpoint(a.pts);
    a.labelX = mx;
    a.labelY = my;
  }
}
export function mergeCollinearPairs(engine: IPlanoEngineCore): void {
  const TOL = 0.5;
  let merged = true;
  while (merged) {
    merged = false;
    const ramales = [...engine.ramales];
    for (let i = 0; i < ramales.length; i++) {
      const A = ramales[i];
      if (!A?.pts || A.pts.length < 2) continue;
      for (let j = i + 1; j < ramales.length; j++) {
        const B = ramales[j];
        if (!B?.pts || B.pts.length < 2 || B.net !== A.net) continue;
        if (B.id === A.id) continue;
        // ¿Comparten un extremo?
        const a0 = A.pts[0];
        const a1 = A.pts[A.pts.length - 1];
        const b0 = B.pts[0];
        const b1 = B.pts[B.pts.length - 1];
        // encuentra la pareja de extremos que coinciden y en qué orden fusionar
        let shared = -1; // 0: A.end-B.start, 1: A.end-B.end, 2: A.start-B.end, 3: A.start-B.start
        if (Math.hypot(a1[0] - b0[0], a1[1] - b0[1]) < TOL) shared = 0;
        else if (Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) < TOL) shared = 1;
        else if (Math.hypot(a0[0] - b1[0], a0[1] - b1[1]) < TOL) shared = 2;
        else if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) < TOL) shared = 3;
        if (shared < 0) continue;
        const sharedPt = shared === 0 || shared === 2 ? a1 : a0;
        // ¿Grado 2? (en el punto tocan exactamente A y B, no otros ramales ni bajantes)
        let touching = 2;
        for (const r of engine.ramales) {
          if (r.id === A.id || r.id === B.id) continue;
          if (!r.pts || r.pts.length < 2) continue;
          const hit =
            Math.hypot(r.pts[0][0] - sharedPt[0], r.pts[0][1] - sharedPt[1]) < TOL ||
            Math.hypot(
              r.pts[r.pts.length - 1][0] - sharedPt[0],
              r.pts[r.pts.length - 1][1] - sharedPt[1],
            ) < TOL;
          if (hit) {
            touching++;
            break;
          }
        }
        for (const baj of engine.bajantes) {
          if (Math.hypot(baj.x - sharedPt[0], baj.y - sharedPt[1]) < TOL) {
            touching++;
            break;
          }
        }
        if (touching !== 2) continue;
        // Al fusionarse ya no hay unión en ese punto — limpiar cualquier marcador de tee residual.
        scrubAccMedTeeAt(engine, sharedPt);
        scrubPlanCodoAt(engine, sharedPt);
        // ¿Colineales (siguen rectos por el punto)?
        const dA = A.pts.length >= 2 ? dirAt(A, sharedPt) : null;
        const dB = B.pts.length >= 2 ? dirAt(B, sharedPt) : null;
        if (!dA || !dB) continue;
        const dot = dA[0] * dB[0] + dA[1] * dB[1];
        // Han de continuar en línea recta a través del punto: direcciones OPUESTAS (dot ≈ -1).
        // Un plegado (ambos hacia el mismo lado, dot ≈ +1) no es un trazo continuo.
        // Tolerancia 0.9 (≈25°) — los dos tramos de un split rara vez quedan PERFECTAMENTE
        // colineales (el divisor cae con pequeño desvío), y con 0.98 estricto no se fusionaban.
        if (dot > -0.9) continue;
        // Fusionar A+B en un solo ramal
        let primary = A,
          secondary = B;
        let mergedPts: number[][];
        if (shared === 0 || shared === 1) {
          mergedPts = [...A.pts, ...(shared === 0 ? B.pts.slice(1) : B.pts.slice(1).reverse())];
        } else {
          // compartimos por el inicio de A → A va después de B
          mergedPts = [...B.pts, ...(shared === 3 ? A.pts.slice(1) : A.pts.slice(1).reverse())];
          primary = B;
          secondary = A;
        }
        primary.pts = mergedPts;
        primary.totalL = calculateRamalLength(primary.pts, engine);
        if (secondary.accesorioFin) primary.accesorioFin = secondary.accesorioFin;
        if (secondary.diametroFin) primary.diametroFin = secondary.diametroFin;
        if (secondary.aparatoFin) primary.aparatoFin = secondary.aparatoFin;
        if (secondary.sifonLabelFin) primary.sifonLabelFin = secondary.sifonLabelFin;
        // Fusionar aparatos/fixtures del ramal fusionado (orig. #8) — igual que remergeSplitRamales.
        if (secondary.fixtures) {
          const merged = { ...(primary.fixtures || {}) };
          for (const [k, v] of Object.entries(secondary.fixtures))
            merged[k] = (merged[k] || 0) + (v || 0);
          primary.fixtures = merged;
        }
        if (secondary.hydroAcc) primary.hydroAcc = secondary.hydroAcc;
        if (secondary.gasAcc) {
          const merged = { ...(primary.gasAcc || {}) };
          for (const [k, v] of Object.entries(secondary.gasAcc))
            merged[k] = (merged[k] || 0) + (v || 0);
          primary.gasAcc = merged;
        }
        const [mx, my] = _midpoint(primary.pts);
        primary.labelX = mx;
        primary.labelY = my;
        if (primary.labelAngle == null) primary.labelAngle = angleAtHalfLength(primary.pts);
        const secondaryId = secondary.id;
        engine.ramales = engine.ramales.filter((r) => r.id !== secondaryId);
        for (const m of engine.ramales) {
          if (m.mergesFrom) {
            m.mergesFrom = [
              m.mergesFrom[0] === secondaryId ? primary.id : m.mergesFrom[0],
              m.mergesFrom[1] === secondaryId ? primary.id : m.mergesFrom[1],
            ];
          }
        }
        // Sanar vértices fantasma DESPUÉS de retirar secondary (si no, él mismo mantiene
        // "ocupado" el punto compartido — ver healMergedVertices).
        healMergedVertices(engine, primary);
        merged = true;
        break;
      }
      if (merged) break;
    }
  }
  // Limpiar referencias mergesFrom que apunten a ramales borrados/inexistentes
  for (const m of engine.ramales) {
    if (!m.mergesFrom) continue;
    const [p0, p1] = m.mergesFrom;
    if (!engine.ramales.some((r) => r.id === p0) || !engine.ramales.some((r) => r.id === p1)) {
      m.mergesFrom = undefined;
    }
  }
}
export function distToPolylineBody(p: number[], pts: number[][]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++)
    d = Math.min(d, Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]));
  for (let i = 0; i + 1 < pts.length; i++) {
    const A = pts[i];
    const B = pts[i + 1];
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2));
    d = Math.min(d, Math.hypot(p[0] - (A[0] + t * dx), p[1] - (A[1] + t * dy)));
  }
  return d;
}
