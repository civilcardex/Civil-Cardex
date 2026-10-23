import type { IPlanoEngineCore, PlanoBajante } from '../PlanoState.ts';
import { calculateRamalLength, _midpoint } from '../PlanoEngineDrawing.ts';
import { angleAtHalfLength } from '../drawingAngles.ts';
import { parseDescargaEnId } from '../../../utils/parseDischargeInId.ts';
import { checkRamalAnglesExcludingConnections } from '../junctionAutoSplit.ts';
import { indexRamales, sameNetGroup, type DragCtx } from './dragContext.ts';

/** Arrastre de un VÉRTICE/EXTREMO de ramal: accesorio deslizándose por su línea, snap 45°
 *  con restricción de colinealidad, snap a bajantes/extremos vecinos y la PROPAGACIÓN por
 *  frontera (BFS geométrico) que arrastra los ramales conectados + linkedPts (codo
 *  reventilado). Los bajantes son anclajes fijos: el ramal se adapta a ellos. */
export function dragVertex(engine: IPlanoEngineCore, x: number, y: number, ctx: DragCtx): void {
  const { bajantesQueReciben } = ctx;
  const r = engine.ramales.find((rr) => rr.id === engine.ptDrag!.id);
  if (r) {
    let p = engine.toPlane(x, y);
    const idx = engine.ptDrag!.ptIdx;
    const isEndpoint = idx === 0 || idx === r.pts.length - 1;

    // Accesorio a mitad de ramal: deslizarse solo por la línea recta entre sus vecinos,
    // recortado entre ellos, para que el recorrido real del ramal nunca se doble por este
    // arrastre.
    const accSlide = engine.ptDrag!.accMedSlide;
    if (accSlide) {
      const sDx = accSlide.bx - accSlide.ax,
        sDy = accSlide.by - accSlide.ay;
      const sLen2 = sDx * sDx + sDy * sDy;
      let t = sLen2 > 0.0001 ? ((p.x - accSlide.ax) * sDx + (p.y - accSlide.ay) * sDy) / sLen2 : 0;
      t = Math.max(0.02, Math.min(0.98, t));
      r.pts[idx][0] = accSlide.ax + t * sDx;
      r.pts[idx][1] = accSlide.ay + t * sDy;
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
          const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
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
            other.totalL = calculateRamalLength(other.pts, engine);
            if (!other.labelMoved) other.labelAngle = angleAtHalfLength(other.pts);
            if (!other.labelMoved) {
              const [mx, my] = _midpoint(other.pts);
              other.labelX = mx;
              other.labelY = my;
            }
          }
        }
        frontier = nextFrontier;
      }

      // Codo reventilado: el extremo del ramal de vent y el punto coincidente del ramal de san
      // deben quedar exactamente juntos, así que se mueve el punto enlazado a la misma
      // posición absoluta en vez de por delta (evita la deriva si no estaban pixel-perfect
      // coincidentes).
      if (engine.ptDrag!.linkedPts) {
        const ramalesById = indexRamales(engine);
        for (const link of engine.ptDrag!.linkedPts) {
          const other = ramalesById.get(link.id);
          if (!other || !other.pts[link.ptIdx]) continue;
          other.pts[link.ptIdx] = [p.x, p.y];
          other.totalL = calculateRamalLength(other.pts, engine);
          if (!other.labelMoved) other.labelAngle = angleAtHalfLength(other.pts);
          if (!other.labelMoved) {
            const [mx, my] = _midpoint(other.pts);
            other.labelX = mx;
            other.labelY = my;
          }
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
    if (!r.labelMoved) r.labelAngle = angleAtHalfLength(r.pts);
    r.totalL = calculateRamalLength(r.pts, engine);
    if (!r.labelMoved) {
      const [mx, my] = _midpoint(r.pts);
      r.labelX = mx;
      r.labelY = my;
    }
    checkRamalAnglesExcludingConnections(engine, r);
    engine.scheduleRender();
  }
}
