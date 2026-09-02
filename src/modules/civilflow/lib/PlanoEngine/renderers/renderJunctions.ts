import { NETS } from '../PlanoState';
import type { IPlanoEngineCore } from '../PlanoState';

function renderJunctions(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const DOUBLE_YEE_THRESHOLD_MM = 10;

  // Ventilación es parte de la red sanitaria: un tubo de ventilación que se conecta a una línea
  // san debe dibujar el mismo símbolo de tee/yee que cualquier unión san-san, no un codo
  // especial. Para lograrlo, se procesan juntas (comparten vértices) y cada otra red se procesa
  // por separado.
  const processed = new Set<string>();
  NETS.forEach((net) => {
    if (processed.has(net.id)) return;
    const group = net.id === 'san' || net.id === 'vent' ? ['san', 'vent'] : [net.id];
    group.forEach((g) => processed.add(g));
    const netRamales = engine.ramales.filter(
      (r) => group.includes(r.net) && !engine._hiddenNets.has(r.net),
    );
    if (netRamales.length === 0) return;

    const getPointKey = (x: number, y: number) => `${x.toFixed(3)}_${y.toFixed(3)}`;
    const vertexMap = new Map<string, number[]>();

    // AF/AC: un vértice con un tipo de tee específico ya asignado (teeReduccion/teeLado/teeSube/
    // teeBaja/teeTapon/teeLlaveTerminal, elegido a mano o auto-asignado) dibuja SU PROPIO glifo en
    // renderRamales.ts — dibujar aquí también el tick geométrico genérico de tee lo duplicaría
    // encima. Solo se salta el genérico cuando el punto YA tiene uno de esos tipos asignado; una
    // tee plana sin accesorio (teeDirecto, el caso común) no tiene ningún otro renderer que la
    // dibuje, así que sí debe pasar por aquí — antes se excluía TODO af/ac sin distinguir, dejando
    // la tee plana sin ningún símbolo.
    const TEE_MARKER_IDS = new Set([
      'teeReduccion',
      'teeLado',
      'teeSube',
      'teeBaja',
      'teeTapon',
      'teeLlaveTerminal',
    ]);
    const hasTeeMarkerAt = (P: number[]): boolean => {
      const TOL = 0.5;
      for (const r of netRamales) {
        if (!r.pts || r.pts.length < 2) continue;
        if (
          r.accesorioInicio &&
          TEE_MARKER_IDS.has(r.accesorioInicio) &&
          Math.hypot(r.pts[0][0] - P[0], r.pts[0][1] - P[1]) < TOL
        )
          return true;
        const last = r.pts[r.pts.length - 1];
        if (
          r.accesorioFin &&
          TEE_MARKER_IDS.has(r.accesorioFin) &&
          Math.hypot(last[0] - P[0], last[1] - P[1]) < TOL
        )
          return true;
        if (r.accMed) {
          for (const [key, val] of Object.entries(r.accMed)) {
            if (!val || !TEE_MARKER_IDS.has(val)) continue;
            const m = key.match(/^accMed(\d+)$/);
            if (!m) continue;
            const p = r.pts[parseInt(m[1], 10)];
            if (p && Math.hypot(p[0] - P[0], p[1] - P[1]) < TOL) return true;
          }
        }
      }
      return false;
    };

    // Cuando 2+ ramales se juntan ENCIMA de un bajante, es el bajante el que recoge todo — no es
    // una unión entre tubos y no debe dibujarse ningún símbolo de tee/yee ahí (saldría encima del
    // círculo del bajante, confundiendo la lectura del plano).
    const lvl = engine.nivelActual?.label ?? '';
    const fantasmaIds = new Set(engine.getBajantesFantasma().map((b) => b.id));
    const bajantePts: number[][] = [];
    engine.bajantes.forEach((b) => {
      if (!group.includes(b.net) || engine._hiddenNets.has(b.net)) return;
      if (fantasmaIds.has(b.id)) {
        const disp = b.desplazamientos?.[lvl];
        bajantePts.push([b.x + (disp?.dx || 0), b.y + (disp?.dy || 0)]);
      } else if (b.pisoBase === lvl) {
        bajantePts.push([b.x, b.y]);
      }
    });
    const nearBajante = (x: number, y: number) =>
      bajantePts.some(([bx, by]) => Math.hypot(bx - x, by - y) < 0.5);

    netRamales.forEach((r) => {
      r.pts.forEach((pt: number[]) => {
        if (nearBajante(pt[0], pt[1])) return;
        vertexMap.set(getPointKey(pt[0], pt[1]), pt);
      });
    });

    interface JunctionData {
      P: number[];
      uA: { x: number; y: number };
      uB: { x: number; y: number };
      branches: { x: number; y: number }[];
      isTee: boolean;
      isYee: boolean;
    }

    const junctions: JunctionData[] = [];

    vertexMap.forEach((P) => {
      const outgoingVectors: { x: number; y: number }[] = [];

      netRamales.forEach((r) => {
        let isVertex = false;
        for (let i = 0; i < r.pts.length; i++) {
          if (Math.hypot(r.pts[i][0] - P[0], r.pts[i][1] - P[1]) < 0.5) {
            isVertex = true;
            if (i > 0) {
              const prev = r.pts[i - 1];
              const dx = prev[0] - P[0],
                dy = prev[1] - P[1];
              const len = Math.hypot(dx, dy);
              if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
            }
            if (i < r.pts.length - 1) {
              const next = r.pts[i + 1];
              const dx = next[0] - P[0],
                dy = next[1] - P[1];
              const len = Math.hypot(dx, dy);
              if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
            }
          }
        }

        if (!isVertex) {
          for (let i = 0; i < r.pts.length - 1; i++) {
            const A = r.pts[i];
            const B = r.pts[i + 1];
            const dx = B[0] - A[0],
              dy = B[1] - A[1];
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0.001) {
              let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq;
              t = Math.max(0, Math.min(1, t));
              const projX = A[0] + t * dx;
              const projY = A[1] + t * dy;
              const dist = Math.hypot(P[0] - projX, P[1] - projY);

              const lenA = Math.hypot(A[0] - P[0], A[1] - P[1]);
              const lenB = Math.hypot(B[0] - P[0], B[1] - P[1]);

              if (dist < 0.5 && lenA > 0.5 && lenB > 0.5) {
                outgoingVectors.push({ x: (A[0] - P[0]) / lenA, y: (A[1] - P[1]) / lenA });
                outgoingVectors.push({ x: (B[0] - P[0]) / lenB, y: (B[1] - P[1]) / lenB });
              }
            }
          }
        }
      });

      const uniqueVectors: { x: number; y: number }[] = [];
      outgoingVectors.forEach((v) => {
        const isDup = uniqueVectors.some((uv) => {
          const dot = uv.x * v.x + uv.y * v.y;
          return dot > 0.99;
        });
        if (!isDup) uniqueVectors.push(v);
      });

      if (uniqueVectors.length >= 3 && uniqueVectors.length <= 4) {
        let bestPair = { i: -1, j: -1, dot: 1 };
        for (let i = 0; i < uniqueVectors.length; i++) {
          for (let j = i + 1; j < uniqueVectors.length; j++) {
            const dot =
              uniqueVectors[i].x * uniqueVectors[j].x + uniqueVectors[i].y * uniqueVectors[j].y;
            if (dot < bestPair.dot) {
              bestPair = { i, j, dot };
            }
          }
        }

        if (bestPair.dot < -0.9) {
          const uA = uniqueVectors[bestPair.i];
          const uB = uniqueVectors[bestPair.j];

          const branches: { x: number; y: number }[] = [];
          for (let k = 0; k < uniqueVectors.length; k++) {
            if (k !== bestPair.i && k !== bestPair.j) {
              branches.push(uniqueVectors[k]);
            }
          }

          const cosVal = branches[0].x * uB.x + branches[0].y * uB.y;
          const isTee = Math.abs(cosVal) < 0.15;
          // En agua fría y caliente no existen las "yees" (uniones en Y a 45°) — solo tees de 90°.
          // Un ángulo de 45° ni siquiera debería poder dibujarse (lo bloquean los chequeos de
          // ángulo), pero por si acaso queda algún dato viejo de antes de esa restricción, se
          // prefiere no dibujar nada a dibujar una Y que no corresponde a esta red.
          const isAfAc = group.includes('af') || group.includes('ac');
          const isYee = !isAfAc && Math.abs(cosVal) >= 0.4 && Math.abs(cosVal) <= 0.85;

          // AF/AC con un tipo de tee específico ya asignado en este punto (teeReduccion/teeLado/
          // teeSube/teeBaja/etc.) se salta el tick genérico — ese caso ya tiene su propio glifo
          // en renderRamales.ts. Una tee af/ac SIN accesorio asignado (teeDirecto, el caso común
          // al conectar dos ramales) sí pasa, para no quedarse sin ningún símbolo.
          if ((isTee && (!isAfAc || !hasTeeMarkerAt(P))) || isYee) {
            junctions.push({ P, uA, uB, branches, isTee, isYee });
          }
        }
      }
    });

    const usedInDouble = new Set<number>();

    for (let i = 0; i < junctions.length; i++) {
      for (let j = i + 1; j < junctions.length; j++) {
        if (usedInDouble.has(i) || usedInDouble.has(j)) continue;
        const a = junctions[i],
          b = junctions[j];
        const distMm = Math.hypot(a.P[0] - b.P[0], a.P[1] - b.P[1]);
        if (distMm > DOUBLE_YEE_THRESHOLD_MM) continue;

        const auA = a.uA,
          buA = b.uA,
          buB = b.uB;
        const dotMain = auA.x * buA.x + auA.y * buA.y;
        const dotMain2 = auA.x * buB.x + auA.y * buB.y;
        const aligned =
          Math.abs(Math.abs(dotMain) - 1) < 0.15 || Math.abs(Math.abs(dotMain2) - 1) < 0.15;
        if (!aligned) continue;

        usedInDouble.add(i);
        usedInDouble.add(j);

        const cvsA = engine.toCvs(a.P[0], a.P[1]);
        const cvsB = engine.toCvs(b.P[0], b.P[1]);
        const rad = engine.mm2cvs(2.0);
        const tickLen = engine.mm2cvs(1.0);

        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.2 * engine.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        const vectorsA = [];
        const vecAB = { x: b.P[0] - a.P[0], y: b.P[1] - a.P[1] };
        const dotAa = a.uA.x * vecAB.x + a.uA.y * vecAB.y;
        if (dotAa <= 0) vectorsA.push(a.uA);
        else vectorsA.push(a.uB);
        a.branches.forEach((uC) => vectorsA.push(uC));

        const vectorsB = [];
        const vecBA = { x: a.P[0] - b.P[0], y: a.P[1] - b.P[1] };
        const dotBa = b.uA.x * vecBA.x + b.uA.y * vecBA.y;
        if (dotBa <= 0) vectorsB.push(b.uA);
        else vectorsB.push(b.uB);
        b.branches.forEach((uC) => vectorsB.push(uC));

        ctx.beginPath();
        if (vectorsA.length > 0) {
          ctx.moveTo(cvsA.x + rad * vectorsA[0].x, cvsA.y + rad * vectorsA[0].y);
          for (let i = 1; i < vectorsA.length; i++) {
            ctx.lineTo(cvsA.x, cvsA.y);
            ctx.lineTo(cvsA.x + rad * vectorsA[i].x, cvsA.y + rad * vectorsA[i].y);
          }
          ctx.lineTo(cvsA.x, cvsA.y);
        } else {
          ctx.moveTo(cvsA.x, cvsA.y);
        }

        ctx.lineTo(cvsB.x, cvsB.y);

        if (vectorsB.length > 0) {
          ctx.lineTo(cvsB.x + rad * vectorsB[0].x, cvsB.y + rad * vectorsB[0].y);
          for (let i = 1; i < vectorsB.length; i++) {
            ctx.lineTo(cvsB.x, cvsB.y);
            ctx.lineTo(cvsB.x + rad * vectorsB[i].x, cvsB.y + rad * vectorsB[i].y);
          }
        }

        // White halo: masks the pipe under the junction so the black symbol reads clean.
        ctx.lineWidth = 1.8 * engine.zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.lineWidth = 1.2 * engine.zoom;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        // N5: trazos transversales ligeramente más gruesos, extremos cuadrados (butt→square), llegan a extremos
        const tickW = 1 * engine.zoom;
        ctx.lineCap = 'square';
        ctx.lineWidth = tickW;
        ctx.beginPath();
        vectorsA.forEach((u) => {
          const T_pt = { x: cvsA.x + rad * u.x, y: cvsA.y + rad * u.y };
          const perp = { x: -u.y, y: u.x };
          ctx.moveTo(T_pt.x - (perp.x * tickLen) / 2, T_pt.y - (perp.y * tickLen) / 2);
          ctx.lineTo(T_pt.x + (perp.x * tickLen) / 2, T_pt.y + (perp.y * tickLen) / 2);
        });
        vectorsB.forEach((u) => {
          const T_pt = { x: cvsB.x + rad * u.x, y: cvsB.y + rad * u.y };
          const perp = { x: -u.y, y: u.x };
          ctx.moveTo(T_pt.x - (perp.x * tickLen) / 2, T_pt.y - (perp.y * tickLen) / 2);
          ctx.lineTo(T_pt.x + (perp.x * tickLen) / 2, T_pt.y + (perp.y * tickLen) / 2);
        });
        ctx.stroke();

        ctx.restore();
      }
    }

    for (let i = 0; i < junctions.length; i++) {
      if (usedInDouble.has(i)) continue;
      const j = junctions[i];

      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2 * engine.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      const rad = engine.mm2cvs(2.0);
      const cvsP = engine.toCvs(j.P[0], j.P[1]);

      const vectors = [j.uA, j.uB, ...j.branches];
      ctx.beginPath();
      if (vectors.length > 0) {
        ctx.moveTo(cvsP.x + rad * vectors[0].x, cvsP.y + rad * vectors[0].y);
        for (let i = 1; i < vectors.length; i++) {
          ctx.lineTo(cvsP.x, cvsP.y);
          ctx.lineTo(cvsP.x + rad * vectors[i].x, cvsP.y + rad * vectors[i].y);
        }
      }

      // White halo: masks the pipe under the junction so the black symbol reads clean.
      ctx.lineWidth = 1.8 * engine.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.lineWidth = 1.2 * engine.zoom;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      // N5: trazos transversales más gruesos, extremo cuadrado, llegan a extremos
      const tickW = 1 * engine.zoom;
      const tickL = engine.mm2cvs(1.0);
      ctx.lineCap = 'square';
      ctx.lineWidth = tickW;
      ctx.beginPath();
      vectors.forEach((u) => {
        const T_pt = { x: cvsP.x + rad * u.x, y: cvsP.y + rad * u.y };
        const perp = { x: -u.y, y: u.x };
        ctx.moveTo(T_pt.x - (perp.x * tickL) / 2, T_pt.y - (perp.y * tickL) / 2);
        ctx.lineTo(T_pt.x + (perp.x * tickL) / 2, T_pt.y + (perp.y * tickL) / 2);
      });
      ctx.stroke();

      ctx.restore();
    }

    // Ítem 2: yee doble PERSISTIDA (yeeDobleAt). La detección geométrica de arriba dibuja el par
    // solo cuando AMBAS uniones tienen 3+ vectores (tronco + brazo lateral en cada vértice). Al
    // borrar uno de los brazos laterales, un vértice baja a 2 vectores (solo el tronco pasante) y
    // deja de ser "junction", por lo que el par no se forma y el símbolo desaparecía. Con la
    // identidad persistida en el ramal, se dibuja el glifo igual: los dos puntos del par + ticks
    // por brazo, mientras el tronco siga pasando por ambos.
    const drawnPairs = new Set<string>();
    for (let i = 0; i < junctions.length; i++) {
      if (!usedInDouble.has(i)) continue;
      for (let j = i + 1; j < junctions.length; j++) {
        if (!usedInDouble.has(j)) continue;
        const d = Math.hypot(
          junctions[i].P[0] - junctions[j].P[0],
          junctions[i].P[1] - junctions[j].P[1],
        );
        if (d <= DOUBLE_YEE_THRESHOLD_MM) {
          const [a, b] = [junctions[i].P, junctions[j].P];
          drawnPairs.add(
            `${a[0].toFixed(2)}_${a[1].toFixed(2)}_${b[0].toFixed(2)}_${b[1].toFixed(2)}`,
          );
          drawnPairs.add(
            `${b[0].toFixed(2)}_${b[1].toFixed(2)}_${a[0].toFixed(2)}_${a[1].toFixed(2)}`,
          );
        }
      }
    }
    const vecsAt = (P: number[]): { x: number; y: number }[] => {
      const out: { x: number; y: number }[] = [];
      for (const r of netRamales) {
        if (!r.pts || r.pts.length < 2) continue;
        let isVertex = false;
        for (let i = 0; i < r.pts.length; i++) {
          if (Math.hypot(r.pts[i][0] - P[0], r.pts[i][1] - P[1]) < 0.5) {
            isVertex = true;
            if (i > 0) {
              const px = r.pts[i - 1][0] - P[0],
                py = r.pts[i - 1][1] - P[1];
              const l = Math.hypot(px, py);
              if (l > 0.1) out.push({ x: px / l, y: py / l });
            }
            if (i < r.pts.length - 1) {
              const nx = r.pts[i + 1][0] - P[0],
                ny = r.pts[i + 1][1] - P[1];
              const l = Math.hypot(nx, ny);
              if (l > 0.1) out.push({ x: nx / l, y: ny / l });
            }
          }
        }
        if (!isVertex) {
          for (let i = 0; i < r.pts.length - 1; i++) {
            const A = r.pts[i],
              B = r.pts[i + 1];
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
                out.push({ x: (A[0] - P[0]) / lenA, y: (A[1] - P[1]) / lenA });
                out.push({ x: (B[0] - P[0]) / lenB, y: (B[1] - P[1]) / lenB });
              }
            }
          }
        }
      }
      const uniq: { x: number; y: number }[] = [];
      for (const v of out) {
        if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
      }
      return uniq;
    };
    const rad = engine.mm2cvs(2.0);
    const tickLen = engine.mm2cvs(1.0);
    for (const r of netRamales) {
      if (!r.yeeDobleAt || r.yeeDobleAt.length !== 2) continue;
      const [A, B] = r.yeeDobleAt;
      const key = `${A[0].toFixed(2)}_${A[1].toFixed(2)}_${B[0].toFixed(2)}_${B[1].toFixed(2)}`;
      if (drawnPairs.has(key)) continue;
      let vA = vecsAt(A);
      let vB = vecsAt(B);
      // Persistencia pedida: el símbolo debe mantenerse aunque un ramal del brazo principal
      // se borre. Si el tronco ya no pasa por el punto, vA/vB puede quedar con 1 solo vector
      // (la rama lateral) o vacío. Se sintetiza la dirección del tronco a partir del par
      // A<->B y se asegura que esté presente para que el glifo siga dibujándose.
      const trunkAx = B[0] - A[0];
      const trunkAy = B[1] - A[1];
      const trunkLen = Math.hypot(trunkAx, trunkAy) || 1;
      const trunkDirA = { x: trunkAx / trunkLen, y: trunkAy / trunkLen };
      const trunkDirB = { x: -trunkAx / trunkLen, y: -trunkAy / trunkLen };
      const hasTrunkA = vA.some((u) => Math.abs(u.x * trunkDirA.x + u.y * trunkDirA.y) > 0.85);
      const hasTrunkB = vB.some((u) => Math.abs(u.x * trunkDirB.x + u.y * trunkDirB.y) > 0.85);
      if (!hasTrunkA) vA = [...vA, trunkDirA];
      if (!hasTrunkB) vB = [...vB, trunkDirB];
      if (vA.length === 0 || vB.length === 0) continue;
      const cvsA = engine.toCvs(A[0], A[1]);
      const cvsB = engine.toCvs(B[0], B[1]);
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2 * engine.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cvsA.x + rad * vA[0].x, cvsA.y + rad * vA[0].y);
      for (let k = 1; k < vA.length; k++) {
        ctx.lineTo(cvsA.x, cvsA.y);
        ctx.lineTo(cvsA.x + rad * vA[k].x, cvsA.y + rad * vA[k].y);
      }
      ctx.lineTo(cvsA.x, cvsA.y);
      ctx.lineTo(cvsB.x, cvsB.y);
      if (vB.length > 0) {
        ctx.lineTo(cvsB.x + rad * vB[0].x, cvsB.y + rad * vB[0].y);
        for (let k = 1; k < vB.length; k++) {
          ctx.lineTo(cvsB.x, cvsB.y);
          ctx.lineTo(cvsB.x + rad * vB[k].x, cvsB.y + rad * vB[k].y);
        }
      }
      // White halo: masks the pipe under the junction so the black symbol reads clean.
      ctx.lineWidth = 1.8 * engine.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.lineWidth = 1.2 * engine.zoom;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      ctx.lineCap = 'square';
      ctx.lineWidth = 1 * engine.zoom;
      ctx.beginPath();
      for (const [P, vArr] of [
        [A, vA],
        [B, vB],
      ] as const) {
        const cP = engine.toCvs(P[0], P[1]);
        vArr.forEach((u) => {
          const T_pt = { x: cP.x + rad * u.x, y: cP.y + rad * u.y };
          const perp = { x: -u.y, y: u.x };
          ctx.moveTo(T_pt.x - (perp.x * tickLen) / 2, T_pt.y - (perp.y * tickLen) / 2);
          ctx.lineTo(T_pt.x + (perp.x * tickLen) / 2, T_pt.y + (perp.y * tickLen) / 2);
        });
      }
      ctx.stroke();
      ctx.restore();
    }
  });
}

export { renderJunctions };
