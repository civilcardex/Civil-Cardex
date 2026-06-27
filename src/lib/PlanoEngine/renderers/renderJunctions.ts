import { NETS } from '../PlanoState';
import type { IPlanoEngineCore } from '../PlanoEngineTypes';

function renderJunctions(ctx: CanvasRenderingContext2D, engine: IPlanoEngineCore): void {
  const DOUBLE_YEE_THRESHOLD_MM = 10;

  NETS.forEach(net => {
    if (engine._hiddenNets.has(net.id)) return;
    const netRamales = engine.ramales.filter((r: any) => r.net === net.id);
    if (netRamales.length === 0) return;

    const getPointKey = (x: number, y: number) => `${x.toFixed(3)}_${y.toFixed(3)}`;
    const vertexMap = new Map<string, number[]>();

    netRamales.forEach(r => {
      r.pts.forEach((pt: number[]) => {
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

      netRamales.forEach(r => {
        let isVertex = false;
        for (let i = 0; i < r.pts.length; i++) {
          if (Math.hypot(r.pts[i][0] - P[0], r.pts[i][1] - P[1]) < 0.5) {
            isVertex = true;
            if (i > 0) {
              const prev = r.pts[i - 1];
              const dx = prev[0] - P[0], dy = prev[1] - P[1];
              const len = Math.hypot(dx, dy);
              if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
            }
            if (i < r.pts.length - 1) {
              const next = r.pts[i + 1];
              const dx = next[0] - P[0], dy = next[1] - P[1];
              const len = Math.hypot(dx, dy);
              if (len > 0.1) outgoingVectors.push({ x: dx / len, y: dy / len });
            }
          }
        }

        if (!isVertex) {
          for (let i = 0; i < r.pts.length - 1; i++) {
            const A = r.pts[i];
            const B = r.pts[i + 1];
            const dx = B[0] - A[0], dy = B[1] - A[1];
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
      outgoingVectors.forEach(v => {
        const isDup = uniqueVectors.some(uv => {
          const dot = uv.x * v.x + uv.y * v.y;
          return dot > 0.99;
        });
        if (!isDup) uniqueVectors.push(v);
      });

      if (uniqueVectors.length >= 3 && uniqueVectors.length <= 4) {
        let bestPair = { i: -1, j: -1, dot: 1 };
        for (let i = 0; i < uniqueVectors.length; i++) {
          for (let j = i + 1; j < uniqueVectors.length; j++) {
            const dot = uniqueVectors[i].x * uniqueVectors[j].x + uniqueVectors[i].y * uniqueVectors[j].y;
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
          const isYee = Math.abs(cosVal) >= 0.4 && Math.abs(cosVal) <= 0.85;

          if (isTee || isYee) {
            junctions.push({ P, uA, uB, branches, isTee, isYee });
          }
        }
      }
    });

    const usedInDouble = new Set<number>();

    for (let i = 0; i < junctions.length; i++) {
      for (let j = i + 1; j < junctions.length; j++) {
        if (usedInDouble.has(i) || usedInDouble.has(j)) continue;
        const a = junctions[i], b = junctions[j];
        const distMm = Math.hypot(a.P[0] - b.P[0], a.P[1] - b.P[1]);
        if (distMm > DOUBLE_YEE_THRESHOLD_MM) continue;

        const dotMain = a.uA.x * b.uA.x + a.uA.y * b.uA.y;
        const dotMain2 = a.uA.x * b.uB.x + a.uA.y * b.uB.y;
        const aligned = Math.abs(Math.abs(dotMain) - 1) < 0.15 || Math.abs(Math.abs(dotMain2) - 1) < 0.15;
        if (!aligned) continue;

        usedInDouble.add(i);
        usedInDouble.add(j);

        const cvsA = engine.toCvs(a.P[0], a.P[1]);
        const cvsB = engine.toCvs(b.P[0], b.P[1]);
        const rad = engine.mm2cvs(2.0);
        const tickLen = engine.mm2cvs(0.8);

        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2 * engine.zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        const vectorsA = [];
        const vecAB = { x: b.P[0] - a.P[0], y: b.P[1] - a.P[1] };
        const dotAa = a.uA.x * vecAB.x + a.uA.y * vecAB.y;
        if (dotAa <= 0) vectorsA.push(a.uA); else vectorsA.push(a.uB);
        a.branches.forEach(uC => vectorsA.push(uC));

        const vectorsB = [];
        const vecBA = { x: a.P[0] - b.P[0], y: a.P[1] - b.P[1] };
        const dotBa = b.uA.x * vecBA.x + b.uA.y * vecBA.y;
        if (dotBa <= 0) vectorsB.push(b.uA); else vectorsB.push(b.uB);
        b.branches.forEach(uC => vectorsB.push(uC));

        ctx.beginPath();
        if (vectorsA.length > 0) {
          ctx.moveTo(cvsA.x + rad * vectorsA[0].x, cvsA.y + rad * vectorsA[0].y);
          for(let i=1; i<vectorsA.length; i++) {
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
          for(let i=1; i<vectorsB.length; i++) {
             ctx.lineTo(cvsB.x, cvsB.y);
             ctx.lineTo(cvsB.x + rad * vectorsB[i].x, cvsB.y + rad * vectorsB[i].y);
          }
        }
        
        ctx.lineWidth = 3 * engine.zoom;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.lineWidth = 2 * engine.zoom;
        ctx.strokeStyle = '#000000';
        ctx.stroke();

        const yeeKey = `${a.P[0].toFixed(3)}_${a.P[1].toFixed(3)}_${b.P[0].toFixed(3)}_${b.P[1].toFixed(3)}`;
        const isFlash = engine._yeeFlashKey !== yeeKey;
        if (isFlash) {
          engine._yeeFlashKey = yeeKey;
          ctx.beginPath();
          ctx.arc((cvsA.x + cvsB.x) / 2, (cvsA.y + cvsB.y) / 2, engine.mm2cvs(1.2), 0, Math.PI * 2);
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 1.5 * engine.zoom;
          ctx.stroke();
        }

        ctx.lineWidth = 2 * engine.zoom;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        vectorsA.forEach(u => {
          const T_pt = { x: cvsA.x + rad * u.x, y: cvsA.y + rad * u.y };
          const perp = { x: -u.y, y: u.x };
          ctx.moveTo(T_pt.x - perp.x * tickLen / 2, T_pt.y - perp.y * tickLen / 2);
          ctx.lineTo(T_pt.x + perp.x * tickLen / 2, T_pt.y + perp.y * tickLen / 2);
        });
        vectorsB.forEach(u => {
          const T_pt = { x: cvsB.x + rad * u.x, y: cvsB.y + rad * u.y };
          const perp = { x: -u.y, y: u.x };
          ctx.moveTo(T_pt.x - perp.x * tickLen / 2, T_pt.y - perp.y * tickLen / 2);
          ctx.lineTo(T_pt.x + perp.x * tickLen / 2, T_pt.y + perp.y * tickLen / 2);
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
      ctx.lineWidth = 2 * engine.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      const rad = engine.mm2cvs(2.0);
      const tickLen = engine.mm2cvs(0.8);
      const cvsP = engine.toCvs(j.P[0], j.P[1]);

      const vectors = [j.uA, j.uB, ...j.branches];
      ctx.beginPath();
      if (vectors.length > 0) {
        ctx.moveTo(cvsP.x + rad * vectors[0].x, cvsP.y + rad * vectors[0].y);
        for(let i=1; i<vectors.length; i++) {
           ctx.lineTo(cvsP.x, cvsP.y);
           ctx.lineTo(cvsP.x + rad * vectors[i].x, cvsP.y + rad * vectors[i].y);
        }
      }

      ctx.lineWidth = 3 * engine.zoom;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.lineWidth = 2 * engine.zoom;
      ctx.strokeStyle = '#000000';
      ctx.stroke();

      ctx.beginPath();
      vectors.forEach(u => {
        const T_pt = { x: cvsP.x + rad * u.x, y: cvsP.y + rad * u.y };
        const perp = { x: -u.y, y: u.x };
        ctx.moveTo(T_pt.x - perp.x * tickLen / 2, T_pt.y - perp.y * tickLen / 2);
        ctx.lineTo(T_pt.x + perp.x * tickLen / 2, T_pt.y + perp.y * tickLen / 2);
      });
      ctx.stroke();

      ctx.restore();
    }
  });
}

export { renderJunctions };
