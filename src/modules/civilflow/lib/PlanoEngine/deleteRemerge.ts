import type { IPlanoEngineCore, PlanoRamal } from './PlanoState.ts';
import {
  healMergedVertices,
  mergeCollinearPairs,
  distToPolylineBody,
} from './deleteRemergeInternals.ts';
import { relabelTribChain, allocTributaryNumber } from './PlanoState.ts';
import { _midpoint } from './PlanoEngineDrawing.ts';
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import {
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../../constants/storage-keys.ts';
import { devError } from '../../../../utils/devError.ts';
import { scrubAccMedTeeAt, scrubPlanCodoAt } from './deleteJunctionCleanup.ts';

import { angleAtHalfLength } from './drawingAngles.ts';
import { calculateRamalLength } from './ramalMeasure.ts';
// el tramo aguas abajo (D = mergesFrom[1]) que quedaron separados vuelven a ser UN ramal, con
// los datos de extremo lejano de D movidos a A, el UC revertido (D.uc − uc del borrado) y la
// etiqueta recalculada. Si en cambio se borra una de las dos mitades (A o D), solo se limpia la
// referencia mergesFrom muerta de la sobreviviente. Las cadenas (D dividido de nuevo después)
// se reescriben para apuntar de D.id → A.id.
/** Vuelve a unir las dos mitades de una tubería que había sido partida (mergeFrom guarda la
 *  genealogía del split) y le resta al ramal la UC (Unidades de Consumo) que la división le había
 *  sumado. */
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
    // Sanar vértices fantasma DESPUÉS de retirar D de ramales (si no, el propio D mantiene
    // "ocupado" el punto compartido y el heal no elimina nada).
    healMergedVertices(engine, a);
  }
  // Fallback (Ítem 9/v2): cuando se borra una de las MITADES de un ramal partido (no la rama
  // que causó el split), la otra mitad + un ramal colineal adyacente pueden quedar como dos
  // trazos. Si dos ramales comparten extremo, continúan en la misma línea (colineales) y en ese
  // punto NO se ramifican (grado 2), se funden en uno solo — un trazo continuo, un solo borrado.
  mergeCollinearPairs(engine);
}

/** Pega en una sola pieza los pedazos que quedan tocándose donde se borró una rama (solo en san
 *  (Sanitaria) y ll (Lluvias), donde los empalmes se funden). */
