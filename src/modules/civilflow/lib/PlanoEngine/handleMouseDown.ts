import type {
  IPlanoEngineCore,
  PlanoBajante,
  PlanoElement,
  PlanoRamal,
  MultiDragOrigData,
} from './PlanoState';
import {
  isBajante,
  isRamal,
  isTextAnnotation,
  isArea,
  isDimension,
  ensureActiveNet,
} from './PlanoState';
import {
  pointInLabelBox,
  pointToSegmentDist,
  distanceToRamal,
  findAccMedVertexHit,
} from './HitTester';
import { getSelected } from './PlanoEngineSelection';
import { selectAt } from './PlanoEngineSelection';
import { findCodoReventiladoLinks } from './PlanoEngineNetwork';
import { parseDescargaEnId } from '../../utils/parseDescargaEnId';

// True only when the bajante actually sits ON one of the ramal's endpoints — i.e. the connection
// is rigid, not just the green dashed guide line drawn between two separate points. A bloqueado
// ramal should only block the bajante's own move when the two are already touching; while a
// dashed line is still showing (not yet snapped) the designer needs to freely slide the bajante
// over to connect it, lock or no lock.
// Ventilación is a subnet of sanitaria — san and vent ramales can connect at shared bajantes and
// move as a single connected network, so the cascade treats them as one net group everywhere.
function sameNetGroup(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

// BFS over shared endpoints, transitively — starting from a ramal being dragged, finds every
// ramal reachable by a chain of touching endpoints (or tributario-of-a-reachable-ramal), plus
// every bajante that discharges from any ramal in that reachable set. Used so dragging one ramal
// carries its whole connected network with it instead of only its direct (1-hop) neighbors.
export function collectConnectedGraph(
  engine: IPlanoEngineCore,
  startRamal: PlanoRamal,
): {
  ramales: { id: string; origPts: [number, number][]; origLabelX?: number; origLabelY?: number }[];
  bajantes: {
    id: string;
    origX: number;
    origY: number;
    origLblX: number;
    origLblY: number;
    atIdx: number;
  }[];
} {
  const TOL = 0.5;
  const visitedRamales = new Set<string>([startRamal.id]);
  // Frontier tracks each frontier point alongside the ramal id it came from — required so we
  // can check the ramal's bilateralCrossings (cross-perpendicular tee salida bilateral links)
  // when deciding which neighbour to pull into the cascade next.
  type FrontierPt = { pt: number[]; fromId: string };
  let frontier: FrontierPt[] = [
    { pt: startRamal.pts[0], fromId: startRamal.id },
    { pt: startRamal.pts[startRamal.pts.length - 1], fromId: startRamal.id },
  ];
  const resultRamales: {
    id: string;
    origPts: [number, number][];
    origLabelX?: number;
    origLabelY?: number;
  }[] = [];

  const startNet = startRamal.net;

  // A ramal "touches" the cascade frontier if ANY of its points (not just endpoints) is on top
  // of a frontier point. Critical for the san↔vent case: a vent ramal that passes THROUGH a
  // san ramal's junction (interior vertex, not endpoint) would be missed by endpoint-only checks.
  const touchesAt = (other: PlanoRamal, pt: number[]) =>
    other.pts.some((p) => Math.hypot(p[0] - pt[0], p[1] - pt[1]) < TOL);

  // Same-direction check: does the OTHER ramal have a bilateral crossing at any frontier point?
  const nearBilateral = (other: PlanoRamal, fp: number[]) =>
    (other.bilateralCrossings || []).some((c) => Math.hypot(c[0] - fp[0], c[1] - fp[1]) < TOL);

  // Quick lookup of any visited ramal by id for the reverse-direction check below.
  const allRamalesById = new Map(engine.ramales.map((rr) => [rr.id, rr]));

  while (frontier.length > 0) {
    const nextFrontier: FrontierPt[] = [];
    for (const other of engine.ramales) {
      if (visitedRamales.has(other.id) || !sameNetGroup(other.net, startNet) || !other.pts?.length)
        continue;
      const touchesFrontier = frontier.some((fp) => touchesAt(other, fp.pt));
      // Bilateral tee salida bilateral: the FROM ramal owns a bilateralCrossings entry at some
      // frontier point AND the OTHER ramal has the matching crossing. The crossing is at the
      // INTERIOR of both ramales (perpendicular tee), not at endpoints — that's why we add the
      // crossing points to the frontier when a ramal joins, so the perpendicular neighbour can
      // find the link next iteration.
      const fromBilateral = frontier.some((fp) => {
        const fromR = allRamalesById.get(fp.fromId);
        return !!fromR && nearBilateral(fromR, fp.pt) && nearBilateral(other, fp.pt);
      });
      const isTributarioChild = !!other.padre && visitedRamales.has(other.padre);
      if (touchesFrontier || fromBilateral || isTributarioChild) {
        visitedRamales.add(other.id);
        const oStart = other.pts[0],
          oEnd = other.pts[other.pts.length - 1];
        resultRamales.push({
          id: other.id,
          origPts: other.pts.map((pt) => [...pt] as [number, number]),
          origLabelX: other.labelX,
          origLabelY: other.labelY,
        });
        nextFrontier.push({ pt: oStart, fromId: other.id });
        nextFrontier.push({ pt: oEnd, fromId: other.id });
        // Also seed the frontier with this ramal's bilateral crossings — the perpendicular
        // neighbour must be discoverable from the next iteration's BFS. Without this, a tee
        // bilateral crossing (which sits in the INTERIOR of both ramales, not at any endpoint)
        // never makes it into the frontier and the perpendicular ramal never joins the cascade.
        for (const cp of other.bilateralCrossings || []) {
          nextFrontier.push({ pt: cp, fromId: other.id });
        }
      }
    }
    // Also walk THROUGH bajantes: a ramal connected to a bajante at the frontier position joins
    // the cascade too. This is the san→bajante→vent hop that direct endpoint sharing misses.
    for (const b of engine.bajantes) {
      if (!sameNetGroup(b.net, startNet)) continue;
      const touchesFrontier = frontier.some(
        (fp) => Math.hypot(b.x - fp.pt[0], b.y - fp.pt[1]) < TOL,
      );
      if (!touchesFrontier) continue;
      for (const other of engine.ramales) {
        if (
          visitedRamales.has(other.id) ||
          !sameNetGroup(other.net, startNet) ||
          !other.pts?.length
        )
          continue;
        const oStart = other.pts[0],
          oEnd = other.pts[other.pts.length - 1];
        const nearBaj =
          Math.hypot(oStart[0] - b.x, oStart[1] - b.y) < TOL ||
          Math.hypot(oEnd[0] - b.x, oEnd[1] - b.y) < TOL ||
          other.pts.some((p) => Math.hypot(p[0] - b.x, p[1] - b.y) < TOL);
        if (!nearBaj) continue;
        const isTributarioChild = !!other.padre && visitedRamales.has(other.padre);
        if (nearBaj || isTributarioChild) {
          visitedRamales.add(other.id);
          resultRamales.push({
            id: other.id,
            origPts: other.pts.map((pt) => [...pt] as [number, number]),
            origLabelX: other.labelX,
            origLabelY: other.labelY,
          });
          nextFrontier.push({ pt: oStart, fromId: other.id });
          nextFrontier.push({ pt: oEnd, fromId: other.id });
        }
      }
    }
    frontier = nextFrontier;
  }

  const resultBajantes: {
    id: string;
    origX: number;
    origY: number;
    origLblX: number;
    origLblY: number;
    atIdx: number;
  }[] = [];
  for (const b of engine.bajantes) {
    if (!sameNetGroup(b.net, startNet)) continue;
    if (!b.recibeDeIds?.some((rid) => visitedRamales.has(rid))) continue;
    // atIdx is legacy/unused downstream — kept only to satisfy the existing ramalDrag.connBaj shape.
    resultBajantes.push({
      id: b.id,
      origX: b.x,
      origY: b.y,
      origLblX: b.labelX ?? b.x,
      origLblY: b.labelY ?? b.y,
      atIdx: 0,
    });
  }

  return { ramales: resultRamales, bajantes: resultBajantes };
}

function _bajanteTouchesRamalEnd(b: PlanoBajante, r: { pts: number[][] } | undefined): boolean {
  if (!r || !r.pts?.length) return false;
  const pStart = r.pts[0];
  const pEnd = r.pts[r.pts.length - 1];
  return (
    Math.hypot(pStart[0] - b.x, pStart[1] - b.y) < 0.5 ||
    Math.hypot(pEnd[0] - b.x, pEnd[1] - b.y) < 0.5
  );
}

function _bajanteBlockedByRamalLock(engine: IPlanoEngineCore, b: PlanoBajante): boolean {
  const ramalIds = new Set<string>(b.recibeDeIds || []);
  if (b.descargaEnId) {
    const [targetPlanId, targetId] = parseDescargaEnId(b.descargaEnId, engine._loadedPlanId);
    if (String(targetPlanId) === String(engine._loadedPlanId)) ramalIds.add(targetId);
  }
  for (const rid of ramalIds) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (r?.bloqueado && _bajanteTouchesRamalEnd(b, r)) return true;
  }
  return false;
}

