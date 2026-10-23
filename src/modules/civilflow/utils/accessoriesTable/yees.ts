import { compactYeeDiam } from '../sanFittingsCatalog.ts';
import { distToSegment } from '../../lib/shared/geometry';
import { fmtPulg } from '../formatUtils.ts';
import { diamPulgFromLabel } from '../diamInchesFromLabel.ts';
import type { RamalDibujo, TribDibujo, VentDibujo } from './collection';
import type { Tramo } from '../../context/tramosReducer';

/** Unión detectada con dos ramales principales y su rama (yee). */
export interface YeeJunction {
  x: number;
  y: number;
  m1: string;
  m2: string;
  branch: string;
  hostKey: string;
}

/**
 * Detección de yees por VÉRTICE (no por par de ramales: la tubería principal dibujada como
 * dos ramales unidos contaba la misma unión dos veces) y los diámetros de cada brazo.
 */
export function detectarYees(
  net: 'san' | 'll' | 'af' | 'ac' | 'gas',
  drawingRamales: RamalDibujo[],
  tribDrawing: TribDibujo[],
  ventRamales: VentDibujo[],
  tramos: Tramo[],
): {
  yeeJunctions: YeeJunction[];
  yeeDiams: Record<string, { simple: string[]; doble: string[] }>;
  ventYeeCombos: Record<string, string[]>;
  ventCodoCombos: Record<string, string[]>;
} {
  const yeeJunctions: {
    x: number;
    y: number;
    m1: string;
    m2: string;
    branch: string;
    hostKey: string;
  }[] = [];
  if (net === 'san') {
    const allSan: Array<{
      id: string;
      planId: string;
      diametro: string;
      pts: number[][];
      trib: boolean;
    }> = [
      ...drawingRamales.map((r) => ({ ...r, trib: false })),
      ...tribDrawing.map((r) => ({ ...r, trib: true })),
    ];
    const diamOf = (r: { diametro: string }) => fmtPulg(diamPulgFromLabel(r.diametro));
    const seenPts = new Set<string>();
    for (const r of allSan) {
      if (r.pts.length < 2) continue;
      for (const P of r.pts) {
        const pKey = `${P[0].toFixed(3)}_${P[1].toFixed(3)}`;
        if (seenPts.has(pKey)) continue;
        seenPts.add(pKey);
        type Vec = { x: number; y: number; ramal: (typeof allSan)[number] };
        const vectors: Vec[] = [];
        const pushVec = (pt: number[], ramal: (typeof allSan)[number]) => {
          const dx = pt[0] - P[0];
          const dy = pt[1] - P[1];
          const len = Math.hypot(dx, dy);
          if (len > 0.1) vectors.push({ x: dx / len, y: dy / len, ramal });
        };
        for (const rr of allSan) {
          let isVertex = false;
          for (let i = 0; i < rr.pts.length; i++) {
            if (Math.hypot(rr.pts[i][0] - P[0], rr.pts[i][1] - P[1]) < 0.5) {
              isVertex = true;
              if (i > 0) pushVec(rr.pts[i - 1], rr);
              if (i < rr.pts.length - 1) pushVec(rr.pts[i + 1], rr);
            }
          }
          if (!isVertex) {
            for (let i = 0; i < rr.pts.length - 1; i++) {
              const A = rr.pts[i];
              const B = rr.pts[i + 1];
              const dx = B[0] - A[0];
              const dy = B[1] - A[1];
              const lenSq = dx * dx + dy * dy;
              if (lenSq <= 0.001) continue;
              let t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / lenSq;
              t = Math.max(0, Math.min(1, t));
              const projX = A[0] + t * dx;
              const projY = A[1] + t * dy;
              const dist = Math.hypot(P[0] - projX, P[1] - projY);
              if (dist >= 0.5) continue;
              const lenA = Math.hypot(A[0] - P[0], A[1] - P[1]);
              const lenB = Math.hypot(B[0] - P[0], B[1] - P[1]);
              if (lenA > 0.5 && lenB > 0.5) {
                pushVec(A, rr);
                pushVec(B, rr);
              }
            }
          }
        }
        const uniq: Vec[] = [];
        for (const v of vectors) {
          if (!uniq.some((u) => u.x * v.x + u.y * v.y > 0.99)) uniq.push(v);
        }
        if (uniq.length < 3 || uniq.length > 4) continue;
        let bi = -1;
        let bj = -1;
        let bestDot = 1;
        for (let i = 0; i < uniq.length; i++)
          for (let j = i + 1; j < uniq.length; j++) {
            const d = uniq[i].x * uniq[j].x + uniq[i].y * uniq[j].y;
            if (d < bestDot) {
              bestDot = d;
              bi = i;
              bj = j;
            }
          }
        if (bestDot >= -0.9) continue;
        const branches = uniq.filter((_, k) => k !== bi && k !== bj);
        if (branches.length === 0) continue;
        const cosVal = Math.abs(branches[0].x * uniq[bj].x + branches[0].y * uniq[bj].y);
        // Yee: derivación en ~45° — mismo rango |cos| ∈ [0.4, 0.85] que el engine;
        // perpendicular (~0, tee) o colineal (~1, empalme de línea) no cuenta como yee.
        if (cosVal < 0.25 || cosVal > 0.85) continue;
        const m1 = diamOf(uniq[bi].ramal);
        const m2 = diamOf(uniq[bj].ramal);
        const a1 = m1 && m1 !== '—' ? m1 : m2 || '';
        const a2 = m2 && m2 !== '—' ? m2 : m1 || '';
        // Sin diámetro asignado la unión IGUAL existe: el combo cae al diámetro del tronco en
        // vez de descartar el conteo — una derivación sin dimensionar hacía desaparecer la yee
        // del resumen (orig. usuario: contaba 2 de 3). Solo se descarta si NADA tiene diámetro.
        const runDiam = a1 || a2;
        const branchDiamRaw = diamOf(branches[0].ramal);
        const branchDiam = branchDiamRaw && branchDiamRaw !== '—' ? branchDiamRaw : runDiam;
        if (!runDiam || runDiam === '—' || !branchDiam || branchDiam === '—') continue;
        // Se atribuye a un ramal NO tributario del punto (la tubería principal) para que el
        // resumen la muestre en la fila de ese tramo; si todos son tributarios, al primero.
        const pairRamals = [uniq[bi].ramal, uniq[bj].ramal];
        const main = pairRamals.find((ram) => !ram.trib) || pairRamals[0];
        // Yee doble en UN solo punto (4 vectores, 2 salidas laterales): se registran DOS
        // entradas en el mismo punto para que el emparejamiento de abajo la clasifique como
        // doble con las dos ramas. Salidas opuestas entre sí = cruce, no yee doble.
        if (
          branches.length >= 2 &&
          branches[0].x * branches[1].x + branches[0].y * branches[1].y > -0.9
        ) {
          for (const br of branches) {
            const bD = diamOf(br.ramal);
            if (!bD || bD === '—') continue;
            yeeJunctions.push({
              x: P[0],
              y: P[1],
              m1: a1,
              m2: a2,
              branch: bD,
              hostKey: `${main.id}-${main.planId}`,
            });
          }
          continue;
        }
        yeeJunctions.push({
          x: P[0],
          y: P[1],
          m1: a1,
          m2: a2,
          branch: branchDiam,
          hostKey: `${main.id}-${main.planId}`,
        });
      }
    }
  }

  const yeeDiams: Record<string, { simple: string[]; doble: string[] }> = {};
  // Item 7: combos san×vent para uniones vent↔san, clasificando por ángulo — en Y (≈45°) va a
  // yeeSimple; perpendicular (≈90°) va a codoReventilado. Mismo criterio que calcSanitaryAccessories.
  const ventYeeCombos: Record<string, string[]> = {};
  const ventCodoCombos: Record<string, string[]> = {};
  if (net === 'san') {
    for (const v of ventRamales) {
      const vDiamStr = fmtPulg(diamPulgFromLabel(v.diametro));
      if (!vDiamStr || vDiamStr === '—') continue;
      const vEnds = [v.pts[0], v.pts[v.pts.length - 1]];
      const vVec = [v.pts[1][0] - v.pts[0][0], v.pts[1][1] - v.pts[0][1]];
      const vLen = Math.hypot(vVec[0], vVec[1]);
      for (const parent of drawingRamales) {
        let near = false;
        let segDx = 0,
          segDy = 0;
        for (const ep of vEnds) {
          for (let i = 0; i < parent.pts.length - 1; i++) {
            const [ax, ay] = parent.pts[i];
            const [bx, by] = parent.pts[i + 1];
            if (distToSegment(ep, [ax, ay], [bx, by] as [number, number]) < 0.5) {
              near = true;
              segDx = bx - ax;
              segDy = by - ay;
              break;
            }
          }
          if (near) break;
        }
        if (!near) continue;
        const pk = `${parent.id}-${parent.planId}`;
        // Nomenclatura Yee: cada brazo de la Y — la tubería principal pasa recta (dos brazos del
        // mismo diámetro) y el vent entra por el tercer brazo: san×san×vent, compactado
        // (4"×4"×2" → 4"×2").
        const parentDiamStr = fmtPulg(diamPulgFromLabel(parent.diametro));
        const combo = compactYeeDiam([parentDiamStr, parentDiamStr, vDiamStr]);
        if (!combo) continue;
        const segLen = Math.hypot(segDx, segDy);
        const dot = Math.abs(
          (segDx / segLen) * (vVec[0] / vLen) + (segDy / segLen) * (vVec[1] / vLen),
        );
        const isY = vLen > 0.1 && segLen > 0.1 && Math.abs(dot - Math.cos(Math.PI / 4)) < 0.15;
        const target = isY ? ventYeeCombos : ventCodoCombos;
        if (!target[pk]) target[pk] = [];
        if (!target[pk].includes(combo)) target[pk].push(combo);
      }
    }
    // Emparejamiento de uniones — REGLA DEL USUARIO: yee doble SOLO cuando las dos derivadas
    // caen en el MISMO punto (mismo glifo, 2 ramas). Dos uniones separadas —aunque estén
    // pegadas— son SIEMPRE yees simples: la cercanía ya no crea dobles (orig. usuario: 3
    // simples contadas 2 + doble fantasma).
    const byHost: Record<string, (typeof yeeJunctions)[number][]> = {};
    for (const j of yeeJunctions) {
      if (!byHost[j.hostKey]) byHost[j.hostKey] = [];
      byHost[j.hostKey].push(j);
    }
    for (const [hostKey, js] of Object.entries(byHost)) {
      const yd = (yeeDiams[hostKey] = yeeDiams[hostKey] || { simple: [], doble: [] });
      const used = new Set<number>();
      for (let i = 0; i < js.length; i++) {
        if (used.has(i)) continue;
        let partner = -1;
        for (let j = i + 1; j < js.length; j++) {
          if (used.has(j)) continue;
          if (Math.hypot(js[j].x - js[i].x, js[j].y - js[i].y) <= 0.5) {
            partner = j;
            break;
          }
        }
        if (partner >= 0) {
          used.add(i);
          used.add(partner);
          const combo = compactYeeDiam([js[i].m1, js[i].m2, js[i].branch, js[partner].branch]);
          if (combo) yd.doble.push(combo);
        } else {
          used.add(i);
          const combo = compactYeeDiam([js[i].m1, js[i].m2, js[i].branch]);
          if (combo) yd.simple.push(combo);
        }
      }
    }
    // Las uniones vent↔san en Y se tratan como yee simple con sus tres brazos.
    for (const t of tramos) {
      if (t.esBajante || t.tipo === 'tributario') continue;
      const tKey = String(t._key || `${t.id}-${t.planId}`);
      const yd = yeeDiams[tKey];
      const ventYeeC = ventYeeCombos[tKey] || [];
      if ((!yd || (yd.simple.length === 0 && yd.doble.length === 0)) && ventYeeC.length === 0)
        continue;
      if (!yeeDiams[tKey]) yeeDiams[tKey] = { simple: [], doble: [] };
      ventYeeC.forEach((combo) => {
        if (!yeeDiams[tKey].simple.includes(combo)) yeeDiams[tKey].simple.push(combo);
      });
    }
  }

  return { yeeJunctions, yeeDiams, ventYeeCombos, ventCodoCombos };
}
