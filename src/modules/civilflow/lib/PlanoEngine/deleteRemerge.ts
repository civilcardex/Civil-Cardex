import type { IPlanoEngineCore, PlanoRamal } from './PlanoState';
import { _midpoint } from './PlanoEngineDrawing';
import { scrubAccMedTeeAt, scrubPlanCodoAt } from './deleteJunctionCleanup';
import { dirAt } from './deleteCascade';

import { angleAtHalfLength } from './drawingAngles';
import { calculateRamalLength } from './ramalMeasure';
// el tramo aguas abajo (D = mergesFrom[1]) que quedaron separados vuelven a ser UN ramal, con
// los datos de extremo lejano de D movidos a A, el UC revertido (D.uc − uc del borrado) y la
// etiqueta recalculada. Si en cambio se borra una de las dos mitades (A o D), solo se limpia la
// referencia mergesFrom muerta de la sobreviviente. Las cadenas (D dividido de nuevo después)
// se reescriben para apuntar de D.id → A.id.
/** Si el borrado separó dos mitades de un tramo unidas por mergesFrom, las vuelve a fusionar
 *  en un solo ramal: revierte el UC sumado y recalcula la etiqueta. Borrar una de las mitades
 *  a mano solo limpia la referencia muerta. */
export function remergeSplitRamales(
  engine: IPlanoEngineCore,
  deletedId: string,
  deletedUc: number,
): void {
  const TOL = 0.5;
  for (const d of [...engine.ramales]) {
    if (!d.mergesFrom) continue;
    if (d.mergesFrom[0] === deletedId) {
      // Se borró la mitad aguas arriba — la referencia de la sobreviviente queda muerta.
      d.mergesFrom = undefined;
      continue;
    }
    if (d.mergesFrom[1] !== deletedId) continue;
    // ponytail: find the GEOMETRIC upstream — the ramal whose END touches d's START and continues
    // the line. mergesFrom[0] is STALE after a subsequent split of the upstream half (the reported
    // bug: RS1|RS2|RS3 → deleting the first divisor merged RS2 into RS1, overlapping RS3). The
    // partition created by the deleted divisor must re-join its TRUE geometric neighbor.
    let a: PlanoRamal | null = null;
    if (d.pts && d.pts.length >= 2) {
      const dStart = d.pts[0];
      const dDirX = d.pts[1][0] - dStart[0];
      const dDirY = d.pts[1][1] - dStart[1];
      const dLen = Math.hypot(dDirX, dDirY) || 1;
      let bestDot = 1.1;
      for (const r of engine.ramales) {
        if (r.id === d.id || !r.pts || r.pts.length < 2 || r.net !== d.net) continue;
        const last = r.pts[r.pts.length - 1];
        if (Math.hypot(last[0] - dStart[0], last[1] - dStart[1]) > TOL) continue;
        const rDirX = last[0] - r.pts[r.pts.length - 2][0];
        const rDirY = last[1] - r.pts[r.pts.length - 2][1];
        const rLen = Math.hypot(rDirX, rDirY);
        if (rLen < 1e-6) continue;
        // collinear continuation: r's last segment and d's first share the point and run along
        // the SAME line (|dot|≈1). A straight pipe has both vectors pointing the same way (+1).
        const dot = (rDirX * dDirX + rDirY * dDirY) / (rLen * dLen);
        const coll = 1 - Math.abs(dot);
        if (coll < bestDot) {
          bestDot = coll;
          a = r;
        }
      }
    }
    // Fallback: original upstream reference (simple/chain splits where it is still adjacent).
    if (!a) a = engine.ramales.find((r) => r.id === d.mergesFrom![0]) || null;
    if (!a || !a.pts || a.pts.length < 2 || !d.pts || d.pts.length < 2) {
      d.mergesFrom = undefined;
      continue;
    }
    const aLast = a.pts[a.pts.length - 1];
    const dFirst = d.pts[0];
    const gap = Math.hypot(aLast[0] - dFirst[0], aLast[1] - dFirst[1]);
    // ponytail: gap always closed — division must not persist after cause removed, even if dragged
    if (gap > TOL) {
      d.pts[0] = [aLast[0], aLast[1]];
    }
    // Ítem 1: el punto compartido (aLast) es la unión donde se borró el brazo. Tras fusionar ya
    // no es una tee ni una esquina — se elimina cualquier marcador tee/codo ahí para que no se
    // quede el símbolo ni se reubique al extremo del ramal re-unido.
    scrubAccMedTeeAt(engine, aLast);
    scrubPlanCodoAt(engine, aLast);
    // Re-unir: A continúa con el cuerpo de D (salvo el punto compartido).
    a.pts = [...a.pts, ...d.pts.slice(1)];
    a.totalL = calculateRamalLength(a.pts, engine);
    // El UC del downstream acreditaba existing.uc + incoming.uc — al borrar el incoming se
    // revierte a la suma que ya traía la mitad aguas arriba. Con la re-unón geométrica el
    // upstream puede ser OTRO downstream (RS3): nunca reducir su propia UC acumulada.
    a.uc = Math.max(a.uc || 0, (d.uc || 0) - deletedUc);
    // Mover los datos de extremo lejano de D a A (se ponían en D al dividir).
    if (d.accesorioFin) a.accesorioFin = d.accesorioFin;
    if (d.diametroFin) a.diametroFin = d.diametroFin;
    if (d.aparatoFin) a.aparatoFin = d.aparatoFin;
    if (d.sifonLabelFin) a.sifonLabelFin = d.sifonLabelFin;
    // Los aparatos/fixtures del downstream fusionado se suman a A — sin esto, al borrar el
    // divisor de una T/Y los aparatos del tramo aguas abajo se perdían (orig. #8: "al renumerar
    // se resetea los aparatos"). Se suman cantidad por cantidad, no se sobreescriben.
    if (d.fixtures) {
      const merged = { ...(a.fixtures || {}) };
      for (const [k, v] of Object.entries(d.fixtures)) merged[k] = (merged[k] || 0) + (v || 0);
      a.fixtures = merged;
    }
    if (d.hydroAcc) a.hydroAcc = d.hydroAcc;
    if (d.gasAcc) {
      const merged = { ...(a.gasAcc || {}) };
      for (const [k, v] of Object.entries(d.gasAcc)) merged[k] = (merged[k] || 0) + (v || 0);
      a.gasAcc = merged;
    }
    // accMed interiores de D (p. ej. un tee de montante a mitad de cuerpo) se reindexan al
    // nuevo orden de A (el punto compartido queda en el índice base).
    if (d.accMed) {
      if (!a.accMed) a.accMed = {};
      const base = a.pts.length - 1;
      for (const [k, v] of Object.entries(d.accMed)) {
        const m = k.match(/^accMed(\d+)$/);
        if (!m) continue;
        a.accMed[`accMed${base + parseInt(m[1], 10)}`] = v;
      }
    }
    // Etiqueta recalculada sobre el cuerpo re-unido.
    const [mx, my] = _midpoint(a.pts);
    a.labelX = mx;
    a.labelY = my;
    if (a.labelAngle == null) a.labelAngle = angleAtHalfLength(a.pts);
    // Reescritura de cadenas: cualquier ramal que referencie D.id pasa a apuntar a A.id.
    const dId = d.id;
    engine.ramales = engine.ramales.filter((r) => r.id !== dId);
    for (const m of engine.ramales) {
      if (m.mergesFrom) {
        m.mergesFrom = [
          m.mergesFrom[0] === dId ? a.id : m.mergesFrom[0],
          m.mergesFrom[1] === dId ? a.id : m.mergesFrom[1],
        ];
      }
    }
  }
  // Fallback (Ítem 9/v2): cuando se borra una de las MITADES de un ramal partido (no la rama
  // que causó el split), la otra mitad + un ramal colineal adyacente pueden quedar como dos
  // trazos. Si dos ramales comparten extremo, continúan en la misma línea (colineales) y en ese
  // punto NO se ramifican (grado 2), se funden en uno solo — un trazo continuo, un solo borrado.
  mergeCollinearPairs(engine);
}

// Funde ramales colineales que se tocan extremo-a-extremo sin ramificación en el punto.
function mergeCollinearPairs(engine: IPlanoEngineCore): void {
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
