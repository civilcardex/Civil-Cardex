import type { IPlanoEngineCore } from './PlanoState';
import { loadFromStorage, saveToStorage } from '../../services/storageService';
import { ANGLE_EPS } from './drawingAngles';
import { assignCodoAfterBranchDelete } from './deleteJunctionCleanup';

interface HidroTramoEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

export function calcSanitaryAccessories(engine: IPlanoEngineCore): void {
  const planId = engine._loadedPlanId;
  if (!planId) return;

  const sanRamales = engine.ramales.filter((r) => r.net === 'san');
  const ventRamales = engine.ramales.filter((r) => r.net === 'vent');

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
  const persistedYeePairs: Array<{ a: number[]; b: number[] }> = [];
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
  // ¿El punto PAR de `pair` (el que NO es `at`) sigue siendo una unión viva? Para pares
  // degenerados [P,P] (doble en un solo punto) devuelve false: el "otro punto" es el mismo.
  const pairOtherAlive = (pair: { a: number[]; b: number[] }, at: number[]): boolean => {
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
  const storageKey = 'tramo_hidro_data_v3';
  let hidroData: Record<string, HidroTramoEntry>;
  try {
    hidroData = loadFromStorage(storageKey, {}) as Record<string, HidroTramoEntry>;
  } catch {
    hidroData = {};
  }

  let changed = false;

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

    const uniq: typeof vectors = [];
    vectors.forEach((v) => {
      if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
    });
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

  const yeeCounts: Record<string, { simple: number; doble: number }> = {};

  for (let i = 0; i < junctionPositions.length; i++) {
    const id = junctionRamalIds[i];
    if (!yeeCounts[id]) yeeCounts[id] = { simple: 0, doble: 0 };
    const P = junctionPositions[i];
    const pt = [P.x, P.y];
    // Regla del usuario (definición fija): Yee doble SOLO cuando las DOS derivaciones caen en
    // el MISMO punto (4 direcciones = 2 salidas laterales en un solo glifo). Dos uniones
    // separadas —aunque estén pegadas— son SIEMPRE yees simples. La bandera [P,P] persistida
    // preserva la identidad a través del render; un lateral tapiado mantiene la doble viva.
    const pair = pairOf(pt);
    const branches = dirsAt(pt) - 2;
    const isDoble =
      !!pair &&
      (branches >= 2 || taponAnchoredAt(pt) || taponAnchoredAt(pair.a) || taponAnchoredAt(pair.b));
    if (isDoble) yeeCounts[id].doble += 1;
    else yeeCounts[id].simple += 1;
  }

  const teeCounts: Record<string, number> = {};
  for (const id of teeRamalIds) {
    if (!teeCounts[id]) teeCounts[id] = 0;
    teeCounts[id]++;
  }

  // Limpieza del caso yee doble + tapón: la bandera y su tapón viven mientras ALGUNO de los
  // puntos de la yee siga siendo una unión yee viva. Si ambas uniones desaparecieron (se
  // borraron las piezas que las formaban), el caso ya no aplica — se retiran bandera y
  // tapones anclados en esos puntos; el reconteo de abajo actualiza hidroData (orig. usuario).
  // Puertos recién tapados por preserveYeeDobleAt (borrado del segmento medio del tronco de
  // la doble): la limpieza de banderas muertas NO debe retirar esos tapones en esta pasada —
  // la geometría L resultante es idéntica al desarme viejo y solo esta marca los distingue.
  // Se consume aquí (una sola pasada).
  const taponKeepPts = (engine as unknown as { _taponKeepPts?: number[][] })._taponKeepPts;
  const taponKept = (p: number[]): boolean =>
    (taponKeepPts || []).some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5);
  (engine as unknown as { _taponKeepPts?: number[][] })._taponKeepPts = undefined;
  for (const r of [...sanRamales]) {
    if (!r.yeeDobleAt || r.yeeDobleAt.length !== 2) continue;
    const [f1, f2] = r.yeeDobleAt;
    const isLive = (p: number[]) =>
      junctionPositions.some((jp) => Math.hypot(jp.x - p[0], jp.y - p[1]) < 0.5);
    if (isLive(f1) || isLive(f2)) continue;
    const near = (p: number[]) => (q: number[]) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5;
    const same = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
    const pairMatch = (a: number[][], b: number[][]) =>
      (same(a[0], b[0]) && same(a[1], b[1])) || (same(a[0], b[1]) && same(a[1], b[0]));
    for (const rr of sanRamales) {
      if (!rr.pts) continue;
      if (
        rr.accesorioInicio === 'tapon' &&
        (near(f1)(rr.pts[0]) || near(f2)(rr.pts[0])) &&
        !taponKept(rr.pts[0])
      )
        rr.accesorioInicio = '';
      if (
        rr.accesorioFin === 'tapon' &&
        rr.pts.length >= 2 &&
        (near(f1)(rr.pts[rr.pts.length - 1]) || near(f2)(rr.pts[rr.pts.length - 1])) &&
        !taponKept(rr.pts[rr.pts.length - 1])
      )
        rr.accesorioFin = '';
      if (rr.accMed) {
        for (const [k, v] of Object.entries(rr.accMed)) {
          if (v !== 'tapon') continue;
          const m = k.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          const p = rr.pts[idx];
          if (p && (near(f1)(p) || near(f2)(p)) && !taponKept(p)) delete rr.accMed[k];
        }
      }
      // Bandera con los mismos puntos (cualquier titular de la referencia/valores) → fuera.
      if (
        rr.yeeDobleAt &&
        (pairMatch(rr.yeeDobleAt, [f1, f2]) || pairMatch(rr.yeeDobleAt, [f2, f1]))
      )
        rr.yeeDobleAt = undefined;
    }
  }

  // Validación global de tapones (independiente de las banderas): un tapón solo cierra una
  // dirección libre de una unión viva (≥3 direcciones en el punto) o el extremo abierto de un
  // stub (1 dirección, el propio host). En un punto de 2 direcciones — esquina L (codo) o paso
  // recto — sobra: se retira (orig. usuario: al desarmar la yee en una L, el tapón viejo
  // seguía dibujado y contado).
  {
    const taponGoneAt: number[][] = [];
    // Tapón anclado en un punto de yee doble PERSISTIDA viva: es el cierre legítimo del
    // extremo abierto del caso doble (borrar el tronco-terminal deja la unión en 2 direcciones
    // con su lateral) — NO se retira aunque dirsAt dé 2 (orig. usuario: el tapón dejaba de
    // aparecer). El desarme viejo (banderas ya muertas) sí se retira → codo.
    const onPersistedYeePt = (p: number[]): boolean =>
      persistedYeePts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5);
    for (const rr of sanRamales) {
      if (!rr.pts || rr.pts.length < 2) continue;
      if (
        rr.accesorioInicio === 'tapon' &&
        dirsAt(rr.pts[0]) === 2 &&
        !onPersistedYeePt(rr.pts[0])
      ) {
        rr.accesorioInicio = '';
        taponGoneAt.push(rr.pts[0]);
      }
      const li = rr.pts.length - 1;
      if (
        rr.accesorioFin === 'tapon' &&
        dirsAt(rr.pts[li]) === 2 &&
        !onPersistedYeePt(rr.pts[li])
      ) {
        rr.accesorioFin = '';
        taponGoneAt.push(rr.pts[li]);
      }
      if (rr.accMed) {
        for (const [k, v] of Object.entries(rr.accMed)) {
          if (v !== 'tapon') continue;
          const m = k.match(/^accMed(\d+)$/);
          const idx = m ? parseInt(m[1], 10) : -1;
          const p = rr.pts[idx];
          if (p && dirsAt(p) === 2 && !onPersistedYeePt(p)) {
            delete rr.accMed[k];
            taponGoneAt.push(p);
          }
        }
      }
    }
    // Tapón retirado en una esquina L (2 direcciones NO colineales): la esquina queda sin
    // símbolo — el codo de plano lo sustituye. Sin esto, el tapón del caso yee bloqueó la
    // asignación del codo durante el desarme y la validación dejaba el punto vacío (orig.
    // usuario: desarmar la yee doble no dibujaba el codo 45). Para paso recto (colineal)
    // assignCodoAfterBranchDelete no hace nada por sí solo.
    for (const pt of taponGoneAt) assignCodoAfterBranchDelete(engine, pt);
  }

  for (const r of sanRamales) {
    let count45 = 0;
    let countVent = 0;

    if (r.pts && r.pts.length >= 3) {
      for (let i = 1; i < r.pts.length - 1; i++) {
        const p0 = r.pts[i - 1],
          p1 = r.pts[i],
          p2 = r.pts[i + 1];
        const ax = p1[0] - p0[0],
          ay = p1[1] - p0[1];
        const bx = p2[0] - p1[0],
          by = p2[1] - p1[1];
        const lenA = Math.hypot(ax, ay),
          lenB = Math.hypot(bx, by);
        if (lenA > 0 && lenB > 0) {
          const ux = -ax / lenA,
            uy = -ay / lenA;
          const vx = bx / lenB,
            vy = by / lenB;
          const cosAngle = ux * vx + uy * vy;
          // Item 5: 45° estricto. Tolerancia = ANGLE_EPS (0.5°) en espacio de coseno
          // (~0.006) — absorbe solo error de punto flotante, no dibujo libre. Antes
          // usaba 0.05 (~2.9°) que permitía 44°/46°; ahora solo admite 45° ± 0.5°.
          if (
            Math.abs(cosAngle + Math.cos(Math.PI / 4)) <
            1 - Math.cos(Math.PI / 4 + (ANGLE_EPS * Math.PI) / 180)
          ) {
            count45++;
          }
        }
      }
    }

    // Item 7: una unión vent↔san se clasifica por el ángulo de aproximación — en Y (≈45°) es una
    // yee con los diámetros de ambos ramales; perpendicular (≈90°) es un codo reventilado. Sin
    // esta distinción, toda conexión vent↔san contaba como codo reventilado, incluso cuando era
    // una Y.
    let countVentY = 0;
    if (r.pts && r.pts.length >= 2) {
      for (const v of ventRamales) {
        if (!v.pts || v.pts.length < 2) continue;
        const end1 = v.pts[0];
        const end2 = v.pts[v.pts.length - 1];
        let connected = false;
        let junctionSegDx = 0,
          junctionSegDy = 0;

        for (let i = 0; i < r.pts.length - 1; i++) {
          const [ax, ay] = r.pts[i];
          const [bx, by] = r.pts[i + 1];
          const sDx = bx - ax,
            sDy = by - ay;
          const sLenSq = sDx * sDx + sDy * sDy;
          if (sLenSq < 0.0001) continue;

          for (const end of [end1, end2]) {
            let t = ((end[0] - ax) * sDx + (end[1] - ay) * sDy) / sLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = ax + t * sDx,
              projY = ay + t * sDy;
            if (Math.hypot(end[0] - projX, end[1] - projY) < 0.5) {
              connected = true;
              junctionSegDx = sDx;
              junctionSegDy = sDy;
              break;
            }
          }
          if (connected) break;
        }

        if (connected) {
          // Dirección de aproximación del vent hacia la unión (desde el extremo lejano hacia el
          // extremo que toca al san).
          const vLen = Math.hypot(end2[0] - end1[0], end2[1] - end1[1]);
          const segLen = Math.hypot(junctionSegDx, junctionSegDy);
          if (vLen > 0.1 && segLen > 0.1) {
            const dot = Math.abs(
              (junctionSegDx / segLen) * ((end2[0] - end1[0]) / vLen) +
                (junctionSegDy / segLen) * ((end2[1] - end1[1]) / vLen),
            );
            // |cos| ≈ √2/2 → 45° (Y); |cos| ≈ 0 → 90° (codo reventilado).
            // Item 5: 45° estricto — tolerancia ANGLE_EPS (0.5°) en espacio de coseno.
            // Antes usaba 0.15 (~8.6°) que permitía 44°/46°; ahora solo admite 45° ± 0.5°.
            const cos45 = Math.cos(Math.PI / 4);
            const tol45 = Math.cos(((45 - ANGLE_EPS) * Math.PI) / 180) - cos45;
            if (Math.abs(dot - cos45) < tol45) {
              countVentY++;
            } else {
              countVent++;
            }
          } else {
            countVent++;
          }
        }
      }
    }

    let countSube = 0;
    let countBaja = 0;
    // ponytail: bajante connection does NOT auto-create a codo (render never draws it, orig #4).
    // Only persisted accesorio (aparato/montante) counts — removes the "extra codo 90".

    const rKey = `san_${r.id}_${planId}`;
    if (!hidroData[rKey]) hidroData[rKey] = { accesorios: {}, Lh: 0, nSalidas: 0 };
    if (!hidroData[rKey].accesorios) hidroData[rKey].accesorios = {};

    const acc = hidroData[rKey].accesorios;

    if (r.tipo === 'tributario') {
      let countSifonTrib = 0;
      // Reutiliza la detección geométrica vent→san de arriba (idéntica a la rama no-tributario
      // de abajo) en lugar de leer un accesorioInicio/Fin almacenado — los tributarios nunca
      // tuvieron ese campo autogenerado para este tipo de unión, así que confiar en él dejaba el
      // contador permanentemente en cero cuando el lado sanitario de un codo reventilado era un
      // tributario y no un ramal normal.
      const countVentTrib = countVent;
      let countSubeTrib = 0;
      let countBajaTrib = 0;
      let countVentTribExplicit = 0;

      const processAcc = (accType: string | undefined) => {
        if (accType === 'sifon') countSifonTrib++;
        else if (accType === 'codoSube' || accType === 'codo90rmSube') countSubeTrib++;
        else if (accType === 'codoBaja' || accType === 'codo90rmBaja') countBajaTrib++;
        else if (accType === 'codoReventilado') countVentTribExplicit++;
      };

      processAcc(r.accesorioInicio);
      processAcc(r.accesorioFin);
      // ponytail: cada sifón implica un codo 90° sube (mismo conteo que FixturesPanel bump).
      countSubeTrib += countSifonTrib;
      // Un codo reventilado puesto explícito en el extremo (p. ej. inodoro que cambia codo 90°
      // sube → codo reventilado) cuenta aunque no haya vent geométrico tocando — espejo de la
      // rama ramal (`if (countVent === 0)`): si ya hay detección geométrica, el explícito es la
      // misma unión y no se suma para no duplicar.
      const countVentTribTotal = countVentTrib > 0 ? countVentTrib : countVentTribExplicit;

      if (
        acc['sifon'] !== countSifonTrib ||
        acc['codoReventilado'] !== countVentTribTotal ||
        acc['codo90rmSube'] !== countSubeTrib ||
        acc['codo90rmBaja'] !== countBajaTrib
      ) {
        if (countSifonTrib > 0) acc['sifon'] = countSifonTrib;
        else delete acc['sifon'];
        if (countVentTribTotal > 0) acc['codoReventilado'] = countVentTribTotal;
        else delete acc['codoReventilado'];
        if (countSubeTrib > 0) acc['codo90rmSube'] = countSubeTrib;
        else delete acc['codo90rmSube'];
        if (countBajaTrib > 0) acc['codo90rmBaja'] = countBajaTrib;
        else delete acc['codo90rmBaja'];
        changed = true;
      }

      if ('codo45rc' in acc) {
        delete acc['codo45rc'];
        changed = true;
      }
      // Yees de uniones ENTRE tributarios (todos los brazos son T, p. ej. T1RS3+T3RS1+T2RS1):
      // el host del conteo cae en el primer tributario del punto — si este tributario ES host
      // de una yee, el recuento la conserva; si no, se limpia la clave (anti-duplicado de
      // siempre). Antes el borrado incondicional hacía desaparecer la yee del resumen
      // (orig. usuario: contaba 2 de 3 — la unión entre tributarios se perdía).
      const yeeOwn = yeeCounts[String(r.id)];
      if (yeeOwn?.simple) {
        if (acc['yeeSimple'] !== yeeOwn.simple) {
          acc['yeeSimple'] = yeeOwn.simple;
          changed = true;
        }
      } else if ('yeeSimple' in acc) {
        delete acc['yeeSimple'];
        changed = true;
      }
      if (yeeOwn?.doble) {
        if (acc['yeeDoble'] !== yeeOwn.doble) {
          acc['yeeDoble'] = yeeOwn.doble;
          changed = true;
        }
      } else if ('yeeDoble' in acc) {
        delete acc['yeeDoble'];
        changed = true;
      }
      if ('tee' in acc) {
        delete acc['tee'];
        changed = true;
      }
    } else {
      // Cuenta sifones desde los accesorios extremos del ramal
      let countSifonRamal = 0;
      if (r.accesorioInicio === 'sifon') countSifonRamal++;
      if (r.accesorioFin === 'sifon') countSifonRamal++;
      // Cuenta accesorios explícitos a mitad de ramal (accMed*, asignados con clic derecho sobre
      // el cuerpo del ramal). codoReventilado se excluye deliberadamente — ya se contó arriba
      // mediante la detección geométrica vent→san (countVent), y los accesorios a mitad de ramal
      // ya no se pueden asignar manualmente en cuerpos san, así que cualquier codoReventilado en
      // accMed es esa misma unión autodetectada; contarlo aquí de nuevo lo duplicaría.
      if (r.accMed) {
        for (const val of Object.values(r.accMed)) {
          if (val === 'sifon') countSifonRamal++;
          else if (val === 'codo90rmSube') countSube++;
          else if (val === 'codo90rmBaja') countBaja++;
        }
      }

      // Cuenta accesorios de extremo colocados directamente (clic derecho) — codo 90° sube/baja y
      // codo reventilado. Sin gating por bajante: el bajante no auto-crea codo, así que todo codo
      // persistido (aparato o montante) se cuenta una sola vez.
      if (r.accesorioInicio === 'codo90rmSube' || r.accesorioInicio === 'codoSube') countSube++;
      if (r.accesorioFin === 'codo90rmSube' || r.accesorioFin === 'codoSube') countSube++;
      if (r.accesorioInicio === 'codo90rmBaja' || r.accesorioInicio === 'codoBaja') countBaja++;
      if (r.accesorioFin === 'codo90rmBaja' || r.accesorioFin === 'codoBaja') countBaja++;
      // ponytail: cada sifón implica un codo 90° sube (mismo conteo que FixturesPanel bump).
      countSube += countSifonRamal;
      if (countVent === 0) {
        if (r.accesorioInicio === 'codoReventilado') countVent++;
        if (r.accesorioFin === 'codoReventilado') countVent++;
      }

      if (acc['sifon'] !== (countSifonRamal || undefined)) {
        if (countSifonRamal > 0) acc['sifon'] = countSifonRamal;
        else delete acc['sifon'];
        changed = true;
      }
      // Tapón: reconteo desde el dibujo (extremos + accMed) — igual que sifón. Así el conteo
      // se repara solo cuando el caso yee doble desaparece y la limpieza de arriba retira los
      // tapones huérfanos (orig. usuario: el tapón quedaba contado para siempre).
      let countTapon = 0;
      if (r.accesorioInicio === 'tapon') countTapon++;
      if (r.accesorioFin === 'tapon') countTapon++;
      if (r.accMed) {
        for (const val of Object.values(r.accMed)) if (val === 'tapon') countTapon++;
      }
      if (acc['tapon'] !== (countTapon || undefined)) {
        if (countTapon > 0) acc['tapon'] = countTapon;
        else delete acc['tapon'];
        changed = true;
      }
      if (
        acc['codo45rc'] !== count45 ||
        acc['codoReventilado'] !== countVent ||
        acc['codo90rmSube'] !== countSube ||
        acc['codo90rmBaja'] !== countBaja
      ) {
        if (count45 > 0) acc['codo45rc'] = count45;
        else delete acc['codo45rc'];
        if (countVent > 0) acc['codoReventilado'] = countVent;
        else delete acc['codoReventilado'];
        if (countSube > 0) acc['codo90rmSube'] = countSube;
        else delete acc['codo90rmSube'];
        if (countBaja > 0) acc['codo90rmBaja'] = countBaja;
        else delete acc['codo90rmBaja'];
        changed = true;
      }

      const yee = yeeCounts[String(r.id)];
      const yeeSimpleTotal = (yee ? yee.simple : 0) + countVentY;
      if (yee || countVentY > 0) {
        if (yeeSimpleTotal > 0) {
          if (acc['yeeSimple'] !== yeeSimpleTotal) {
            acc['yeeSimple'] = yeeSimpleTotal;
            changed = true;
          }
        } else if ('yeeSimple' in acc) {
          // La unión pasó a doble (bandera persistida): la clave simple a 0 se elimina.
          delete acc['yeeSimple'];
          changed = true;
        }
        // yeeDoble PROPIETARIO: se escribe el conteo real (pares geométricos + dobles con 4
        // direcciones o lateral tapiado) y se ELIMINA cuando ya no queda ninguna. Antes se
        // conservaba a propósito y doble→simple nunca se reflejaba en el conteo (orig. usuario).
        const dobleTotal = yee ? yee.doble : 0;
        if (dobleTotal > 0) {
          if (acc['yeeDoble'] !== dobleTotal) {
            acc['yeeDoble'] = dobleTotal;
            changed = true;
          }
        } else if ('yeeDoble' in acc) {
          delete acc['yeeDoble'];
          changed = true;
        }
      } else {
        if ('yeeSimple' in acc) {
          delete acc['yeeSimple'];
          changed = true;
        }
        if ('yeeDoble' in acc) {
          delete acc['yeeDoble'];
          changed = true;
        }
      }

      const tee = teeCounts[String(r.id)] || 0;
      if (acc['tee'] !== tee) {
        if (tee > 0) acc['tee'] = tee;
        else delete acc['tee'];
        changed = true;
      }
    }

    // Pase genérico de propiedad: TODO accesorio manual del dibujo (extremos + accMed) sin
    // recuento geométrico propio se cuenta directo desde los campos y se BORRA del storage
    // cuando el dibujo ya no lo tiene. Antes los conteos solo se sumaban (modal/bump) y un
    // accesorio quitado (split, heal, borrado) quedaba contado para siempre (orig. usuario:
    // conteos que no bajan). Las claves con recuento geométrico propio quedan excluidas.
    const OWNED_ACC = new Set([
      'sifon',
      'tapon',
      'codo45rc',
      'codoReventilado',
      'codo90rmSube',
      'codo90rmBaja',
      'tee',
      'yeeSimple',
      'yeeDoble',
    ]);
    const aliasAccId = (a: string) =>
      a === 'codoSube' ? 'codo90rmSube' : a === 'codoBaja' ? 'codo90rmBaja' : a;
    const drawn: Record<string, number> = {};
    for (const a of [r.accesorioInicio, r.accesorioFin]) {
      if (!a) continue;
      const id = aliasAccId(a);
      if (!OWNED_ACC.has(id)) drawn[id] = (drawn[id] || 0) + 1;
    }
    if (r.accMed) {
      for (const val of Object.values(r.accMed)) {
        if (!val) continue;
        const id = aliasAccId(val);
        if (!OWNED_ACC.has(id)) drawn[id] = (drawn[id] || 0) + 1;
      }
    }
    const accKeys = new Set([...Object.keys(acc), ...Object.keys(drawn)]);
    for (const k of accKeys) {
      if (OWNED_ACC.has(k)) continue;
      const d = drawn[k] || 0;
      if ((acc[k] || 0) !== d) {
        if (d > 0) acc[k] = d;
        else delete acc[k];
        changed = true;
      }
    }
  }

  if (changed) {
    saveToStorage(storageKey, hidroData);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      /* ignorar */
    }
  }
}