export function mergeTouchingRemnant(engine: IPlanoEngineCore, deletedPts: number[][]): void {
  const TOL = 0.5;
  const atDeleted = (p: number[]): boolean =>
    deletedPts.some((d) => Math.hypot(d[0] - p[0], d[1] - p[1]) < TOL);
  let merged = true;
  while (merged) {
    merged = false;
    const ramales = [...engine.ramales];
    for (let i = 0; i < ramales.length; i++) {
      const A = ramales[i];
      if (!A?.pts || A.pts.length < 2 || (A.net !== 'san' && A.net !== 'll')) continue;
      for (let j = i + 1; j < ramales.length; j++) {
        const B = ramales[j];
        if (!B?.pts || B.pts.length < 2 || B.net !== A.net || B.id === A.id) continue;
        const a0 = A.pts[0];
        const a1 = A.pts[A.pts.length - 1];
        const b0 = B.pts[0];
        const b1 = B.pts[B.pts.length - 1];
        let shared = -1; // 0: A.end-B.start, 1: A.end-B.end, 2: A.start-B.end, 3: A.start-B.start
        if (Math.hypot(a1[0] - b0[0], a1[1] - b0[1]) < TOL) shared = 0;
        else if (Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) < TOL) shared = 1;
        else if (Math.hypot(a0[0] - b1[0], a0[1] - b1[1]) < TOL) shared = 2;
        else if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) < TOL) shared = 3;
        if (shared < 0) continue;
        const sharedPt = shared === 0 || shared === 2 ? a1 : a0;
        // Solo en el sitio del borrado: el punto compartido debe coincidir con un punto de
        // un brazo eliminado en esta operación. Sin esto el merge destruía particiones
        // legítimas del tronco (divisores que el usuario quiere conservar separados).
        if (!atDeleted(sharedPt)) continue;
        // SOLO esquinas: si los dos ramales son COLINEALES a través del punto (misma línea),
        // son un tronco continuo — fusionarlos haría desaparecer la etiqueta del segundo
        // (orig. usuario: RS1|RS3 colineales se "borraban"). La esquina diagonal+horizontal
        // del trazo restante de la yee SÍ se fusiona en un solo ramal.
        const intoA = sharedPt === a1 ? A.pts[A.pts.length - 2] : A.pts[1];
        const intoB = sharedPt === b1 ? B.pts[B.pts.length - 2] : B.pts[1];
        const dax = intoA[0] - sharedPt[0];
        const day = intoA[1] - sharedPt[1];
        const dbx = intoB[0] - sharedPt[0];
        const dby = intoB[1] - sharedPt[1];
        const la = Math.hypot(dax, day);
        const lb = Math.hypot(dbx, dby);
        if (la < 1e-6 || lb < 1e-6) continue;
        if (Math.abs((dax * dbx + day * dby) / (la * lb)) > 0.9) continue; // colineales → no fusionar
        // Grado exacto 2 en el punto (sin otros ramales ni bajantes): continuación simple.
        let touching = 2;
        for (const r of engine.ramales) {
          if (r.id === A.id || r.id === B.id || !r.pts || r.pts.length < 2) continue;
          if (r.pts.some((p) => Math.hypot(p[0] - sharedPt[0], p[1] - sharedPt[1]) < TOL)) {
            touching++;
            break;
          }
        }
        if (touching !== 2) continue;
        for (const baj of engine.bajantes) {
          if (Math.hypot(baj.x - sharedPt[0], baj.y - sharedPt[1]) < TOL) {
            touching++;
            break;
          }
        }
        if (touching !== 2) continue;
        scrubAccMedTeeAt(engine, sharedPt);
        scrubPlanCodoAt(engine, sharedPt);
        // Fusionar conservando el vértice (puede NO ser colineal — esquina real del trazo).
        let primary = A;
        let mergedPts: number[][];
        if (shared === 0) mergedPts = [...A.pts, ...B.pts.slice(1)];
        else if (shared === 1) mergedPts = [...A.pts, ...B.pts.slice(1).reverse()];
        else if (shared === 2) {
          mergedPts = [...B.pts, ...A.pts.slice(1)];
          primary = B;
        } else {
          mergedPts = [...B.pts, ...A.pts.slice(1)];
          primary = B;
        }
        primary.pts = mergedPts;
        primary.totalL = calculateRamalLength(primary.pts, engine);
        if (B.accesorioFin) primary.accesorioFin = B.accesorioFin;
        if (B.diametroFin) primary.diametroFin = B.diametroFin;
        if (B.aparatoFin) primary.aparatoFin = B.aparatoFin;
        if (B.sifonLabelFin) primary.sifonLabelFin = B.sifonLabelFin;
        if (B.fixtures) {
          const merged = { ...(primary.fixtures || {}) };
          for (const [k, v] of Object.entries(B.fixtures)) merged[k] = (merged[k] || 0) + (v || 0);
          primary.fixtures = merged;
        }
        if (B.hydroAcc) primary.hydroAcc = B.hydroAcc;
        if (B.gasAcc) {
          const merged = { ...(primary.gasAcc || {}) };
          for (const [k, v] of Object.entries(B.gasAcc)) merged[k] = (merged[k] || 0) + (v || 0);
          primary.gasAcc = merged;
        }
        healMergedVertices(engine, primary);
        const [mx, my] = _midpoint(primary.pts);
        primary.labelX = mx;
        primary.labelY = my;
        if (primary.labelAngle == null) primary.labelAngle = angleAtHalfLength(primary.pts);
        const secondaryId = B.id;
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
}

// Elimina vértices interiores redundantes del ramal re-unido: colineales (la línea sigue recta
// a través del punto), sin accesorio anclado y grado-2 (ningún otro ramal/bajante toca el
// punto). Sin esto, las viejas uniones quedaban como quiebres fantasma y borrar un segmento
// del ramal re-unido lo partía por ahí (orig. usuario: el trazo se veía unido pero partía al
// borrarlo). Reindexa accMed tras cada splice.

// Funde ramales colineales que se tocan extremo-a-extremo sin ramificación en el punto.

/** Junta en una sola la esquina de dos ramalitos que se quedaron huérfanos (hereda el padre y la
 *  genealogía del split, mergesFrom). */
