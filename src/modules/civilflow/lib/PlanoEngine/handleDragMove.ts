import type { IPlanoEngineCore, PlanoRamal, PlanoBajante, PlanoArea } from './PlanoState';
import { isBajante } from './PlanoState';
import { calculateRamalLength, _midpoint, _firstSegmentAngle } from './PlanoEngineDrawing';
import { checkRamalAngles } from './drawingAngles';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';
import { recalcBilateralCrossings } from './PlanoEngineNetwork';
import { oppositeTextCorner, textLocalCorner, rotateLocalPoint } from './textAnnotationGeometry';
import { isRamalBajanteConnectionAllowed } from '../../utils/flowDirection';

export function handleDragMove(engine: IPlanoEngineCore, x: number, y: number): void {
  const sameNetGroup = (a: string, b: string) =>
    a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
  if (engine.multiDrag) {
    const tp = engine.toPlane(x, y);
    const dx = tp.x - engine.multiDrag.startX;
    const dy = tp.y - engine.multiDrag.startY;
    for (const id of Object.keys(engine.multiDrag.origData)) {
      const orig = engine.multiDrag.origData[id];
      if (!orig) continue;
      if (orig.type === 'ramal') {
        const r = engine.ramales.find((rr) => rr.id === id);
        if (r) {
          r.pts = (orig.origPts || []).map((p) => [p[0] + dx, p[1] + dy]);
          r.labelX = (orig.origLabelX || 0) + dx;
          r.labelY = (orig.origLabelY || 0) + dy;
          r.labelAngle = orig.origLabelAngle || 0;
          r.totalL = calculateRamalLength(r.pts, engine);
        }
      } else if (orig.type === 'bajante') {
        const b = engine.bajantes.find((bb) => bb.id === id);
        if (b) {
          b.x = (orig.origX || 0) + dx;
          b.y = (orig.origY || 0) + dy;
          b.labelX = (orig.origLabelX || 0) + dx;
          b.labelY = (orig.origLabelY || 0) + dy;
        }
      } else if (orig.type === 'text') {
        const t = engine.textAnnots.find((tt) => tt.id === id);
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
    const r = engine.ramales.find((rr) => rr.id === engine.ramalDrag!.id);
    // bloqueado is set to true on every ramal at creation and never unset anywhere in the
    // codebase, so gating this whole-body drag on `!r.bloqueado` silently made body-drag a
    // no-op for every ramal — including the connRamales/connBaj cascade a few lines down that's
    // the actual mechanism for moving a connected san/vent network together. A rigid whole-body
    // translation never bends the ramal's shape, so bloqueado (meant to block bending) shouldn't
    // gate it at all — matches the same fix already applied to the vertex/endpoint drag path.
    if (r) {
      const tp = engine.toPlane(x, y);
      const dx = tp.x - engine.ramalDrag.startX;
      const dy = tp.y - engine.ramalDrag.startY;

      let slideDx = dx,
        slideDy = dy;
      for (const other of engine.ramales) {
        if (other.id === r.id || !sameNetGroup(other.net, r.net)) continue;
        for (let si = 0; si < other.pts.length - 1; si++) {
          const [ax, ay] = other.pts[si],
            [bx, by] = other.pts[si + 1];
          const sDx = bx - ax,
            sDy = by - ay;
          const sLen = Math.hypot(sDx, sDy);
          if (sLen < 0.001) continue;
          const origFirst = engine.ramalDrag.origPts[0];
          const cross = Math.abs(sDx * (ay - origFirst[1]) - sDy * (ax - origFirst[0])) / sLen;
          if (cross < 0.05) {
            // Only slide-constrain against a genuine T-junction (origFirst on the interior of
            // the other segment) — not against a shared bajante corner where two ramales just
            // happen to touch at that segment's own endpoint.
            const tCheck = ((origFirst[0] - ax) * sDx + (origFirst[1] - ay) * sDy) / (sLen * sLen);
            const marginT = Math.min(0.45, 2 / sLen);
            if (tCheck <= marginT || tCheck >= 1 - marginT) continue;
            const proposedX = origFirst[0] + dx,
              proposedY = origFirst[1] + dy;
            let t = ((proposedX - ax) * sDx + (proposedY - ay) * sDy) / (sLen * sLen);
            t = Math.max(0, Math.min(1, t));
            slideDx = ax + t * sDx - origFirst[0];
            slideDy = ay + t * sDy - origFirst[1];
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
          const b = engine.bajantes.find((bb) => bb.id === cb.id);
          if (!b) continue;
          b.x = cb.origX + slideDx;
          b.y = cb.origY + slideDy;
          b.labelX = cb.origLblX + slideDx;
          b.labelY = cb.origLblY + slideDy;
        }
      }
      if (engine.ramalDrag.connRamales) {
        for (const cr of engine.ramalDrag.connRamales) {
          const other = engine.ramales.find((rr) => rr.id === cr.id);
          if (!other) continue;
          for (let i = 0; i < other.pts.length && i < cr.origPts.length; i++) {
            other.pts[i][0] = cr.origPts[i][0] + slideDx;
            other.pts[i][1] = cr.origPts[i][1] + slideDy;
          }
          other.totalL = calculateRamalLength(other.pts, engine);
          if (cr.origLabelX !== undefined && other.labelX !== undefined) {
            other.labelX = cr.origLabelX + slideDx;
          }
          if (cr.origLabelY !== undefined && other.labelY !== undefined) {
            other.labelY = cr.origLabelY + slideDy;
          }
        }
      }
      recalcBilateralCrossings(engine);
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
        let snappedPt = engine.snapAngle(b.x, b.y, b.x + dx, b.y + dy, b.net);
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
    const b = engine.bajantes.find((bb) => bb.id === engine.bajDrag!.id);
    if (b) {
      let p = engine.toPlane(x - engine.bajDrag.offX, y - engine.bajDrag.offY);
      const oldX = b.x;
      const oldY = b.y;

      // Snap mode: constrain the new bajante position to a 45°-multiple angle measured from
      // the FIXED vertex adjacent to the endpoint touching this bajante — for a bent ramal
      // (3+ points) that's the neighboring bend point, NOT the polyline's opposite terminus.
      // Anchoring on the far terminus of a multi-segment ramal measures the angle across every
      // intermediate bend, producing an arbitrary-looking angle on the segment that actually
      // moves. Picking whichever candidate anchor landed closer to the raw cursor (an even
      // older approach) almost always chose the near/self anchor instead — on a slow continuous
      // drag each frame's delta is tiny, so snapping "from itself" barely constrains anything
      // and the ramal effectively drifted freely.
      // Deliberately NOT passing the "incoming" segment to snapEndpointAngle here: filtering to
      // only turn-angle-valid candidates during the drag makes invalid angles unreachable, which
      // silently swallows the "Ángulo no recomendado" alert (checkRamalAngles on mouseup, below
      // in handleDragUp, never sees an invalid state to catch). Grid-only snapping during the
      // drag + validate-and-revert-with-alert on release matches how ptDrag/ramalDrag/drawing
      // already surface this warning.
      if (engine.snapMode) {
        const assocIds = [...(b.recibeDeIds || [])];
        if (b.descargaEnId) assocIds.push(b.descargaEnId);
        const assocRamales = (engine.ramales || []).filter(
          (r) => assocIds.includes(r.id) && r.pts && r.pts.length >= 2,
        );
        if (assocRamales.length > 0) {
          const r = assocRamales[0];
          const pStart = r.pts[0];
          const pEnd = r.pts[r.pts.length - 1];
          const distStart = Math.hypot(pStart[0] - oldX, pStart[1] - oldY);
          const distEnd = Math.hypot(pEnd[0] - oldX, pEnd[1] - oldY);
          const anchor =
            distStart <= distEnd
              ? r.pts.length > 2
                ? r.pts[1]
                : pEnd
              : r.pts.length > 2
                ? r.pts[r.pts.length - 2]
                : pStart;
          p = engine.snapAngle(anchor[0], anchor[1], p.x, p.y, r.net, r.tipo);
        }
      }

      const associatedRamales: PlanoRamal[] = [];
      if (b.recibeDeIds?.length) {
        b.recibeDeIds.forEach((rid) => {
          const r = engine.ramales.find((rr) => rr.id === rid);
          if (r) associatedRamales.push(r);
        });
      }
      if (b.descargaEnId) {
        const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
        const targetPlanId = parts[0];
        const targetId = parts[1];
        if (String(targetPlanId) === String(engine._loadedPlanId)) {
          const r = engine.ramales.find((rr) => rr.id === targetId);
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
      for (const r of engine.ramales || []) {
        if (!r.pts || r.pts.length === 0) continue;
        if (r.net !== b.net) continue;
        if ((b.recibeDeIds || []).includes(r.id)) continue;
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const dStart = Math.hypot(pStart[0] - p.x, pStart[1] - p.y);
        const dEnd = Math.hypot(pEnd[0] - p.x, pEnd[1] - p.y);
        // Flow-direction guard (centralized in flowDirection.ts): a 'baja' bajante must only
        // RECEIVE flow — never START a ramal. The guard fires once for the offending endpoint
        // and continues looking for the next ramal's FIN, so other valid associations in the
        // same drag motion are not blocked.
        if (dStart < autoThresh && dStart <= dEnd) {
          const allowed = isRamalBajanteConnectionAllowed(engine, r, 0, b);
          if (!allowed) continue;
          if (!b.recibeDeIds) b.recibeDeIds = [];
          b.recibeDeIds.push(r.id);
          r.ini = b.code || b.id;
          p.x = pStart[0];
          p.y = pStart[1];
          break;
        } else if (dEnd < autoThresh) {
          if (!b.recibeDeIds) b.recibeDeIds = [];
          b.recibeDeIds.push(r.id);
          r.fin = b.code || b.id;
          p.x = pEnd[0];
          p.y = pEnd[1];
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
        b.recibeDeIds.forEach((rid) => {
          const r = engine.ramales.find((rr) => rr.id === rid);
          if (!r || !r.pts) return;
          let changed = false;
          if (Math.hypot(r.pts[0][0] - oldX, r.pts[0][1] - oldY) < 0.5) {
            r.pts[0][0] = p.x;
            r.pts[0][1] = p.y;
            changed = true;
          }
          const lastIdx = r.pts.length - 1;
          if (Math.hypot(r.pts[lastIdx][0] - oldX, r.pts[lastIdx][1] - oldY) < 0.5) {
            r.pts[lastIdx][0] = p.x;
            r.pts[lastIdx][1] = p.y;
            changed = true;
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

      // Keep the ghost-connector ramal (Ldesvio) attached: first endpoint follows
      // the parent, second endpoint stays at fixed absolute position (ghost doesn't
      // drift with the parent — offset is compensated by the movement delta).
      if (b.desplazamientos) {
        const dxMove = p.x - oldX;
        const dyMove = p.y - oldY;
        for (const d of Object.values(b.desplazamientos)) {
          if (!d.Ldesvio) continue;
          const r = engine.ramales.find((rr) => rr.id === d.Ldesvio);
          if (!r) continue;
          r.pts[0] = [b.x, b.y];
          d.dx -= dxMove;
          d.dy -= dyMove;
          r.pts[r.pts.length - 1] = [b.x + d.dx, b.y + d.dy];
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
  if (engine.lblDrag) {
    const el =
      engine.ramales.find((r) => r.id === engine.lblDrag!.id) ||
      engine.bajantes.find((b) => b.id === engine.lblDrag!.id) ||
      engine.areas.find((a) => a.id === engine.lblDrag!.id);
    if (el) {
      const p = engine.toPlane(x - engine.lblDrag.offX, y - engine.lblDrag.offY);
      // Only a bajante has cross-floor "ghost" label positions (ghostData, keyed per floor) —
      // ramales/areas never do. Use _lblDragIsParent flag: if the drag started on the parent
      // label, update labelX/labelY; otherwise (ghost label), update ghostData. Gate on
      // isBajante(el) too, so a ramal/area label drag always writes labelX/labelY directly —
      // without it, every ramal/area label drag fell into the ghost branch (isParentDrag is
      // never set true for them) and wrote to a bogus ghostData property instead, so the label
      // never actually moved.
      const isParentDrag = !!engine._lblDragIsParent;
      if (engine.lblDrag.slot && !isBajante(el)) {
        const ramal = el as PlanoRamal;
        if (engine.lblDrag.slot === 'ini') ramal.sifonLabelIni = [p.x, p.y];
        else ramal.sifonLabelFin = [p.x, p.y];
      } else if (!isParentDrag && engine.nivelActual && isBajante(el)) {
        const baj = el;
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
    const t = engine.textAnnots.find((tt) => tt.id === engine.txtDrag!.id);
    if (t) {
      const p = engine.toPlane(x, y);
      t.x = engine.txtDrag.origX + (p.x - engine.txtDrag.startX);
      t.y = engine.txtDrag.origY + (p.y - engine.txtDrag.startY);
      engine.scheduleRender();
    }
    return;
  }
  if (engine.txtResize) {
    const t = engine.textAnnots.find((tt) => tt.id === engine.txtResize!.id);
    if (t) {
      const { corner, anchorX, anchorY, startDist, origFontMm, origBoxWpx } = engine.txtResize;
      const dist = Math.hypot(x - anchorX, y - anchorY);
      const scale = startDist > 0.01 ? Math.max(0.2, Math.min(6, dist / startDist)) : 1;
      const newFontMm = Math.max(1, Math.min(40, origFontMm * scale));
      const pad = 5 * engine.zoom;
      const newBoxWFull = Math.max(pad * 2 + 4, origBoxWpx * scale);
      t.fontMm = newFontMm;
      t.boxW = (newBoxWFull - pad * 2) / engine.zoom;

      // Keep the anchor corner (opposite of the one being dragged) pinned at its original
      // canvas position — recompute where the box's translate origin (t.x/t.y) must land so
      // the anchor corner of the NEW (resized) box still lands exactly there.
      const fs2 = engine.mm2cvs(newFontMm);
      const boxHFull2 = fs2 + pad * 2;
      const angle = ((t.textAngle || 0) * Math.PI) / 180;
      const anchorCorner = oppositeTextCorner(corner);
      const local = textLocalCorner(anchorCorner, fs2, pad, newBoxWFull, boxHFull2);
      const rot = rotateLocalPoint(local.lx, local.ly, angle);
      const newC = engine.toPlane(anchorX - rot.x, anchorY - rot.y);
      t.x = newC.x - (t.lblOffX || 0);
      t.y = newC.y - (t.lblOffY || 0);
      engine.scheduleRender();
    }
    return;
  }
  if (engine.dimLblDrag) {
    const d = engine.dims.find((dd) => dd.id === engine.dimLblDrag!.id);
    if (d) {
      const p = engine.toPlane(x - engine.dimLblDrag.offX, y - engine.dimLblDrag.offY);
      d.lblX = p.x;
      d.lblY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.dimDrag) {
    const d = engine.dims.find((dd) => dd.id === engine.dimDrag!.id);
    if (d) {
      const p = engine.toPlane(x, y);
      const dx = p.x - engine.dimDrag.startX;
      const dy = p.y - engine.dimDrag.startY;
      d.x1 += dx;
      d.y1 += dy;
      d.x2 += dx;
      d.y2 += dy;
      if (d.lblX != null && d.lblY != null) {
        d.lblX += dx;
        d.lblY += dy;
      }
      engine.dimDrag.startX = p.x;
      engine.dimDrag.startY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.areaDrag) {
    const a = engine.areas.find((aa) => aa.id === engine.areaDrag!.id);
    if (a) {
      const p = engine.toPlane(x, y);
      const dx = p.x - engine.areaDrag.startX;
      const dy = p.y - engine.areaDrag.startY;
      a.pts.forEach((pt) => {
        pt[0] += dx;
        pt[1] += dy;
      });
      if (a.labelX !== undefined) {
        a.labelX += dx;
        a.labelY += dy;
      }
      engine.areaDrag.startX = p.x;
      engine.areaDrag.startY = p.y;
      engine.scheduleRender();
    }
    return;
  }
  if (engine.ptDrag) {
    const r = engine.ramales.find((rr) => rr.id === engine.ptDrag!.id);
    if (r) {
      let p = engine.toPlane(x, y);
      const idx = engine.ptDrag.ptIdx;
      const isEndpoint = idx === 0 || idx === r.pts.length - 1;

      // Mid-ramal accessory: slide along the straight line to its neighbors only, clamped
      // between them, so the ramal's actual path never bends because of this drag.
      const accSlide = engine.ptDrag.accMedSlide;
      if (accSlide) {
        const sDx = accSlide.bx - accSlide.ax,
          sDy = accSlide.by - accSlide.ay;
        const sLen2 = sDx * sDx + sDy * sDy;
        let t =
          sLen2 > 0.0001 ? ((p.x - accSlide.ax) * sDx + (p.y - accSlide.ay) * sDy) / sLen2 : 0;
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

        // Grid-only snapping (no turn-angle filtering) so an invalid turn can still form here —
        // see the matching comment on the bajDrag branch above for why: it needs to be reachable
        // so checkRamalAngles-on-release can catch it and show "Ángulo no recomendado".
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
        engine.bajantes.forEach((b) => {
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

      const dPx = p.x - oldP[0],
        dPy = p.y - oldP[1];
      if (Math.abs(dPx) + Math.abs(dPy) > 0.001) {
        const movedRamalIds = new Set<string>([r.id]);
        const allOldPositions: number[][] = [oldP];
        let frontier: number[][] = [oldP];
        const hasBilateral = engine.ptDrag?._bilateralDrag ?? false;

        // A bilateral-tee partner crosses r at a perpendicular INTERSECTION point, which is a
        // computed geometric crossing, not necessarily an actual vertex stored in either ramal's
        // pts — so the generic "does some point of the other ramal sit exactly on the moved
        // point" cascade below can never find it, no matter how many hops it's allowed. Move
        // every ramal in r's sticky bilateralPairIds rigidly by the same delta up front, keyed
        // purely on that membership list (same source of truth collectConnectedGraph's own
        // bilateral branch uses for the whole-body drag), instead of depending on coincidence.
        if (hasBilateral) {
          for (const partnerId of r.bilateralPairIds || []) {
            if (movedRamalIds.has(partnerId)) continue;
            const partner = engine.ramales.find((rr) => rr.id === partnerId);
            if (!partner) continue;
            for (const pt of partner.pts) {
              pt[0] += dPx;
              pt[1] += dPy;
            }
            partner.totalL = calculateRamalLength(partner.pts, engine);
            partner.labelAngle = _firstSegmentAngle(partner.pts);
            const [mx, my] = _midpoint(partner.pts);
            partner.labelX = mx;
            partner.labelY = my;
            movedRamalIds.add(partnerId);
          }
        }

        let bfsIter = 0;
        while (frontier.length > 0) {
          bfsIter++;
          const nextFrontier: number[][] = [];
          for (const other of engine.ramales) {
            if (other.id === r.id || !sameNetGroup(other.net, r.net) || movedRamalIds.has(other.id))
              continue;
            let changed = false;
            // Point-vs-point: does a moved frontier point match a vertex of `other`?
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
            // Point-vs-body: does a frontier point land on `other`'s body segment (vent endpoint
            // on san body)? Mirrors frontierOnOtherBody in collectConnectedGraph.
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
                    // Shift every point of `other` rigidly
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
              other.labelAngle = _firstSegmentAngle(other.pts);
              const [mx, my] = _midpoint(other.pts);
              other.labelX = mx;
              other.labelY = my;
            }
          }
          if (hasBilateral && bfsIter >= 1) break;
          frontier = nextFrontier;
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
        recalcBilateralCrossings(engine);
        // Move every bajante that discharges from any ramal swept up in the cascade above (not
        // just the directly-dragged one), matched against the cascade's old positions.
        for (const b of engine.bajantes) {
          const feedsMoved = b.recibeDeIds?.some((rid) => movedRamalIds.has(rid));
          const nearOld = allOldPositions.some((op) => Math.hypot(b.x - op[0], b.y - op[1]) < 0.5);
          if (feedsMoved && nearOld) {
            b.x += dPx;
            b.y += dPy;
            b.labelX = (b.labelX || 0) + dPx;
            b.labelY = (b.labelY || 0) + dPy;
            continue;
          }
          if (b.descargaEnId) {
            const parts = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
            if (
              String(parts[0]) === String(engine._loadedPlanId) &&
              movedRamalIds.has(parts[1]) &&
              nearOld
            ) {
              b.x += dPx;
              b.y += dPy;
              b.labelX = (b.labelX || 0) + dPx;
              b.labelY = (b.labelY || 0) + dPy;
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