// Snapshot the bajante's position and every ramal it touches (recibeDeIds, descargaEnId, and
// its own Ldesvio ghost-connector) before a bajDrag starts, so handleDragUp can validate the
// resulting angles the same way ptDrag/ramalDrag already do — and revert + alert if invalid.
function _captureBajDragBackup(engine: IPlanoEngineCore, b: PlanoBajante): void {
  engine._bajDragBackupXY = { x: b.x, y: b.y, labelX: b.labelX, labelY: b.labelY };
  const assocIds = [...(b.recibeDeIds || [])];
  if (b.descargaEnId) assocIds.push(b.descargaEnId);
  const lvl = engine.nivelActual?.label ?? '';
  const ldesvioId = b.desplazamientos?.[lvl]?.Ldesvio;
  if (ldesvioId) assocIds.push(ldesvioId);
  const backup: Record<string, number[][]> = {};
  for (const rid of assocIds) {
    const r = engine.ramales.find((rr) => rr.id === rid);
    if (r) backup[rid] = structuredClone(r.pts);
  }
  engine._bajDragBackupPts = backup;
}

function _tryBajanteHit(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
): boolean {
  // Scan all bajantes, pick best label match (parent preferred over ghost, closer preferred)
  let bestB: (typeof engine.bajantes)[0] | null = null;
  let bestDist = Infinity;
  let bestIsGhost = false;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 40) {
      if (ensureActiveNet(engine, b.net)) return true;
      const isGhost = b.pisoBase !== engine.nivelActual?.label;
      if (!bestB || (!isGhost && bestIsGhost) || (isGhost === bestIsGhost && d < bestDist)) {
        bestB = b;
        bestDist = d;
        bestIsGhost = isGhost;
      }
    }
    // Contador/calentador label at offset position
    if (b.tipo === 'contador' || b.tipo === 'calentador') {
      const clx = b.labelX ?? b.x - 25;
      const cly = b.labelY ?? b.y;
      const clPos = engine.toCvs(clx, cly);
      const cd = Math.hypot(x - clPos.x, y - clPos.y);
      if (cd < 50) {
        if (ensureActiveNet(engine, b.net)) return true;
        if (!bestB || cd < bestDist) {
          bestB = b;
          bestDist = cd;
          bestIsGhost = false;
        }
      }
    }
    // Symbol hit (only if no label match found)
    if (!bestB) {
      const circ = b._circ;
      if (circ && Math.hypot(x - circ.x, y - circ.y) < circ.r) {
        if (ensureActiveNet(engine, b.net)) return true;
        if (b.id !== sel?.id) {
          engine.selId = b.id;
          engine._emitSelect(b);
          engine.render();
        }
        if (!_bajanteBlockedByRamalLock(engine, b)) {
          engine.bajDrag = { id: b.id, offX: x - circ.x, offY: y - circ.y };
          _captureBajDragBackup(engine, b);
        }
        return true;
      }
    }
  }
  if (bestB) {
    const lPos = engine.toCvs(bestB.labelX ?? bestB.x, bestB.labelY ?? bestB.y + 20);
    if (bestB.id !== sel?.id) {
      engine.selId = bestB.id;
      engine._emitSelect(bestB);
      engine.render();
    }
    engine._lblDragIsParent = true;
    engine.lblDrag = { id: bestB.id, offX: x - lPos.x, offY: y - lPos.y };
    return true;
  }
  return false;
}

