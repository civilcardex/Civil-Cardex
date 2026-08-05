import type { IPlanoEngineCore } from './PlanoState';
import type { PlanoRamal } from './PlanoState';
import { NETS } from './PlanoState';
import { checkRamalAngles, _firstSegmentAngle, detectAccesorioTrigger } from './drawingAngles';
import { autoSplitJunctionAndSumFlow } from './PlanoEngineDrawing';
import {
  updateCrossFloorGhostPositionBySource,
  updateCrossFloorLdesvioFarEndpoint,
  updateCrossFloorDesplazamientoBySource,
  buildLdesvioRamal,
  ldesvioIdFor,
} from '../../utils/associateBajanteAcrossFloors';

// San/ll/vent junctions (tee/codo/yee) auto-create via calcSanitaryAccessories + renderJunctions
// — only AF/AC/gas need user selection for tee tipo.
function checkAccesorioTrigger(engine: IPlanoEngineCore, ramalId: string): void {
  if (!engine.triggerAccesorioModal) return;
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r) return;
  if (r.net !== 'af' && r.net !== 'ac' && r.net !== 'gas') return;
  // Tee salida bilateral: a perpendicular crossing newly detected on this ramal — surface a
  // dedicated confirmation prompt that explains the count will go to the existing ramal.
  const bilateral = engine._pendingBilateral;
  if (bilateral) {
    engine._pendingBilateral = null;
    engine.triggerAccesorioModal({
      ramalId: bilateral.ramalId,
      angleDeg: 90,
      junctionIndex: -1,
      point: bilateral.point,
      net: r.net,
      isTee: true,
      isBilateral: true,
    });
    return;
  }
  const trigger = detectAccesorioTrigger(engine, ramalId);
  if (trigger) engine.triggerAccesorioModal(trigger);
}

// Draw-time (handleLineDown) already blocks connecting a tributario to any ramal other than its
// selected padre, but that only guards fresh drawing — dragging an EXISTING tributario's endpoint
// (or its whole body) onto a different ramal had no equivalent check at all, silently letting a
// drag re-anchor it to the wrong ramal. Fires only when an endpoint now sits on another ramal's
// own vertex (a real reconnection), not just anywhere near it.
function draggedOntoWrongPadre(engine: IPlanoEngineCore, ram: PlanoRamal): boolean {
  if (!ram.pts || ram.pts.length < 2) return false;
  const TOL = 0.5;
  for (const ep of [ram.pts[0], ram.pts[ram.pts.length - 1]]) {
    for (const other of engine.ramales) {
      if (other.id === ram.id || other.net !== ram.net) continue;
      const touches = other.pts?.some(([x, y]) => Math.hypot(x - ep[0], y - ep[1]) < TOL);
      if (!touches || other.id === ram.padre) continue;
      // AC/AF/gas tributario-to-tributario join is allowed when both tributarios share the same
      // selected padre — same rule as autoSplitJunctionAndSumFlow (draw path).
      if (
        other.tipo === 'tributario' &&
        (other.net === 'af' || other.net === 'ac' || other.net === 'gas') &&
        other.padre === ram.padre
      ) {
        continue;
      }
      return true;
    }
  }
  return false;
}