export function mergeTribPairAt(engine: IPlanoEngineCore, pt: number[]): void {
  const TOL = 0.5;
  if (engine.bajantes.some((b) => Math.hypot(b.x - pt[0], b.y - pt[1]) < TOL)) return;
  const tribAt = engine.ramales.filter(
    (r) =>
      r.tipo === 'tributario' &&
      r.pts &&
      r.pts.length >= 2 &&
      (Math.hypot(r.pts[0][0] - pt[0], r.pts[0][1] - pt[1]) < TOL ||
        Math.hypot(r.pts[r.pts.length - 1][0] - pt[0], r.pts[r.pts.length - 1][1] - pt[1]) < TOL),
  );
  if (tribAt.length !== 2 || tribAt[0].net !== tribAt[1].net) return;
  // Un ramal (no tributario) tocando el punto = unión real (tee/codo con el tronco): no fusionar.
  const otherTouching = engine.ramales.some((r) => {
    if (r.tipo === 'tributario' || !r.pts || r.pts.length < 2) return false;
    if (r.net !== tribAt[0].net) return false;
    if (
      r.pts.some((p) => Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL) ||
      distToPolylineBody(pt, r.pts) < TOL
    )
      return true;
    return false;
  });
  if (otherTouching) return;
  const [a, b] = tribAt;
  // Concatenar en orden: las 4 combinaciones de orientación.
  const near = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < TOL;
  let merged: number[][] | null = null;
  const aF = a.pts![a.pts!.length - 1];
  const bS = b.pts![0];
  const bF = b.pts![b.pts!.length - 1];
  const aS = a.pts![0];
  if (near(aF, bS)) merged = [...a.pts!, ...b.pts!.slice(1)];
  else if (near(aF, bF)) merged = [...a.pts!, ...[...b.pts!].reverse().slice(1)];
  else if (near(aS, bS)) merged = [...[...b.pts!].reverse(), ...a.pts!.slice(1)];
  else if (near(aS, bF)) merged = [...a.pts!, ...b.pts!.slice(1)];
  if (!merged || merged.length < 2) return;
  a.pts = merged;
  a.totalL = calculateRamalLength(a.pts, engine);
  if (!a.labelMoved) {
    const [mx, my] = _midpoint(a.pts);
    a.labelX = mx;
    a.labelY = my;
    a.labelAngle = angleAtHalfLength(a.pts);
  }
  // Refs de B → A
  for (const r of engine.ramales) {
    if (r.padre === b.id) r.padre = a.id;
    if (r.mergesFrom)
      r.mergesFrom = r.mergesFrom.map((x) => (x === b.id ? a.id : x)) as typeof r.mergesFrom;
  }
  for (const baj of engine.bajantes) {
    if (baj.recibeDeIds?.includes(b.id))
      baj.recibeDeIds = baj.recibeDeIds.map((x) => (x === b.id ? a.id : x));
  }
  if (engine.selId === b.id) engine.selId = a.id;
  engine.ramales = engine.ramales.filter((r) => r.id !== b.id);
  // La cadena del sobreviviente re-etiqueta con la raíz actual.
  relabelTribChain(engine.ramales, a.id, (suffix) => allocTributaryNumber(engine, suffix));
  // Contadores: aparatos/hidro de B se combinan en A por MAX (misma pieza, dos claves).
  const planId = engine._loadedPlanId;
  if (planId != null) {
    try {
      const all = loadFromStorage<Record<string, Record<string, number>>>(
        APARATOS_BY_TRAMO_KEY,
        {},
      );
      const from = `${b.net}_${b.id}_${planId}`;
      const to = `${b.net}_${a.id}_${planId}`;
      if (all[from]) {
        const dst = { ...(all[to] || {}) };
        for (const [k, v] of Object.entries(all[from]))
          dst[k] = Math.max(Number(dst[k]) || 0, Number(v) || 0);
        all[to] = dst;
        delete all[from];
        saveToStorage(APARATOS_BY_TRAMO_KEY, all);
      }
    } catch (e) {
      devError('PlanoEngine:', e);
    }
    try {
      const all = loadFromStorage<Record<string, { accesorios?: Record<string, number> }>>(
        HYDRO_DATA_STORAGE_KEY,
        {},
      );
      const from = `${b.net}_${b.id}_${planId}`;
      const to = `${b.net}_${a.id}_${planId}`;
      if (all[from]) {
        const dst = { ...(all[to]?.accesorios || {}) };
        for (const [k, v] of Object.entries(all[from].accesorios || {}))
          dst[k] = Math.max(Number(dst[k]) || 0, Number(v) || 0);
        all[to] = { ...(all[to] || {}), accesorios: dst };
        delete all[from];
        saveToStorage(HYDRO_DATA_STORAGE_KEY, all);
      }
    } catch (e) {
      devError('PlanoEngine:', e);
    }
  }
}