function _tryRamalEndpointHit(engine: IPlanoEngineCore, x: number, y: number): boolean {
  let bestRamal = null;
  let bestPtIdx = -1;
  let minPtDist = 15;
  // A ghost bajante's desvío ramal has an endpoint sitting exactly at the ghost's displaced
  // position, so a click on the ghost symbol also falls within this endpoint's tolerance —
  // without this, the endpoint hit below wins first and steals the click from the ghost.
  const lvl = engine.nivelActual?.label ?? '';
  const ghostPts = engine.getBajantesFantasma().map((b) => {
    const disp = b.desplazamientos?.[lvl];
    return { x: b.x + (disp ? disp.dx : 0), y: b.y + (disp ? disp.dy : 0) };
  });
  for (const r of engine.ramales) {
    if (engine._hiddenNets.has(r.net)) continue;
    if (r.pts && r.pts.length >= 2) {
      for (const i of [0, r.pts.length - 1]) {
        const pc = engine.toCvs(r.pts[i][0], r.pts[i][1]);
        const d = Math.hypot(x - pc.x, y - pc.y);
        if (d < minPtDist) {
          const epP = r.pts[i];
          const bajAtEp = engine.bajantes.find(
            (b) => Math.abs(b.x - epP[0]) < 0.1 && Math.abs(b.y - epP[1]) < 0.1,
          );
          const ghostAtEp = ghostPts.some(
            (g) => Math.abs(g.x - epP[0]) < 0.1 && Math.abs(g.y - epP[1]) < 0.1,
          );
          if (bajAtEp || ghostAtEp) continue;
          minPtDist = d;
          bestRamal = r;
          bestPtIdx = i;
        }
      }
    }
  }
  if (!bestRamal) return false;

  if (ensureActiveNet(engine, bestRamal.net)) return true;
  engine.selId = bestRamal.id;
  engine.multiSel = [];
  engine._emitSelect(bestRamal);
  if (bestRamal.bloqueado) {
    engine.render();
    return true;
  }

  let slideConstraint = undefined;
  {
    // Strictly same-net only — an endpoint must never slide-constrain against a segment from a
    // different red just because it happens to be visually close.
    const pt = bestRamal.pts[bestPtIdx];
    for (const other of engine.ramales) {
      if (other.id === bestRamal.id || other.net !== bestRamal.net) continue;
      for (let si = 0; si < other.pts.length - 1; si++) {
        const [ax, ay] = other.pts[si],
          [bx, by] = other.pts[si + 1];
        const sDx = bx - ax,
          sDy = by - ay;
        const sLen = Math.hypot(sDx, sDy);
        if (sLen < 0.001) continue;
        const cross = Math.abs(sDx * (ay - pt[1]) - sDy * (ax - pt[0])) / sLen;
        if (cross < 0.05) {
          // Only a genuine T-junction (pt sitting on the INTERIOR of the other segment)
          // should slide-constrain. Two ramales that merely converge at a shared bajante
          // corner also pass the cross check here since they touch at that segment's own
          // endpoint — excluding the outer margin tells those two cases apart.
          const t = ((pt[0] - ax) * sDx + (pt[1] - ay) * sDy) / (sLen * sLen);
          const marginT = Math.min(0.45, 2 / sLen);
          if (t > marginT && t < 1 - marginT) {
            slideConstraint = { otherId: other.id, segmentIdx: si };
            break;
          }
        }
      }
      if (slideConstraint) break;
    }
  }

  const codoLinks = findCodoReventiladoLinks(engine, bestRamal, bestPtIdx);
  if (codoLinks.length > 0) {
    const backups: Record<string, number[][]> = {};
    for (const link of codoLinks) {
      const other = engine.ramales.find((r) => r.id === link.id);
      if (other) backups[link.id] = structuredClone(other.pts);
    }
    engine._dragLinkedBackupPts = backups;
  } else {
    engine._dragLinkedBackupPts = null;
  }

  engine._dragBackupPts = structuredClone(bestRamal.pts);
  engine.ptDrag = {
    id: bestRamal.id,
    ptIdx: bestPtIdx,
    slideConstraint,
    linkedPts: codoLinks.length > 0 ? codoLinks : undefined,
  };
  engine.render();
  return true;
}