// Endpoint drags that snap ONTO a bajante (handleDragMove pins the point exactly to the bajante)
// must survive the release check even when the final angle is off the network's grid — reverting
// would undo the very connection the user just made. When possible, rotate the ramal around the
// bajante (kept fixed) to the nearest valid step angle instead. Rotation is rigid (internal turns
// and segment lengths preserved), so it can only fix absolute segment-step violations — and only
// for straight 2-point runs: in a multi-point ramal every segment would shift by the same delta,
// pushing the already-valid interior segments off-grid again. The opposite end must be free too —
// a swing around the bajante would silently detach a junction or another bajante connection.
function tryRotateToValidAngle(
  engine: IPlanoEngineCore,
  ram: PlanoRamal,
  ptIdx: number,
  linkedOk: boolean,
): boolean {
  if (!linkedOk) return false;
  if (ram.net === 'san' || ram.net === 'll') return false;
  const pts = ram.pts;
  if (!pts || pts.length !== 2) return false;
  const anchorIdx = ptIdx === 0 ? 0 : 1;
  const [ax, ay] = pts[anchorIdx];
  const baj = engine.bajantes.find(
    (b) => b.net === ram.net && Math.hypot(b.x - ax, b.y - ay) < 1.5,
  );
  if (!baj) return false;
  const opp = pts[1 - anchorIdx];
  const TOL = 0.5;
  for (const other of engine.ramales) {
    if (other.id === ram.id) continue;
    if (other.pts?.some(([x, y]) => Math.hypot(x - opp[0], y - opp[1]) < TOL)) return false;
  }
  if (
    engine.bajantes.some((b) => b.id !== baj.id && Math.hypot(b.x - opp[0], b.y - opp[1]) < TOL)
  ) {
    return false;
  }
  const step =
    ram.net === 'gas' || ((ram.net === 'af' || ram.net === 'ac') && ram.tipo === 'tributario')
      ? 90
      : 45;
  const dx = opp[0] - ax,
    dy = opp[1] - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.1) return false;
  const curDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const snappedDeg = Math.round(curDeg / step) * step;
  if (Math.abs(snappedDeg - curDeg) < 1) return false;
  const rad = (snappedDeg * Math.PI) / 180;
  pts[1 - anchorIdx] = [ax + len * Math.cos(rad), ay + len * Math.sin(rad)];
  return checkRamalAngles(pts, ram.net, ram.tipo);
}

