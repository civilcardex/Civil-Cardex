import type { IPlanoEngineCore, PlanoRamal, PlanoBajante, PlanoArea } from './PlanoState';
import { calculateRamalLength, _midpoint, _firstSegmentAngle } from './PlanoEngineDrawing';
import { checkRamalAngles } from './drawingAngles';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';

export function handleDragMove(engine: IPlanoEngineCore, x: number, y: number): void {
  if (engine.multiDrag) {
    const tp = engine.toPlane(x, y);
    const dx = tp.x - engine.multiDrag.startX;
    const dy = tp.y - engine.multiDrag.startY;
    for (const id of Object.keys(engine.multiDrag.origData)) {
      const orig = engine.multiDrag.origData[id];
      if (!orig) continue;
      if (orig.type === 'ramal') {
        const r = engine.ramales.find(rr => rr.id === id);
        if (r && !r.bloqueado) {
          r.pts = (orig.origPts || []).map(p => [p[0] + dx, p[1] + dy]);
          r.labelX = (orig.origLabelX || 0) + dx;
          r.labelY = (orig.origLabelY || 0) + dy;
          r.labelAngle = orig.origLabelAngle || 0;
          r.totalL = calculateRamalLength(r.pts, engine);
        }
      } else if (orig.type === 'bajante') {
        const b = engine.bajantes.find(bb => bb.id === id);
        if (b) {
          b.x = (orig.origX || 0) + dx;
          b.y = (orig.origY || 0) + dy;
          b.labelX = (orig.origLabelX || 0) + dx;
          b.labelY = (orig.origLabelY || 0) + dy;
        }
      } else if (orig.type === 'text') {
        const t = engine.textAnnots.find(tt => tt.id === id);
        if (t) {
          t.x = (orig.origX || 0) + dx;
          t.y = (orig.origY || 0) + dy;
        }
      }
    }
    engine.scheduleRender();
    return;
  }
  if (engine.ramalDrag) {
    const r = engine.ramales.find(rr => rr.id === engine.ramalDrag!.id);
    if (r && !r.bloqueado) {
      const tp = engine.toPlane(x, y);
      const dx = tp.x - engine.ramalDrag.startX;
      const dy = tp.y - engine.ramalDrag.startY;

      let slideDx = dx, slideDy = dy;
      for (const other of engine.ramales) {
        if (other.id === r.id || other.net !== r.net) continue;
        for (let si = 0; si < other.pts.length - 1; si++) {
          const [ax, ay] = other.pts[si], [bx, by] = other.pts[si+1];
          const sDx = bx - ax, sDy = by - ay;
          const sLen = Math.hypot(sDx, sDy);
          if (sLen < 0.001) continue;
          const origFirst = engine.ramalDrag.origPts[0];
          const cross = Math.abs(sDx * (ay - origFirst[1]) - sDy * (ax - origFirst[0])) / sLen;
          if (cross < 0.05) {
            const proposedX = origFirst[0] + dx, proposedY = origFirst[1] + dy;
            let t = ((proposedX - ax) * sDx + (proposedY - ay) * sDy) / (sLen * sLen);
            t = Math.max(0, Math.min(1, t));
            slideDx = (ax + t * sDx) - origFirst[0];
            slideDy = (ay + t * sDy) - origFirst[1];
            break;
          }
        }
      }

      for (let i = 0; i < r.pts.length; i++) {
        r.pts[i][0] = engine.ramalDrag.origPts[i][0] + slideDx;
        r.pts[i][1] = engine.ramalDrag.origPts[i][1] + slideDy;
      }
      if (engine.ramalDrag.origLabelX !== undefined && r.labelX !== undefined) {
        r.labelX = engine.ramalDrag.origLabelX + slideDx;
      }
      if (engine.ramalDrag.origLabelY !== undefined && r.labelY !== undefined) {
        r.labelY = engine.ramalDrag.origLabelY + slideDy;
      }
      r.totalL = calculateRamalLength(r.pts, engine);
      checkRamalAngles(r.pts, r.net, r.tipo);
      if (engine.ramalDrag.connBaj) {
        for (const cb of engine.ramalDrag.connBaj) {
          const b = engine.bajantes.find(bb => bb.id === cb.id);
          if (!b) continue;
          b.x = cb.origX + slideDx;
          b.y = cb.origY + slideDy;
          b.labelX = cb.origLblX + slideDx;
          b.labelY = cb.origLblY + slideDy;
        }
      }
      if (engine.ramalDrag.connRamales) {
        for (const cr of engine.ramalDrag.connRamales) {
          const other = engine.ramales.find(rr => rr.id === cr.id);
          if (!other) continue;
          for (let i = 0; i < other.pts.length && i < cr.origPts.length; i++) {
            other.pts[i][0] = cr.origPts[i][0] + slideDx;
            other.pts[i][1] = cr.origPts[i][1] + slideDy;
          }
          other.totalL = calculateRamalLength(other.pts, engine);
        }
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
      engine.scheduleRender();
    }
    return;
  }
  if (engine.ghostDrag) {
    const b = engine.bajantes.find((bb) => bb.id === engine.ghostDrag!.id);
    if (b && engine.nivelActual) {
      let dx = (x - engine.ghostDrag.startX) / engine.zoom + engine.ghostDrag.baseDx;
      let dy = (y - engine.ghostDrag.startY) / engine.zoom + engine.ghostDrag.baseDy;
      if (engine.snapMode) {
        let snappedPt = engine.snapAngle(b.x, b.y, b.x + dx, b.y + dy);
        const sp = engine.snapToExisting(snappedPt.x, snappedPt.y);
        if (sp) {
          snappedPt = sp;
        }
        dx = snappedPt.x - b.x;
        dy = snappedPt.y - b.y;
      }
      if (!b.desplazamientos) b.desplazamientos = {};
      const oldD = b.desplazamientos[engine.nivelActual.label ?? ''];

      const lDesvio = oldD ? oldD.Ldesvio : null;
      // ONLY update the displacement — do NOT touch existing ramales.
      // The parent stays connected to its original ramal; only the ghost moves.
      b.desplazamientos[engine.nivelActual.label ?? ''] = { dx, dy, Ldesvio: lDesvio };

      // Update only the Ldesvio ramal if it exists (the explicit displacement ramal)
      const newGx = b.x + dx;
      const newGy = b.y + dy;
      if (lDesvio) {
        const r = engine.ramales.find((rr) => rr.id === lDesvio);
        if (r) {
          r.pts[0] = [b.x, b.y];
          r.pts[r.pts.length - 1] = [newGx, newGy];
          r.totalL = calculateRamalLength(r.pts, engine);
          r.labelAngle = _firstSegmentAngle(r.pts);
          const [mx, my] = _midpoint(r.pts);
          r.labelX = mx;
          r.labelY = my;
        }
      }

      engine.scheduleRender();
    }
    return;
  }
  if (engine.bajDrag) {
    const b = engine.bajantes.find(bb => bb.id === engine.bajDrag!.id);
    if (b) {
      // Check if any associated ramal is bloqueado
      const allAssocIds = [...(b.recibeDeIds || [])];
      if (b.descargaEnId) allAssocIds.push(b.descargaEnId);
      const asociadoBloqueado = (engine.ramales || []).some(r =>
        allAssocIds.includes(r.id) && r.bloqueado
      );
      if (asociadoBloqueado) {
        // Don't move: snap to current position
        engine.scheduleRender();
        return;
      }
      let p = engine.toPlane(x - engine.bajDrag.offX, y - engine.bajDrag.offY);
      const oldX = b.x;
      const oldY = b.y;

      // Snap mode: constrain the new bajante position to a 45°-multiple angle measured from
      // the ramal's OTHER (fixed) endpoint. Picking whichever candidate anchor landed closer to
      // the raw cursor (the old approach) almost always chose the near/self anchor instead —
      // on a slow continuous drag each frame's delta is tiny, so snapping "from itself" barely
      // constrains anything and the ramal effectively drifted freely.
      if (engine.snapMode) {
        const assocIds = [...(b.recibeDeIds || [])];
        if (b.descargaEnId) assocIds.push(b.descargaEnId);
        const assocRamales = (engine.ramales || []).filter(r => assocIds.includes(r.id) && r.pts && r.pts.length >= 2);
        if (assocRamales.length > 0) {
          const r = assocRamales[0];
          const pStart = r.pts[0];
          const pEnd = r.pts[r.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - oldX, pStart[1] - oldY);
          const distEnd = Math.hypot(pEnd[0] - oldX, pEnd[1] - oldY);
          const anchor = distStart <= distEnd ? pEnd : pStart;
          p = engine.snapAngle(anchor[0], anchor[1], p.x, p.y);
        }
      }

      const associatedRamales: PlanoRamal[] = [];
      if (b.recibeDeIds?.length) {
        b.recibeDeIds.forEach(rid => {
          const r = engine.ramales.find(rr => rr.id === rid);
          if (r) associatedRamales.push(r);
        });
      }
      if (b.descargaEnId) {
        const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
        const targetPlanId = parts[0];
        const targetId = parts[1];
        if (String(targetPlanId) === String(engine._loadedPlanId)) {
          const r = engine.ramales.find(rr => rr.id === targetId);
          if (r) associatedRamales.push(r);
        }
      }

       // Snap to the RAMAL ENDPOINT — always active
      {
        const snapThresh = 20 / engine.zoom;
        for (const r of associatedRamales) {
          if (!r.pts || r.pts.length === 0) continue;
          const pStart = r.pts[0];
          const pEnd = r.pts[r.pts.length - 1];
          const dStart = Math.hypot(pStart[0] - p.x, pStart[1] - p.y);
          const dEnd = Math.hypot(pEnd[0] - p.x, pEnd[1] - p.y);
          if (dStart < snapThresh && dStart <= dEnd) {
            p.x = pStart[0];
            p.y = pStart[1];
            break;
          } else if (dEnd < snapThresh) {
            p.x = pEnd[0];
            p.y = pEnd[1];
            break;
          }
        }
      }

      // Auto-connect: detect nearby ramal endpoints and auto-associate during drag
      const autoThresh = 20 / engine.zoom;
      for (const r of (engine.ramales || [])) {
        if (!r.pts || r.pts.length === 0) continue;
        if (r.net !== b.net) continue;
        if ((b.recibeDeIds || []).includes(r.id)) continue;
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const dStart = Math.hypot(pStart[0] - p.x, pStart[1] - p.y);
        const dEnd = Math.hypot(pEnd[0] - p.x, pEnd[1] - p.y);
        if (dStart < autoThresh && dStart <= dEnd) {
          if (!b.recibeDeIds) b.recibeDeIds = [];
          b.recibeDeIds.push(r.id);
          r.ini = b.code || b.id;
          p.x = pStart[0]; p.y = pStart[1];
          break;
        } else if (dEnd < autoThresh) {
          if (!b.recibeDeIds) b.recibeDeIds = [];
          b.recibeDeIds.push(r.id);
          r.fin = b.code || b.id;
          p.x = pEnd[0]; p.y = pEnd[1];
          break;
        }
      }

      const dx = p.x - oldX;
      const dy = p.y - oldY;

      b.x = p.x;
      b.y = p.y;
      b.labelX = (b.labelX || 0) + dx;
      b.labelY = (b.labelY || 0) + dy;
      
      if (b.recibeDeIds?.length) {
        b.recibeDeIds.forEach(rid => {
          const r = engine.ramales.find(rr => rr.id === rid);
          if (!r || !r.pts) return;
          let changed = false;
          if (Math.hypot(r.pts[0][0] - oldX, r.pts[0][1] - oldY) < 0.5) {
            r.pts[0][0] = p.x; r.pts[0][1] = p.y; changed = true;
          }
          const lastIdx = r.pts.length - 1;
          if (Math.hypot(r.pts[lastIdx][0] - oldX, r.pts[lastIdx][1] - oldY) < 0.5) {
            r.pts[lastIdx][0] = p.x; r.pts[lastIdx][1] = p.y; changed = true;
          }
          if (changed) {
            r.totalL = calculateRamalLength(r.pts, engine);
            r.labelAngle = _firstSegmentAngle(r.pts);
            const [mx, my] = _midpoint(r.pts);
            r.labelX = mx;
            r.labelY = my;
            checkRamalAngles(r.pts, r.net, r.tipo);
          }
        });
      }
      
      engine.scheduleRender();
    }
    return;
  }
  if (engine.lblDrag) {
    const el = engine.ramales.find(r => r.id === engine.lblDrag!.id)
      || engine.bajantes.find(b => b.id === engine.lblDrag!.id)
      || engine.areas.find(a => a.id === engine.lblDrag!.id);
    if (el) {
      const p = engine.toPlane(x - engine.lblDrag.offX, y - engine.lblDrag.offY);
      // Use _lblDragIsParent flag: if the drag started on the parent label,
      // update labelX/labelY; otherwise (ghost label), update ghostData.
      const isParentDrag = !!(engine as any)._lblDragIsParent;
      if (!isParentDrag && engine.nivelActual) {
        const baj = el as PlanoBajante;
        const lbl = engine.nivelActual.label ?? '';
        if (!baj.ghostData) baj.ghostData = {};
        if (!baj.ghostData[lbl]) baj.ghostData[lbl] = {};
        baj.ghostData[lbl].labelX = p.x;
        baj.ghostData[lbl].labelY = p.y;
      } else {
        (el as PlanoRamal | PlanoBajante | PlanoArea).labelX = p.x;
        (el as PlanoRamal | PlanoBajante | PlanoArea).labelY = p.y;
      }
      engine.scheduleRender();
    }
    return;
  }
  if (engine.txtDrag) {
    const t = engine.textAnnots.find(tt => tt.id === engine.txtDrag!.id);
    if (t) {
      const p = engine.toPlane(x, y);
      t.x = engine.txtDrag.origX + (p.x - engine.txtDrag.startX);
      t.y = engine.txtDrag.origY + (p.y - engine.txtDrag.startY);
      engine.scheduleRender();
    }
    return;
  }
  if (engine.dimDrag) {
    const d = engine.dims.find(dd => dd.id === engine.dimDrag!.id);
    if (d) {
      const p = engine.toPlane(x, y);
      const dx = p.x - engine.dimDrag.startX;
      const dy = p.y - engine.dimDrag.startY;
      d.x1 += dx; d.y1 += dy;
      d.x2 += dx; d.y2 += dy;
      engine.dimDrag.startX = p.x;
      engine.dimDrag.startY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.areaDrag) {
    const a = engine.areas.find(aa => aa.id === engine.areaDrag!.id);
    if (a) {
      const p = engine.toPlane(x, y);
      const dx = p.x - engine.areaDrag.startX;
      const dy = p.y - engine.areaDrag.startY;
      a.pts.forEach(pt => { pt[0] += dx; pt[1] += dy; });
      if (a.labelX !== undefined) { a.labelX += dx; a.labelY += dy; }
      engine.areaDrag.startX = p.x;
      engine.areaDrag.startY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.ptDrag) {
    const r = engine.ramales.find(rr => rr.id === engine.ptDrag!.id);
    if (r) {
      let p = engine.toPlane(x, y);
      const idx = engine.ptDrag.ptIdx;
      const isEndpoint = idx === 0 || idx === r.pts.length - 1;

      // Mid-ramal accessory: slide along the straight line to its neighbors only, clamped
      // between them, so the ramal's actual path never bends because of this drag.
      const accSlide = engine.ptDrag.accMedSlide;
      if (accSlide) {
        const sDx = accSlide.bx - accSlide.ax, sDy = accSlide.by - accSlide.ay;
        const sLen2 = sDx * sDx + sDy * sDy;
        let t = sLen2 > 0.0001 ? ((p.x - accSlide.ax) * sDx + (p.y - accSlide.ay) * sDy) / sLen2 : 0;
        t = Math.max(0.02, Math.min(0.98, t));
        r.pts[idx][0] = accSlide.ax + t * sDx;
        r.pts[idx][1] = accSlide.ay + t * sDy;
        engine.scheduleRender();
        return;
      }

      if (engine.snapMode) {
        const constraint = engine.ptDrag.slideConstraint;
        let snappedToConstraint = false;
        
        if (isEndpoint && constraint) {
          const other = engine.ramales.find(o => o.id === constraint.otherId);
          if (other && other.pts && other.pts.length > constraint.segmentIdx) {
            const [ax, ay] = other.pts[constraint.segmentIdx];
            const [bx, by] = other.pts[constraint.segmentIdx + 1] || [ax, ay];
            const sDx = bx - ax, sDy = by - ay;
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

        if (!snappedToConstraint) {
          if (idx === 0 && r.pts.length > 1) {
            p = engine.snapAngle(r.pts[1][0], r.pts[1][1], p.x, p.y);
          } else if (idx > 0) {
            p = engine.snapAngle(r.pts[idx - 1][0], r.pts[idx - 1][1], p.x, p.y);
          }
        }
      }

      if (isEndpoint) {
        const associatedBajantes: any[] = [];
        engine.bajantes.forEach(b => {
          const isRecibe = b.recibeDeIds?.includes(r.id);
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

        // Also snap to other bajantes/points in the canvas (snapToExisting), excluding own ones
        if (!snapped) {
          const snapThresh2 = 16 / engine.zoom;
          // Snap to other bajantes
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
          // Snap to other ramales' endpoints
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

      const dPx = p.x - oldP[0], dPy = p.y - oldP[1];
      if (Math.abs(dPx) + Math.abs(dPy) > 0.001) {
        for (const other of engine.ramales) {
          if (other.id === r.id || other.net !== r.net) continue;
          let changed = false;
          for (let i = 0; i < other.pts.length; i++) {
            if (Math.hypot(other.pts[i][0] - oldP[0], other.pts[i][1] - oldP[1]) < 0.5) {
              other.pts[i][0] += dPx;
              other.pts[i][1] += dPy;
              changed = true;
            }
          }
          if (changed) {
            other.totalL = calculateRamalLength(other.pts, engine);
            other.labelAngle = _firstSegmentAngle(other.pts);
            const [mx, my] = _midpoint(other.pts);
            other.labelX = mx;
            other.labelY = my;
          }
        }

        // Codo reventilado: the vent ramal's endpoint and the san ramal's coincident point
        // must stay exactly together, so move the linked point to the same absolute position
        // rather than by delta (avoids drift if they weren't pixel-perfect coincident already).
        if (engine.ptDrag.linkedPts) {
          for (const link of engine.ptDrag.linkedPts) {
            const other = engine.ramales.find((o) => o.id === link.id);
            if (!other || !other.pts[link.ptIdx]) continue;
            other.pts[link.ptIdx] = [p.x, p.y];
            other.totalL = calculateRamalLength(other.pts, engine);
            other.labelAngle = _firstSegmentAngle(other.pts);
            const [mx, my] = _midpoint(other.pts);
            other.labelX = mx;
            other.labelY = my;
          }
        }
          const bajForRamal = engine.bajantes.find(b =>
            b.recibeDeIds?.includes(r.id) &&
            (Math.hypot(oldP[0] - b.x, oldP[1] - b.y) < 0.5 ||
             Math.hypot(p.x - b.x, p.y - b.y) < 0.5)
          );
          if (bajForRamal) {
            bajForRamal.x += dPx;
            bajForRamal.y += dPy;
            bajForRamal.labelX = (bajForRamal.labelX || 0) + dPx;
            bajForRamal.labelY = (bajForRamal.labelY || 0) + dPy;
          }
          // Also move descargaEnId bajantes connected to this endpoint
          for (const b of engine.bajantes) {
            if (b.descargaEnId) {
              const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
              if (String(parts[0]) === String(engine._loadedPlanId) && parts[1] === r.id) {
                if (Math.hypot(oldP[0] - b.x, oldP[1] - b.y) < 0.5 || Math.hypot(p.x - b.x, p.y - b.y) < 0.5) {
                  b.x += dPx;
                  b.y += dPy;
                  b.labelX = (b.labelX || 0) + dPx;
                  b.labelY = (b.labelY || 0) + dPy;
                }
              }
            }
          }
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
      r.labelAngle = _firstSegmentAngle(r.pts);
      r.totalL = calculateRamalLength(r.pts, engine);
      const [mx, my] = _midpoint(r.pts);
      r.labelX = mx;
      r.labelY = my;
      checkRamalAngles(r.pts, r.net, r.tipo);
      engine.scheduleRender();
    }
    return;
  }
}
