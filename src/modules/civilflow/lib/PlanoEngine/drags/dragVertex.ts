import { splitPtr } from '../../../utils/keys.ts';
import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState.ts';
import { checkRamalAnglesExcludingConnections } from '../junctionAutoSplit.ts';
import { sameNetGroup, refrescarTrazo, type DragCtx } from './dragContext.ts';
import { indicesDeMotor } from '../engineIndices.ts';

/** Arrastre de un VÉRTICE/EXTREMO de ramal: accesorio deslizándose por su línea, snap 45°
 *  con restricción de colinealidad, snap a bajantes/extremos vecinos y la PROPAGACIÓN por
 *  frontera (BFS geométrico) que arrastra los ramales conectados + linkedPts (codo
 *  reventilado). Los bajantes son anclajes fijos: el ramal se adapta a ellos. */
export function dragVertex(engine: IPlanoEngineCore, x: number, y: number, ctx: DragCtx): void {
  const { bajantesQueReciben, ramalesPorId } = ctx;
  const r = ramalesPorId.get(engine.ptDrag!.id);
  if (r) {
    let p = engine.toPlane(x, y);
    const idx = engine.ptDrag!.ptIdx;
    const isEndpoint = idx === 0 || idx === r.pts.length - 1;
    /* El arrastre arranca con la misma holgura con la que se agarró el vértice (sin salto). */
    if (!engine.ptDrag!.accMedSlide) {
      p = { x: p.x - (engine.ptDrag!.offX || 0), y: p.y - (engine.ptDrag!.offY || 0) };
    }

    // Accesorio a mitad de ramal (rociador rci): REORDENAR, no arrastrar la geometría (ped.
    // usuario 2026-11-20). Proyectar el cursor sobre el ramal ORIGINAL (backup del mouse-down)
    // SIN el vértice arrastrado y re-insertarlo en el segmento donde cayó: la polilínea nunca
    // se dobla (antes el vértice se proyectaba sobre segmentos con él mismo de extremo y
    // perseguía al cursor, formando la "V") ni retrocede al cruzar otro vértice, y la etiqueta
    // del ramal (anclada a mitad del largo) no se arrastra. Las claves accMed${k} son ÍNDICE
    // de vértice → remap con la fuente ESTABLE del backup; ptDrag.ptIdx sigue al vértice.
    if (engine.ptDrag!.accMedSlide) {
      const orig = engine._dragBackupPts ?? r.pts;
      const accFuente = engine._dragBackupAccMed ?? r.accMed;
      const resto = orig.filter((_, j) => j !== idx);
      let mejorD = Infinity;
      let mejor: [number, number] | null = null;
      let ins = 1;
      for (let i = 0; i < resto.length - 1; i++) {
        const ax = resto[i][0];
        const ay = resto[i][1];
        const bx = resto[i + 1][0];
        const by = resto[i + 1][1];
        const sDx = bx - ax;
        const sDy = by - ay;
        const sLen2 = sDx * sDx + sDy * sDy;
        if (sLen2 < 0.0001) continue;
        const t = Math.max(0.02, Math.min(0.98, ((p.x - ax) * sDx + (p.y - ay) * sDy) / sLen2));
        const qx = ax + t * sDx;
        const qy = ay + t * sDy;
        const d = Math.hypot(p.x - qx, p.y - qy);
        if (d < mejorD) {
          mejorD = d;
          mejor = [qx, qy];
          ins = i + 1;
        }
      }
      if (mejor) {
        // Índice nuevo de cada vértice original: los que quedan antes de la inserción no
        // cambian; los que quedan después avanzan 1. El arrastrado aterriza en ins.
        const nuevoIdx: number[] = new Array(orig.length);
        let ri = 0;
        for (let j = 0; j < orig.length; j++) {
          if (j === idx) continue;
          nuevoIdx[j] = ri >= ins ? ri + 1 : ri;
          ri++;
        }
        const nuevoAcc: Record<string, string> = {};
        if (accFuente) {
          for (let j = 0; j < orig.length; j++) {
            const v = accFuente[`accMed${j}`];
            if (v === undefined) continue;
            nuevoAcc[`accMed${j === idx ? ins : nuevoIdx[j]}`] = v;
          }
        }
        r.accMed = nuevoAcc;
        r.pts = [...resto.slice(0, ins), mejor, ...resto.slice(ins)] as number[][];
        engine.ptDrag!.ptIdx = ins;
      }
      engine.scheduleRender();
      return;
    }

    if (engine.snapMode) {
      const constraint = engine.ptDrag!.slideConstraint;
      let snappedToConstraint = false;

      if (isEndpoint && constraint) {
        const other = engine.ramales.find((o) => o.id === constraint.otherId);
        if (other && other.pts && other.pts.length > constraint.segmentIdx) {
          const [ax, ay] = other.pts[constraint.segmentIdx];
          const [bx, by] = other.pts[constraint.segmentIdx + 1] || [ax, ay];
          const sDx = bx - ax,
            sDy = by - ay;
          const sLen = Math.hypot(sDx, sDy);
          if (sLen > 0.001) {
            const crossPlane = Math.abs(sDx * (ay - p.y) - sDy * (ax - p.x)) / sLen;
            if (crossPlane < engine.mm2cvs(3)) {
              const t = ((p.x - ax) * sDx + (p.y - ay) * sDy) / (sLen * sLen);
              p.x = ax + t * sDx;
              p.y = ay + t * sDy;
              snappedToConstraint = true;
            }
          }
        }
      }

      // Snap solo de cuadrícula (sin filtrar por giro válido) para que un giro inválido pueda
      // formarse aquí — ver el comentario equivalente en la rama bajDrag de arriba para el
      // porqué: debe ser alcanzable para que checkRamalAngles al soltar lo atrape y muestre
      // "Ángulo no recomendado".
      if (!snappedToConstraint) {
        if (idx === 0 && r.pts.length > 1) {
          p = engine.snapAngle(r.pts[1][0], r.pts[1][1], p.x, p.y, r.net, r.tipo);
        } else if (idx > 0) {
          p = engine.snapAngle(r.pts[idx - 1][0], r.pts[idx - 1][1], p.x, p.y, r.net, r.tipo);
        }
      }
    }

    if (isEndpoint) {
      const associatedBajantes: PlanoBajante[] = [];
      // Set de los bajantes que reciben a este ramal (el .includes por bajante era O(k)).
      const recibidoresDeR = new Set((bajantesQueReciben.get(r.id) || []).map((bb) => bb.id));
      engine.bajantes.forEach((b) => {
        const isRecibe = (b.recibeDeIds?.length ?? 0) > 0 && recibidoresDeR.has(b.id);
        let isDescarga = false;
        if (b.descargaEnId) {
          const parts = splitPtr(b.descargaEnId, engine._loadedPlanId);
          const targetPlanId = parts[0];
          const targetId = parts[1];
          if (String(targetPlanId) === String(engine._loadedPlanId) && targetId === r.id) {
            isDescarga = true;
          }
        }
        if (isRecibe || isDescarga) {
          associatedBajantes.push(b);
        }
      });

      const snapThresh = 20 / engine.zoom;
      let snapped = false;
      for (const b of associatedBajantes) {
        const dist = Math.hypot(b.x - p.x, b.y - p.y);
        if (dist < snapThresh) {
          p.x = b.x;
          p.y = b.y;
          snapped = true;
          break;
        }
      }

      // También pegar a otros bajantes/puntos del canvas (snapToExisting), excluyendo los
      // propios
      if (!snapped) {
        const snapThresh2 = 16 / engine.zoom;
        // Pegar a otros bajantes
        for (const b of engine.bajantes) {
          if (b.id === r.id) continue;
          if (b.net !== r.net) continue;
          if (engine._hiddenNets.has(b.net)) continue;
          const lvlLabel = engine.nivelActual?.label ?? '';
          const disp = b.desplazamientos?.[lvlLabel] || {};
          const bx = b.x + (disp.dx || 0);
          const by = b.y + (disp.dy || 0);
          const dist = Math.hypot(bx - p.x, by - p.y);
          if (dist < snapThresh2) {
            p.x = bx;
            p.y = by;
            snapped = true;
            break;
          }
        }
        // Pegar a los extremos de otros ramales
        if (!snapped) {
          for (const other of engine.ramales) {
            if (other.id === r.id) continue;
            if (other.net !== r.net) continue;
            for (const [rx, ry] of other.pts) {
              const dist = Math.hypot(rx - p.x, ry - p.y);
              if (dist < snapThresh2) {
                p.x = rx;
                p.y = ry;
                snapped = true;
                break;
              }
            }
            if (snapped) break;
          }
        }
      }
    }

    const oldP = [...r.pts[idx]];
    r.pts[idx] = [p.x, p.y];

    const dPx = p.x - oldP[0],
      dPy = p.y - oldP[1];
    if (Math.abs(dPx) + Math.abs(dPy) > 0.001) {
      const movedRamalIds = new Set<string>([r.id]);
      const allOldPositions: number[][] = [oldP];
      let frontier: number[][] = [oldP];

      while (frontier.length > 0) {
        const nextFrontier: number[][] = [];
        for (const other of engine.ramales) {
          if (other.id === r.id || !sameNetGroup(other.net, r.net) || movedRamalIds.has(other.id))
            continue;
          let changed = false;
          // Punto contra punto: ¿un punto del frente de avance coincide con un vértice de
          // `other`?
          for (let i = 0; i < other.pts.length; i++) {
            const matches = frontier.some(
              (fp) => Math.hypot(other.pts[i][0] - fp[0], other.pts[i][1] - fp[1]) < 0.5,
            );
            if (matches) {
              const before: [number, number] = [other.pts[i][0], other.pts[i][1]];
              other.pts[i][0] += dPx;
              other.pts[i][1] += dPy;
              changed = true;
              nextFrontier.push(before);
              allOldPositions.push(before);
            }
          }
          // Punto contra cuerpo: ¿un punto del frente aterriza sobre el segmento del cuerpo de
          // `other` (extremo de vent sobre cuerpo de san)? Espejo de frontierOnOtherBody en
          // collectConnectedGraph.
          if (!changed) {
            frontier.some((fp) => {
              if (!other.pts || other.pts.length < 2) return false;
              for (let si = 0; si < other.pts.length - 1; si++) {
                const [ax, ay] = other.pts[si],
                  [bx, by] = other.pts[si + 1];
                const sDx = bx - ax,
                  sDy = by - ay;
                const sLen = Math.hypot(sDx, sDy);
                if (sLen < 0.001) continue;
                const cross = Math.abs(sDx * (ay - fp[1]) - sDy * (ax - fp[0])) / sLen;
                if (cross >= 0.5) continue;
                const t = ((fp[0] - ax) * sDx + (fp[1] - ay) * sDy) / (sLen * sLen);
                if (t >= -0.02 && t <= 1.02) {
                  // Desplazar rígidamente todos los puntos de `other`
                  for (let pi = 0; pi < other.pts.length; pi++) {
                    const origPt: [number, number] = [other.pts[pi][0], other.pts[pi][1]];
                    other.pts[pi][0] += dPx;
                    other.pts[pi][1] += dPy;
                    nextFrontier.push(origPt);
                    allOldPositions.push(origPt);
                  }
                  changed = true;
                  break;
                }
              }
              return false;
            });
          }
          if (changed) {
            movedRamalIds.add(other.id);
            refrescarTrazo(engine, other);
          }
        }
        frontier = nextFrontier;
      }

      // Codo reventilado: el extremo del ramal de vent y el punto coincidente del ramal de san
      // deben quedar exactamente juntos, así que se mueve el punto enlazado a la misma
      // posición absoluta en vez de por delta (evita la deriva si no estaban pixel-perfect
      // coincidentes).
      if (engine.ptDrag!.linkedPts) {
        const ramalesById = indicesDeMotor(engine).ramales;
        for (const link of engine.ptDrag!.linkedPts) {
          const other = ramalesById.get(link.id);
          if (!other || !other.pts[link.ptIdx]) continue;
          other.pts[link.ptIdx] = [p.x, p.y];
          refrescarTrazo(engine, other);
        }
      }
      // Los bajantes son los anclajes fijos de la red — un arrastre de extremo debe adaptar el
      // ramal a la posición del bajante, no desplazar el bajante para seguir el arrastre. Solo
      // el ramalDrag de cuerpo completo (abajo) puede trasladar rígidamente un bajante
      // conectado.
    }

    if (engine.nivelActual) {
      const lvl = engine.nivelActual.label ?? '';
      for (const b of engine.bajantes) {
        const desp = b.desplazamientos?.[lvl];
        if (desp && desp.Ldesvio === r.id) {
          const lastPt = r.pts[r.pts.length - 1];
          desp.dx = lastPt[0] - b.x;
          desp.dy = lastPt[1] - b.y;
          break;
        }
      }
    }
    refrescarTrazo(engine, r);
    checkRamalAnglesExcludingConnections(engine, r);
    engine.scheduleRender();
  }
}