function _tryMultiSelDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  isMultiSelectModifier: boolean,
): boolean {
  if (engine.multiSel.length === 0 || engine.tool !== 'sel') return false;

  for (const id of engine.multiSel) {
    let hit = false;
    const re = engine.ramales.find((r) => r.id === id);
    if (re && re.pts) {
      for (let i = 0; i < re.pts.length; i++) {
        const pc = engine.toCvs(re.pts[i][0], re.pts[i][1]);
        if (Math.hypot(x - pc.x, y - pc.y) < 12) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let i = 0; i < re.pts.length - 1; i++) {
          const p1 = engine.toCvs(re.pts[i][0], re.pts[i][1]);
          const p2 = engine.toCvs(re.pts[i + 1][0], re.pts[i + 1][1]);
          if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 8) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        const d = distanceToRamal(x, y, re.pts, (px, py) => engine.toCvs(px, py), engine.mm2cvs(4));
        if (d < 12) hit = true;
      }
      if (!hit && re._labelBox && pointInLabelBox(x, y, re._labelBox)) hit = true;
    }
    const be = engine.bajantes.find((b) => b.id === id);
    if (!hit && be) {
      if (be._circ) hit = Math.hypot(x - be._circ.x, y - be._circ.y) < be._circ.r;
      if (!hit && be._labelBox && pointInLabelBox(x, y, be._labelBox)) hit = true;
    }
    const te = engine.textAnnots.find((t) => t.id === id);
    if (!hit && te && te._box) {
      hit =
        x >= te._box.x &&
        x <= te._box.x + te._box.w &&
        y >= te._box.y &&
        y <= te._box.y + te._box.h;
    }
    if (hit) {
      if (!isMultiSelectModifier) {
        const tp = engine.toPlane(x, y);
        const origData: MultiDragOrigData = {};
        for (const mid of engine.multiSel) {
          const mel = engine.ramales.find((r) => r.id === mid);
          if (mel) {
            origData[mid] = {
              type: 'ramal',
              origPts: mel.pts.map((p) => [...p]),
              origLabelX: mel.labelX,
              origLabelY: mel.labelY,
              origLabelAngle: mel.labelAngle || 0,
            };
            continue;
          }
          const mba = engine.bajantes.find((b) => b.id === mid);
          if (mba) {
            origData[mid] = {
              type: 'bajante',
              origX: mba.x,
              origY: mba.y,
              origLabelX: mba.labelX,
              origLabelY: mba.labelY,
            };
            continue;
          }
          const mtx = engine.textAnnots.find((t) => t.id === mid);
          if (mtx) {
            origData[mid] = { type: 'text', origX: mtx.x, origY: mtx.y };
          }
        }
        engine.multiDrag = { startX: tp.x, startY: tp.y, origData };
      }
      return true;
    }
  }
  return false;
}

function _trySelBajanteDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
  wasGhostSel: boolean,
): boolean {
  if (
    !isBajante(sel) ||
    !(
      sel.tipo === 'bajante' ||
      sel.tipo === 'montante' ||
      sel.tipo === 'red_publica' ||
      sel.tipo === 'contador' ||
      sel.tipo === 'calentador' ||
      sel.id?.startsWith('B')
    )
  )
    return false;

  if (ensureActiveNet(engine, sel.net)) return true;
  if (sel._labelBox && pointInLabelBox(x, y, sel._labelBox)) {
    const lPos = engine.toCvs(sel.labelX, sel.labelY);
    engine._lblDragIsParent = true;
    engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
    return true;
  }
  if (sel.labelX != null && sel.labelY != null) {
    const lPos = engine.toCvs(sel.labelX, sel.labelY);
    if (Math.hypot(x - lPos.x, y - lPos.y) < 30) {
      engine._lblDragIsParent = true;
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return true;
    }
  }
  const circ = sel._circ!;
  const d = Math.hypot(x - circ.x, y - circ.y);
  if (d < circ.r) {
    if (wasGhostSel && !sel.isFantasma) {
      engine._isGhostSel = false;
      engine._emitSelect(sel);
      engine.render();
    }
    if (sel.isFantasma) {
      // Allow parent bajante to be moved normally via bajDrag
      if (!_bajanteBlockedByRamalLock(engine, sel)) {
        engine.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
        _captureBajDragBackup(engine, sel);
      }
    } else {
      if (!_bajanteBlockedByRamalLock(engine, sel)) {
        engine.bajDrag = { id: sel.id, offX: x - circ.x, offY: y - circ.y };
        _captureBajDragBackup(engine, sel);
      }
    }
    return true;
  }
  return false;
}