/**
 * Cuenta los accesorios a mitad de ramal y de extremo en las redes de agua (AF, AC, LL) y
 * los escribe en el storage de hidráulica para que la tabla "Accesorios por ramal" se
 * complete correctamente. Generaliza el conteo sanitario para aceptar cualquier accesorio.
 */
export function calcHydroAccessories(engine: IPlanoEngineCore): void {
  const planId = engine._loadedPlanId;
  if (!planId) return;

  // Recuento genérico de accMed/accesorios de extremo — aplica a todas las redes menos 'san',
  // que tiene su propia detección de uniones basada en ángulos en calcSanitaryAccessories (arriba).
  const HYDRO_NETS = ['af', 'ac', 'll', 'vent', 'gas', 'recolectora', 'rci', 'rec', 'bom'];
  const ramales = engine.ramales.filter((r) => HYDRO_NETS.includes(r.net));
  if (ramales.length === 0) return;

  const storageKey = 'tramo_hidro_data_v3';
  let hidroData: Record<string, HidroTramoEntry>;
  try {
    hidroData = loadFromStorage(storageKey, {}) as Record<string, HidroTramoEntry>;
  } catch {
    hidroData = {};
  }

  let changed = false;

  for (const r of ramales) {
    const rKey = `${r.net}_${r.id}_${planId}`;
    if (!hidroData[rKey]) hidroData[rKey] = { accesorios: {}, Lh: 0, nSalidas: 0 };
    if (!hidroData[rKey].accesorios) hidroData[rKey].accesorios = {};
    const acc = hidroData[rKey].accesorios;

    const TEE_LADO_ALIAS = new Set(['teeTapon', 'teeLlaveTerminal', 'teeSube', 'teeBaja']);
    const counts: Record<string, number> = {};
    const bump = (acc: string | undefined) => {
      if (!acc) return;
      counts[acc] = (counts[acc] || 0) + 1;
      if (TEE_LADO_ALIAS.has(acc)) counts['teeLado'] = (counts['teeLado'] || 0) + 1;
    };
    bump(r.accesorioInicio);
    bump(r.accesorioFin);
    if (r.accMed) {
      for (const val of Object.values(r.accMed)) {
        if (!val) continue;
        bump(val);
      }
    }

    // Las bajantes de LL (aguas lluvias) funcionan igual que las de SAN — un codo90rmSube/Baja
    // se infiere según la dirección a la que esté PUESTA actualmente la bajante conectada,
    // recalculado de nuevo cada vez (como hace calcSanitaryAccessories con SAN) en lugar de un
    // único escrito que queda obsoleto si la dirección cambia después. El equivalente de montante
    // en AF/AC en cambio vuelve a sincronizar un valor escrito de accesorioInicio/Fin al cambiar
    // la dirección (BajanteDirectionSelector de bajanteMenu.tsx), ya que el codo de
    // un montante vive en un campo de glifo visual ya existente — las bajantes de LL no tienen ese
    // escrito en absoluto, así que no hay nada que sincronizar; se calcula aquí en su lugar.
    if (r.net === 'll') {
      for (const baj of engine.bajantes) {
        if (baj.net !== 'll' || baj.tipo !== 'bajante') continue;
        if (!baj.recibeDeIds?.includes(r.id)) continue;
        const codoId =
          baj.direccion === 'sube'
            ? 'codo90rmSube'
            : baj.direccion === 'baja'
              ? 'codo90rmBaja'
              : null;
        if (codoId) counts[codoId] = (counts[codoId] || 0) + 1;
      }
    }

    // Item 8: en AF/AC, un aparato (distinto de nevera) en un extremo implica un codo 90° sube
    // implícito — se dibuja junto al aparato y se cuenta como accesorio. La nevera queda
    // excluida porque su acometida no sube.
    if (r.net === 'af' || r.net === 'ac') {
      for (const app of [r.aparatoInicio, r.aparatoFin]) {
        if (app && app !== 'nev') {
          counts['codo90rmSube'] = (counts['codo90rmSube'] || 0) + 1;
        }
      }
    }

    const customKeys = new Set(Object.keys(counts));
    const storedKeys = new Set(Object.keys(acc));
    const allKeys = new Set([...customKeys, ...storedKeys]);
    for (const k of allKeys) {
      const desired = counts[k] || 0;
      const current = acc[k] || 0;
      if (desired !== current) {
        if (desired > 0) acc[k] = desired;
        else delete acc[k];
        changed = true;
      }
    }
  }

  if (changed) {
    saveToStorage(storageKey, hidroData);
    try {
      window.dispatchEvent(new Event('storage'));
    } catch {
      /* ignorar */
    }
  }
}