export function handleDragUp(engine: IPlanoEngineCore, isCtrl: boolean = false): void {
  if (engine.marqueeRect) {
    const { x1, y1, x2, y2 } = engine.marqueeRect;
    const minX = Math.min(x1, x2),
      maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2),
      maxY = Math.max(y1, y2);
    const w = maxX - minX,
      h = maxY - minY;
    engine.marqueeRect = null;
    if (w >= 3 || h >= 3) {
      if (!isCtrl) {
        engine.multiSel = [];
      }
      engine.ramales.forEach((r) => {
        let inside = false;
        const lc = engine.toCvs(r.labelX || 0, r.labelY || 0);
        if (lc.x >= minX && lc.x <= maxX && lc.y >= minY && lc.y <= maxY) inside = true;
        if (!inside) {
          for (const pt of r.pts) {
            const c = engine.toCvs(pt[0], pt[1]);
            if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
              inside = true;
              break;
            }
          }
        }
        if (!inside && r.pts.length >= 2) {
          for (let i = 0; i < r.pts.length - 1; i++) {
            const p1 = engine.toCvs(r.pts[i][0], r.pts[i][1]);
            const p2 = engine.toCvs(r.pts[i + 1][0], r.pts[i + 1][1]);
            let t0 = 0,
              t1 = 1;
            const dx = p2.x - p1.x,
              dy = p2.y - p1.y;
            const p = [-dx, dx, -dy, dy];
            const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];
            let ok = true;
            for (let k = 0; k < 4; k++) {
              if (p[k] === 0) {
                if (q[k] < 0) {
                  ok = false;
                  break;
                }
              } else {
                const t = q[k] / p[k];
                if (p[k] < 0) t0 = Math.max(t0, t);
                else t1 = Math.min(t1, t);
                if (t0 > t1) {
                  ok = false;
                  break;
                }
              }
            }
            if (ok) {
              inside = true;
              break;
            }
          }
        }
        if (inside && !engine.multiSel.includes(r.id)) engine.multiSel.push(r.id);
      });
      engine.bajantes.forEach((b) => {
        const c = engine.toCvs(b.x, b.y);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
          if (!engine.multiSel.includes(b.id)) engine.multiSel.push(b.id);
        }
      });
      engine.textAnnots.forEach((t) => {
        const c = engine.toCvs(t.x, t.y);
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
          if (!engine.multiSel.includes(t.id)) engine.multiSel.push(t.id);
        }
      });
      engine.selId = null;
      engine._emitSelect(null);
    }
    engine.render();
    return;
  }
  if (engine.multiDrag) {
    engine.multiDrag = null;
    engine._markDirty();
    engine.render();
  }
  if (engine.ghostDrag) {
    const b = engine.bajantes.find((bb) => bb.id === engine.ghostDrag!.id);
    if (b && engine.nivelActual && b.desplazamientos?.[engine.nivelActual.label ?? '']) {
      const d = b.desplazamientos[engine.nivelActual.label ?? ''];
      if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1) {
        delete b.desplazamientos[engine.nivelActual.label ?? ''];
      } else {
        // Create the "Ldesvio" ramal between parent (b.x, b.y) and ghost (b.x + d.dx, b.y + d.dy)
        // if it doesn't exist yet — this is the visual connector between the parent and the ghost.
        const oldLdesvio = d.Ldesvio;
        if (!oldLdesvio) {
          const net = NETS.find((n) => n.id === b.net);
          const pfx = net ? net.lbl : 'R';
          const cnt = ++engine._netCounts[b.net].ramal;
          const ramId = pfx + cnt;
          const ldesvioPts = [
            [b.x, b.y],
            [b.x + d.dx, b.y + d.dy],
          ];
          const ramal: PlanoRamal = {
            id: ramId,
            net: b.net,
            tipo: 'ramal',
            padre: null,
            pts: ldesvioPts,
            totalL: +engine.pxToM(Math.hypot(d.dx, d.dy)).toFixed(3),
            label: pfx + cnt,
            ini: '',
            fin: '',
            piso: String(engine.nivelActual?.n ?? ''),
            dz: '',
            uc: 0,
            labelX: (b.x + b.x + d.dx) / 2,
            labelY: (b.y + b.y + d.dy) / 2,
            labelAngle: _firstSegmentAngle(ldesvioPts),
            material: '',
            diametro: '',
            pendiente: 2,
            bloqueado: true,
          };
          engine.ramales.push(ramal);
          d.Ldesvio = ramId;
          engine._emitStatus(`Desplazamiento conectado: ${ramId}`);
        }
      }
    }
    engine.ghostDrag = null;
    engine.render();
    engine._markDirty();
  }
  if (engine.lblDrag) {
    engine._markDirty();
    engine.lblDrag = null;
  }
  if (engine.txtDrag) {
    engine._markDirty();
    engine.txtDrag = null;
  }
  if (engine.txtResize) {
    engine._markDirty();
    engine.txtResize = null;
  }
  if (engine.canalResizeDrag) {
    engine._markDirty();
    engine.canalResizeDrag = null;
  }
  if (engine.dimLblDrag) {
    engine._markDirty();
    engine.dimLblDrag = null;
  }
  if (engine.bajDrag) {
    const bId = engine.bajDrag.id;
    engine.bajDrag = null;
    engine._markDirty();
    const b = engine.bajantes.find((bb) => bb.id === bId);
    const backupPts = engine._bajDragBackupPts;
    const backupXY = engine._bajDragBackupXY;
    engine._bajDragBackupPts = null;
    engine._bajDragBackupXY = null;
    if (b && backupPts) {
      const assocIds = Object.keys(backupPts);
      const assocRamales = assocIds
        .map((rid) => engine.ramales.find((r) => r.id === rid))
        .filter((r): r is PlanoRamal => !!r);
      const allOk = assocRamales.every((r) => checkRamalAngles(r.pts, r.net, r.tipo));
      if (!allOk) {
        const bad = assocRamales.find((r) => !checkRamalAngles(r.pts, r.net, r.tipo))!;
        engine.triggerAlert(
          'Ángulo no recomendado',
          bad.net === 'san' || bad.net === 'll'
            ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
            : 'Esta red debe diseñarse con ángulos de 45° o 90°.',
        );
        if (backupXY) {
          b.x = backupXY.x;
          b.y = backupXY.y;
          if (backupXY.labelX !== undefined) b.labelX = backupXY.labelX;
          if (backupXY.labelY !== undefined) b.labelY = backupXY.labelY;
        }
        for (const r of assocRamales) {
          if (backupPts[r.id]) r.pts = backupPts[r.id];
        }
        engine._markDirty();
        engine.render();
      }
    }
    // Whatever the final x/y ended up being (post-rollback included), push it to any cross-floor
    // ghost this bajante is the source of, so the mirror on the other floor stays aligned — and
    // to its own Ldesvio connector's near end, which lives on this SAME floor (live array) since
    // the connector always belongs to the source's own floor.
    if (b && b.descargaEnId) {
      const [targetPlanId] = b.descargaEnId.split('|');
      const sourcePlanId = String(engine._loadedPlanId ?? '');
      if (targetPlanId) {
        updateCrossFloorGhostPositionBySource(sourcePlanId, b.id, b.x, b.y);
        if (String(targetPlanId) === sourcePlanId) {
          engine.crossFloorGhosts = engine.crossFloorGhosts.map((g) =>
            g.sourcePlanId === sourcePlanId && g.sourceBajanteId === b.id
              ? { ...g, x: b.x, y: b.y }
              : g,
          );
        }
        const ldId = ldesvioIdFor(b.id);
        const ld = engine.ramales.find((r) => r.id === ldId);
        if (ld && ld.pts?.length === 2) {
          const [, far] = ld.pts;
          const updated = buildLdesvioRamal(
            ldId,
            ld.label || ldId,
            ld.net,
            b.x,
            b.y,
            far[0],
            far[1],
            ld.diametro || '',
            Number(ld.piso) || 0,
            engine.scaleM || 0.5,
            ld.bloqueado,
          );
          Object.assign(ld, updated);
          // Re-anchor the displaced-circle marker to the (unchanged) far endpoint: the ring is
          // drawn at b.x + dx, so keeping dx/dy constant would drag it along with the source
          // instead of leaving it anchored at the target's projected position.
          const lvl = engine.nivelActual?.label ?? '';
          const desp = lvl ? b.desplazamientos?.[lvl] : undefined;
          if (desp) {
            desp.dx = far[0] - b.x;
            desp.dy = far[1] - b.y;
            engine._markDirty();
          }
        }
        engine.render();
      }
    }
    // This bajante is the TARGET side of some other (possibly remote-floor) bajante's link — its
    // Ldesvio's far endpoint lives over there, unreachable through the live engine, so it's synced
    // via a direct storage write instead.
    if (b && b.origenId) {
      const [originPlanId, originBajanteId] = b.origenId.split('|');
      if (originPlanId && originBajanteId) {
        updateCrossFloorLdesvioFarEndpoint(originPlanId, originBajanteId, b.x, b.y);
        updateCrossFloorDesplazamientoBySource(originPlanId, originBajanteId, b.x, b.y);
      }
    }
  }
  if (engine.areaDrag) {
    engine._markDirty();
    engine.areaDrag = null;
  }
  if (engine.dimDrag) {
    engine._markDirty();
    engine.dimDrag = null;
  }
  if (engine.ptDrag) {
    const rId = engine.ptDrag.id;
    const linkedPts = engine.ptDrag.linkedPts;
    const ptIdx = engine.ptDrag.ptIdx;
    engine.ptDrag = null;
    engine._markDirty();
    const ram = engine.ramales.find((r) => r.id === rId);
    const linkedRamales = (linkedPts || [])
      .map((l) => engine.ramales.find((r) => r.id === l.id))
      .filter((r): r is PlanoRamal => !!r);

    // A codo reventilado's san/vent pair must be rolled back together — if only one side
    // reverted, the drag would leave the junction split apart instead of just undone.
    const primaryOk = ram ? checkRamalAngles(ram.pts, ram.net, ram.tipo) : true;
    const linkedOk = linkedRamales.every((r) => checkRamalAngles(r.pts, r.net, r.tipo));

    if (ram && (!primaryOk || !linkedOk)) {
      // An endpoint drag that SNAPPED onto a bajante (handleDragMove pins the point exactly to
      // the bajante) must not roll back — losing the connection the user just made is worse than
      // losing the exact cursor spot. Rotate the ramal around the bajante (kept fixed) to the
      // nearest valid step angle instead. Rotation is rigid, so only absolute segment-step
      // violations are fixable this way; internal turn violations still roll back below.
      const rotatedOk = tryRotateToValidAngle(engine, ram, ptIdx, linkedOk);
      if (rotatedOk) {
        engine._dragBackupPts = null;
        engine._dragLinkedBackupPts = null;
        engine._markDirty();
        engine.render();
      } else {
        engine.triggerAlert(
          'Ángulo no recomendado',
          ram.net === 'san' || ram.net === 'll'
            ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
            : 'Esta red debe diseñarse con ángulos de 45° o 90°.',
        );
        if (engine._dragBackupPts) {
          ram.pts = engine._dragBackupPts;
          engine._dragBackupPts = null;
        }
        const linkedBackups = engine._dragLinkedBackupPts;
        if (linkedBackups) {
          for (const r of linkedRamales) {
            if (linkedBackups[r.id]) r.pts = linkedBackups[r.id];
          }
        }
        engine._dragLinkedBackupPts = null;
        engine._markDirty();
        engine.render();
      }
    } else if (ram && ram.tipo === 'tributario' && draggedOntoWrongPadre(engine, ram)) {
      engine.triggerAlert(
        'Ramal padre incorrecto',
        'Solo puedes conectar el tributario al ramal padre seleccionado.',
      );
      if (engine._dragBackupPts) {
        ram.pts = engine._dragBackupPts;
        engine._dragBackupPts = null;
      }
      engine._dragLinkedBackupPts = null;
      engine._markDirty();
      engine.render();
    } else {
      engine._dragLinkedBackupPts = null;
      if (ram) {
        autoSplitJunctionAndSumFlow(engine, ram);
        checkAccesorioTrigger(engine, ram.id);
      }
    }
  }
  if (engine.ramalDrag) {
    const rId = engine.ramalDrag.id;
    const origPts = engine.ramalDrag.origPts;
    engine.ramalDrag = null;
    engine._markDirty();
    const ram = engine.ramales.find((r) => r.id === rId);
    // If this ramal is a Ldesvio, dragging it also carried its source bajante along (see
    // handleDragMove.ts) — any rollback below must revert that too, and any successful drop must
    // propagate the bajante's new position to the other floor's storage, same as a direct bajDrag
    // already does.
    const srcBajId = rId.startsWith('LD_') ? rId.slice(3) : null;
    const srcBaj = srcBajId ? engine.bajantes.find((b) => b.id === srcBajId) : null;
    const origSrcXY = srcBaj ? { x: srcBaj.x, y: srcBaj.y } : null;
    if (ram && !checkRamalAngles(ram.pts, ram.net, ram.tipo)) {
      engine.triggerAlert(
        'Ángulo no recomendado',
        ram.net === 'san' || ram.net === 'll'
          ? 'Las redes sanitarias y de lluvias solo permiten ángulos de 45°.'
          : 'Esta red debe diseñarse con ángulos de 45° o 90°.',
      );
      if (origPts) {
        ram.pts = origPts;
        if (srcBaj && origSrcXY) {
          srcBaj.x = origSrcXY.x;
          srcBaj.y = origSrcXY.y;
        }
        engine._markDirty();
        engine.render();
      }
    } else if (ram && ram.tipo === 'tributario' && draggedOntoWrongPadre(engine, ram)) {
      engine.triggerAlert(
        'Ramal padre incorrecto',
        'Solo puedes conectar el tributario al ramal padre seleccionado.',
      );
      if (origPts) {
        ram.pts = origPts;
        engine._markDirty();
        engine.render();
      }
    } else if (ram) {
      if (srcBaj) {
        const sourcePlanId = String(engine._loadedPlanId ?? '');
        updateCrossFloorGhostPositionBySource(sourcePlanId, srcBaj.id, srcBaj.x, srcBaj.y);
      } else {
        autoSplitJunctionAndSumFlow(engine, ram);
        checkAccesorioTrigger(engine, ram.id);
      }
    }
  }
}