function _trySelDimDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
): boolean {
  if (!isDimension(sel)) return false;
  const dist = distanceToRamal(
    x,
    y,
    [
      [sel.x1, sel.y1],
      [sel.x2, sel.y2],
    ],
    (px, py) => engine.toCvs(px, py),
    2,
  );
  if (dist < 15) {
    const tp = engine.toPlane(x, y);
    engine.dimDrag = { id: sel.id, startX: tp.x, startY: tp.y };
    return true;
  }
  return false;
}

function _trySelRamalDrag(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  sel: PlanoElement | null,
): boolean {
  if (!isRamal(sel) || !sel.id?.startsWith('R')) return false;

  // Mid-ramal accessory icons are drawn offset from the pipe centerline (renderRamales.ts), so a
  // click on the visible icon can miss the tight per-vertex radius below. Check the icon's wider
  // footprint first so clicking the icon itself — not just the exact underlying vertex — starts
  // the slide-along-body drag. This is allowed on bloqueado ramales because the slide never
  // bends the ramal's actual path — only the accessory position changes.
  const accIdx = findAccMedVertexHit(
    sel.pts,
    sel.accMed,
    (px, py) => engine.toCvs(px, py),
    x,
    y,
    engine.realMmToCanvasPx(23) * 0.6 + 8,
  );
  if (accIdx !== null) {
    const a = sel.pts[accIdx - 1],
      b = sel.pts[accIdx + 1];
    engine._dragBackupPts = structuredClone(sel.pts);
    engine.ptDrag = {
      id: sel.id,
      ptIdx: accIdx,
      accMedSlide: { ax: a[0], ay: a[1], bx: b[0], by: b[1] },
    };
    return true;
  }

  for (let i = 0; i < sel.pts.length; i++) {
    const pc = engine.toCvs(sel.pts[i][0], sel.pts[i][1]);
    if (Math.hypot(x - pc.x, y - pc.y) < 15) {
      // Endpoint/vertex drag bends the ramal's shape — bloqueado blocks this.
      if (sel.bloqueado) return false;
      let slideConstraint = undefined;
      const isEndpoint = i === 0 || i === sel.pts.length - 1;
      // An accessory drawn mid-body (accMed) can be moved, but only sliding along the straight
      // line to its neighbors — it must not bend the ramal's actual path.
      if (!isEndpoint && sel.accMed && sel.accMed[`accMed${i}`]) {
        const a = sel.pts[i - 1],
          b = sel.pts[i + 1];
        engine._dragBackupPts = structuredClone(sel.pts);
        engine.ptDrag = {
          id: sel.id,
          ptIdx: i,
          accMedSlide: { ax: a[0], ay: a[1], bx: b[0], by: b[1] },
        };
        return true;
      }
      if (isEndpoint) {
        // A connected endpoint (bajante or accessory) is NOT blocked from dragging — it goes
        // through the exact same snap-angle-constrained ptDrag path as a free endpoint (below),
        // which already propagates the move rigidly to any attached bajante/ramal. Blocking it
        // outright just pushed users onto the unconstrained body-drag path instead.
        const pt = sel.pts[i];
        for (const other of engine.ramales) {
          if (other.id === sel.id || !sameNetGroup(other.net, sel.net)) continue;
          for (let si = 0; si < other.pts.length - 1; si++) {
            const [ax, ay] = other.pts[si],
              [bx, by] = other.pts[si + 1];
            const sDx = bx - ax,
              sDy = by - ay;
            const sLen = Math.hypot(sDx, sDy);
            if (sLen < 0.001) continue;
            const cross = Math.abs(sDx * (ay - pt[1]) - sDy * (ax - pt[0])) / sLen;
            if (cross < 0.05) {
              // Same T-junction-only rule as the other slideConstraint computation above —
              // exclude the case where pt just touches the OTHER segment's own endpoint
              // (e.g. two ramales converging at the same bajante).
              const t = ((pt[0] - ax) * sDx + (pt[1] - ay) * sDy) / (sLen * sLen);
              const marginT = Math.min(0.45, 2 / sLen);
              if (t > marginT && t < 1 - marginT) {
                slideConstraint = { otherId: other.id, segmentIdx: si };
                break;
              }
            }
          }
          if (slideConstraint) break;
        }
      }
      const codoLinks = findCodoReventiladoLinks(engine, sel, i);
      if (codoLinks.length > 0) {
        const backups: Record<string, number[][]> = {};
        for (const link of codoLinks) {
          const other = engine.ramales.find((r) => r.id === link.id);
          if (other) backups[link.id] = structuredClone(other.pts);
        }
        engine._dragLinkedBackupPts = backups;
      } else {
        engine._dragLinkedBackupPts = null;
      }

      engine._dragBackupPts = structuredClone(sel.pts);
      engine.ptDrag = {
        id: sel.id,
        ptIdx: i,
        slideConstraint,
        linkedPts: codoLinks.length > 0 ? codoLinks : undefined,
      };
      return true;
    }
  }
  for (let i = 0; i < sel.pts.length - 1; i++) {
    const p1 = engine.toCvs(sel.pts[i][0], sel.pts[i][1]);
    const p2 = engine.toCvs(sel.pts[i + 1][0], sel.pts[i + 1][1]);
    if (pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y) < 6) {
      const tp = engine.toPlane(x, y);
      const origPts = sel.pts.map((pt: number[]) => [...pt] as [number, number]);
      // Ramales/tributarios connected transitively (through a chain of shared endpoints, or as a
      // tributario of anything in that chain) move together as a rigid body, so the connection
      // doesn't tear apart when dragging an unlocked ramal — not just its direct (1-hop) neighbors.
      const { ramales: connRamales, bajantes: connBaj } = collectConnectedGraph(engine, sel);
      engine.ramalDrag = {
        id: sel.id,
        startX: tp.x,
        startY: tp.y,
        origPts,
        connBaj,
        connRamales,
        origLabelX: sel.labelX,
        origLabelY: sel.labelY,
      };
      return true;
    }
  }
  return false;
}

export function handleSelectDown(
  engine: IPlanoEngineCore,
  x: number,
  y: number,
  isMultiSelectModifier: boolean = false,
): void {
  const wasGhostSel = engine._isGhostSel;
  engine._isGhostSel = false;
  engine._lblDragIsParent = false;
  // A cross-floor association ghost's selection (selectedGhostId) must never survive past this
  // click — cleared unconditionally up front so ANY other hit below (a real bajante's label, a
  // ramal, etc.) starts from a clean slate. Re-set below only if THIS click actually lands on a
  // ghost's own circle.
  if (engine.tool === 'sel' && !isMultiSelectModifier && engine.selectedGhostId) {
    engine.selectedGhostId = null;
  }
  // FIRST: check all bajante labels — simple, no prioritisation games
  let labelBest: { id: string; x: number; y: number; isParent: boolean } | null = null;
  let labelBestDist = Infinity;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 30) {
      if (ensureActiveNet(engine, b.net)) return;
      const isParent = b.pisoBase === engine.nivelActual?.label;
      if (
        !labelBest ||
        (isParent && !labelBest.isParent) ||
        (isParent === labelBest.isParent && d < labelBestDist)
      ) {
        labelBest = { id: b.id, x: x - lPos.x, y: y - lPos.y, isParent };
        labelBestDist = d;
      }
    }
  }
  if (labelBest) {
    engine.selId = labelBest.id;
    engine._lblDragIsParent = labelBest.isParent;
    const b = engine.bajantes.find((bb) => bb.id === labelBest!.id);
    if (b) engine._emitSelect(b);
    engine.lblDrag = { id: labelBest.id, offX: labelBest.x, offY: labelBest.y };
    engine.render();
    return;
  }
  const sel = getSelected(engine);

  // Cross-floor association ghost (associateBajanteAcrossFloors.ts) — pure reference marker, its
  // own selection state (selectedGhostId), never drives ramal/bajante selection or dragging.
  // selectedGhostId was already cleared unconditionally above; only re-set it if THIS click
  // actually lands on a ghost's own circle.
  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    for (const g of engine.crossFloorGhosts) {
      if (!g._hitCircle) continue;
      const gDist = Math.hypot(x - g._hitCircle.x, y - g._hitCircle.y);
      if (gDist >= g._hitCircle.r) continue;
      // A real bajante sitting right next to this reference marker must always win if it's
      // genuinely closer to the click — the ghost is secondary, never allowed to eclipse a real,
      // editable element.
      let realIsCloser = false;
      for (const b of engine.bajantes) {
        const c = engine.toCvs(b.x, b.y);
        if (Math.hypot(x - c.x, y - c.y) < gDist) {
          realIsCloser = true;
          break;
        }
        const lx = b.labelX ?? b.x,
          ly = b.labelY ?? b.y + 20;
        const lPos = engine.toCvs(lx, ly);
        if (Math.hypot(x - lPos.x, y - lPos.y) < gDist) {
          realIsCloser = true;
          break;
        }
      }
      if (realIsCloser) continue;
      engine.selectedGhostId = g.id;
      engine.selId = null;
      engine.render();
      return;
    }
  }

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryBajanteHit(engine, x, y, sel)) return;
  }

  if (engine.tool === 'sel' && !isMultiSelectModifier) {
    if (_tryRamalEndpointHit(engine, x, y)) return;
  }

  if (_tryMultiSelDrag(engine, x, y, isMultiSelectModifier)) return;

  if (engine.multiSel.length > 0 && !isMultiSelectModifier) {
    engine.multiSel = [];
  }

  if (_trySelBajanteDrag(engine, x, y, sel, wasGhostSel)) return;
  if (_trySelDimDrag(engine, x, y, sel)) return;
  if (_trySelRamalDrag(engine, x, y, sel)) return;

  if (sel && 'labelX' in sel && !sel.id?.startsWith('T')) {
    if (sel._labelBox && pointInLabelBox(x, y, sel._labelBox)) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
      return;
    }
    if (
      !(
        isBajante(sel) &&
        (sel.tipo === 'bajante' ||
          sel.tipo === 'montante' ||
          sel.tipo === 'red_publica' ||
          sel.tipo === 'contador' ||
          sel.tipo === 'calentador' ||
          sel.id?.startsWith('B'))
      )
    ) {
      const lPos = engine.toCvs(sel.labelX!, sel.labelY!);
      if (Math.hypot(x - lPos.x, y - lPos.y) < 12) {
        engine.lblDrag = { id: sel.id, offX: x - lPos.x, offY: y - lPos.y };
        return;
      }
    }
  }

  if (isTextAnnotation(sel) && sel._box && sel.id?.startsWith('T')) {
    const b = sel._box;
    const cornerX = b.x + b.w,
      cornerY = b.y + b.h;
    if (Math.hypot(x - cornerX, y - cornerY) < 10) {
      engine.txtResize = {
        id: sel.id,
        boxX: b.x,
        boxY: b.y,
        startDist: Math.hypot(cornerX - b.x, cornerY - b.y),
        origFontMm: sel.fontMm || 2.5,
        origBoxWpx: b.w,
      };
      return;
    }
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      const tp = engine.toPlane(x, y);
      engine.txtDrag = { id: sel.id, startX: tp.x, startY: tp.y, origX: sel.x, origY: sel.y };
      return;
    }
  }

  if (isArea(sel) && sel.id?.startsWith('AR') && sel._polyBox) {
    const pb = sel._polyBox;
    if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
      for (const b of engine.bajantes) {
        if (b._circ) {
          const d = Math.hypot(x - b._circ.x, y - b._circ.y);
          if (d < b._circ.r) {
            selectAt(engine, x, y, isMultiSelectModifier);
            return;
          }
        }
      }
      const fg = engine.getBajantesFantasma();
      for (const b of fg) {
        if (b._ghost) {
          const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
          if (d < b._ghost.r) {
            selectAt(engine, x, y, isMultiSelectModifier);
            return;
          }
        }
      }
      const tp = engine.toPlane(x, y);
      engine.areaDrag = { id: sel.id, startX: tp.x, startY: tp.y };
      return;
    }
  }

  for (const t of engine.textAnnots) {
    if (t._box) {
      const b = t._box;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        engine.selId = t.id;
        const tp = engine.toPlane(x, y);
        engine.txtDrag = { id: t.id, startX: tp.x, startY: tp.y, origX: t.x, origY: t.y };
        engine._emitSelect(t);
        engine.render();
        return;
      }
    }
  }

  for (const a of engine.areas) {
    if (a._labelBox && pointInLabelBox(x, y, a._labelBox)) {
      engine.selId = a.id;
      const lPos = engine.toCvs(a.labelX, a.labelY);
      engine.lblDrag = { id: a.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(a);
      engine.render();
      return;
    }
  }

  for (const a of engine.areas) {
    if (a._polyBox) {
      const b = a._polyBox;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        let bajAtPos = false;
        for (const bb of engine.bajantes) {
          if (bb._circ && Math.hypot(x - bb._circ.x, y - bb._circ.y) < bb._circ.r) {
            bajAtPos = true;
            break;
          }
        }
        if (!bajAtPos) {
          const fg = engine.getBajantesFantasma();
          for (const bb of fg) {
            if (bb._ghost && Math.hypot(x - bb._ghost.x, y - bb._ghost.y) < bb._ghost.r) {
              bajAtPos = true;
              break;
            }
          }
        }
        if (bajAtPos) break;
        engine.selId = a.id;
        const tp = engine.toPlane(x, y);
        engine.areaDrag = { id: a.id, startX: tp.x, startY: tp.y };
        engine._emitSelect(a);
        engine.render();
        return;
      }
    }
  }

  for (const r of engine.ramales) {
    const lPos = engine.toCvs(r.labelX, r.labelY);
    const inBox = r._labelBox && pointInLabelBox(x, y, r._labelBox);
    const nearPoint = Math.hypot(x - lPos.x, y - lPos.y) < 12;
    if (inBox || nearPoint) {
      if (ensureActiveNet(engine, r.net)) return;
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  // Sifón accessory label ("S D=...") — its own draggable box, separate from the ramal's main
  // label, one per end since a ramal can carry a sifón at both extremes.
  for (const r of engine.ramales) {
    const slots: Array<{ slot: 'ini' | 'fin'; box: typeof r._sifonLabelBoxIni }> = [
      { slot: 'ini', box: r._sifonLabelBoxIni },
      { slot: 'fin', box: r._sifonLabelBoxFin },
    ];
    for (const { slot, box } of slots) {
      if (!box || !pointInLabelBox(x, y, box)) continue;
      if (ensureActiveNet(engine, r.net)) return;
      engine.selId = r.id;
      engine.lblDrag = { id: r.id, offX: x - box.cx, offY: y - box.cy, slot };
      engine._emitSelect(r);
      engine.render();
      return;
    }
  }

  // Direct label hit test using only labelX/labelY — bypasses potential _labelBox issues.
  let bestB: (typeof engine.bajantes)[0] | null = null;
  let bestDist = Infinity;
  let bestIsGhost = false;
  for (const b of engine.bajantes) {
    const lx = b.labelX ?? b.x;
    const ly = b.labelY ?? b.y + 20;
    const lPos = engine.toCvs(lx, ly);
    const d = Math.hypot(x - lPos.x, y - lPos.y);
    if (d < 40) {
      if (ensureActiveNet(engine, b.net)) return;
      const isGhost = b.pisoBase !== engine.nivelActual?.label;
      // Prefer non-ghost (parent) over ghost, and closer over farther
      if (!bestB || (!isGhost && bestIsGhost) || (isGhost === bestIsGhost && d < bestDist)) {
        bestB = b;
        bestDist = d;
        bestIsGhost = isGhost;
      }
    }
  }
  if (bestB) {
    const lPos = engine.toCvs(bestB.labelX ?? bestB.x, bestB.labelY ?? bestB.y + 20);
    engine.selId = bestB.id;
    engine._emitSelect(bestB);
    engine._lblDragIsParent = true;
    engine.lblDrag = { id: bestB.id, offX: x - lPos.x, offY: y - lPos.y };
    engine.render();
    return;
  }

  const fg = engine.getBajantesFantasma();
  let gFound: PlanoBajante | null = null,
    gMin = Infinity;

  for (const b of fg) {
    if (b._ghostLabelBox && pointInLabelBox(x, y, b._ghostLabelBox)) {
      if (ensureActiveNet(engine, b.net)) return;
      engine.selId = b.id;
      engine._isGhostSel = true;
      // The ghost always gets its own independent label position (ghostData per level) — it
      // must never be redirected to drag the parent's label instead.
      const gd = b.ghostData?.[engine.nivelActual?.label ?? ''] || {};
      let lx: number, ly: number;
      if (gd.labelX != null && gd.labelY != null) {
        lx = gd.labelX;
        ly = gd.labelY;
      } else {
        const disp = b.desplazamientos?.[engine.nivelActual?.label ?? ''];
        const gx = b.x + (disp ? disp.dx : 0);
        const gy = b.y + (disp ? disp.dy : 0);
        let ghostAngle = 0;
        const firstRamal = b.recibeDeIds?.length
          ? engine.ramales.find((rr) => rr.id === b.recibeDeIds![0])
          : engine.ramales.find(
              (rr) => rr.pts?.length && Math.hypot(rr.pts[0][0] - gx, rr.pts[0][1] - gy) < 12,
            );
        if (firstRamal && firstRamal.pts && firstRamal.pts.length >= 2) {
          const dx = firstRamal.pts[1][0] - firstRamal.pts[0][0];
          const dy = firstRamal.pts[1][1] - firstRamal.pts[0][1];
          if (Math.hypot(dx, dy) > 0.1) {
            ghostAngle = Math.atan2(dy, dx);
          }
        } else {
          ghostAngle = ((b.labelAngle || 0) * Math.PI) / 180;
        }
        const c = engine.toCvs(gx, gy);
        const distPx = engine.mm2cvs(15);
        const cLx = c.x + distPx * Math.cos(ghostAngle);
        const cLy = c.y + distPx * Math.sin(ghostAngle);
        const pL = engine.toPlane(cLx, cLy);
        lx = pL.x;
        ly = pL.y;
      }
      const lPos = engine.toCvs(lx, ly);
      const dGhost = Math.hypot(x - lPos.x, y - lPos.y);
      // Before committing to ghost: check if any non-ghost parent label is closer
      let bestParent: typeof b | null = null,
        bestPDist = Infinity;
      for (const pb of engine.bajantes) {
        if (pb.pisoBase !== engine.nivelActual?.label) continue;
        const plx = pb.labelX ?? pb.x;
        const ply = pb.labelY ?? pb.y + 20;
        const pp = engine.toCvs(plx, ply);
        const pd = Math.hypot(x - pp.x, y - pp.y);
        if (pd < 40 && pd < bestPDist) {
          bestParent = pb;
          bestPDist = pd;
        }
      }
      if (bestParent && bestPDist < dGhost) {
        engine._isGhostSel = false;
        engine._lblDragIsParent = true;
        const pp = engine.toCvs(
          bestParent.labelX ?? bestParent.x,
          bestParent.labelY ?? bestParent.y + 20,
        );
        engine.lblDrag = { id: bestParent.id, offX: x - pp.x, offY: y - pp.y };
        engine._emitSelect(bestParent);
        engine.render();
        return;
      }
      engine._lblDragIsParent = false;
      engine.lblDrag = { id: b.id, offX: x - lPos.x, offY: y - lPos.y };
      engine._emitSelect(b);
      engine.render();
      return;
    }
  }

  for (const b of fg) {
    if (b._ghost) {
      const d = Math.hypot(x - b._ghost.x, y - b._ghost.y);
      if (d < b._ghost.r && d < gMin) {
        gMin = d;
        gFound = b as PlanoBajante;
      }
    }
  }
  if (gFound) {
    if (ensureActiveNet(engine, gFound.net)) return;
    engine.selId = gFound.id;
    engine._isGhostSel = true;
    engine._emitSelect(gFound);
    engine.render();
    engine.ghostDrag = {
      id: gFound.id,
      startX: x,
      startY: y,
      baseDx: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dx || 0,
      baseDy: gFound.desplazamientos?.[engine.nivelActual?.label ?? '']?.dy || 0,
    };
    return;
  }
  selectAt(engine, x, y, isMultiSelectModifier);
  if (
    engine.tool === 'sel' &&
    !engine.ptDrag &&
    !engine.ramalDrag &&
    !engine.bajDrag &&
    !engine.ghostDrag &&
    !engine.lblDrag &&
    !engine.txtDrag &&
    !engine.areaDrag &&
    !engine.dimDrag &&
    !engine.multiDrag &&
    !engine.selId
  ) {
    if (!isMultiSelectModifier) {
      engine.multiSel = [];
    }
    engine.marqueeRect = { x1: x, y1: y, x2: x, y2: y };
  }
}
