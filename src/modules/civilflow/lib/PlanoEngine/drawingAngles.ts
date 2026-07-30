import { pointToSegmentDist } from './HitTester';
import type { IPlanoEngineCore } from './PlanoState';

// San + vent share junctions as one subnet — the same accessor helper the cascade drag uses,
// hoisted here so every detection path can check the resolved-accesorio sweep against both.
function sameNetGroup(a: string, b: string): boolean {
  return a === b || ((a === 'san' || a === 'vent') && (b === 'san' || b === 'vent'));
}

/** Validates that all segment angles and internal turn angles in a ramal's point list conform to network-specific constraints. @returns true if valid. */
export function checkRamalAngles(pts: number[][], net: string, tipo?: string): boolean {
  if (pts.length < 2) return true;
  const isSanOrLl = net === 'san' || net === 'll';
  const isGas = net === 'gas';
  const isTributarioAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';

  if (!isSanOrLl) {
    const requiredStep = isTributarioAcAf || isGas ? 90 : 45;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1,
        dy = y2 - y1;
      if (Math.hypot(dx, dy) < 0.1) continue;
      const deg = Math.round(((((Math.atan2(dy, dx) * 180) / Math.PI) % 360) + 360) % 360);
      const rem = deg % requiredStep;
      if (rem > 1 && rem < requiredStep - 1) {
        return false;
      }
    }
  }

  for (let i = 0; i < pts.length - 2; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2];

    const dx1 = x2 - x1,
      dy1 = y2 - y1;
    const dx2 = x3 - x2,
      dy2 = y3 - y2;
    if (Math.hypot(dx1, dy1) < 0.1 || Math.hypot(dx2, dy2) < 0.1) continue;

    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);
    const dot = dx1 * dx2 + dy1 * dy2;
    const cosVal = dot / (len1 * len2);
    const turnAngle = (Math.acos(Math.max(-1, Math.min(1, cosVal))) * 180) / Math.PI;
    const internalAngle = 180 - turnAngle;

    if (isSanOrLl) {
      if (internalAngle < 134) {
        return false;
      }
    } else if (isGas) {
      if (Math.abs(internalAngle - 90) > 10 && Math.abs(internalAngle - 180) > 1) {
        return false;
      }
    } else {
      if (internalAngle < 50) {
        return false;
      }
    }
  }

  return true;
}

/** Tests whether two line segments (a1-a2, b1-b2) intersect, excluding endpoint-touching. @returns true if they cross strictly in the interior. */
export function segmentsIntersect(a1: number[], a2: number[], b1: number[], b2: number[]): boolean {
  const [x1, y1] = a1,
    [x2, y2] = a2,
    [x3, y3] = b1,
    [x4, y4] = b2;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return false;
  const ix = x1 + t * (x2 - x1);
  const iy = y1 + t * (y2 - y1);
  const dA1 = Math.hypot(ix - x1, iy - y1);
  const dA2 = Math.hypot(ix - x2, iy - y2);
  const dB1 = Math.hypot(ix - x3, iy - y3);
  const dB2 = Math.hypot(ix - x4, iy - y4);
  if (dA1 < 0.001 || dA2 < 0.001 || dB1 < 0.001 || dB2 < 0.001) return false;
  return true;
}

/** Returns the angle (in degrees, -90..90) of the first segment in a point list, for label orientation. */
export function _firstSegmentAngle(pts: number[][]): number {
  if (pts.length < 2) return 0;
  const dx = pts[1][0] - pts[0][0];
  const dy = pts[1][1] - pts[0][1];
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return Math.round(angle);
}

/** Snaps a cursor to 45° projection points along another ramal's segments (for tributary-to-padre connections). @returns snapped point or null. */
export function snapTributaryToPadre45Deg(
  cursorX: number,
  cursorY: number,
  lastX: number,
  lastY: number,
  pts: number[][],
  threshold: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;

  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = x2 - x1,
      dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);
    const ux = dx / len,
      uy = dy / len;

    const tLast = ((lastX - x1) * dx + (lastY - y1) * dy) / lenSq;
    const projX = x1 + tLast * dx;
    const projY = y1 + tLast * dy;

    const perpDist = Math.hypot(lastX - projX, lastY - projY);

    const q1x = projX + ux * perpDist;
    const q1y = projY + uy * perpDist;
    const q2x = projX - ux * perpDist;
    const q2y = projY - uy * perpDist;

    const checkPoint = (qx: number, qy: number) => {
      const t = ((qx - x1) * dx + (qy - y1) * dy) / lenSq;
      if (t >= 0 && t <= 1) {
        const d = Math.hypot(cursorX - qx, cursorY - qy);
        if (d < minD && d <= threshold) {
          minD = d;
          best = { x: qx, y: qy };
        }
      }
    };
    checkPoint(q1x, q1y);
    checkPoint(q2x, q2y);
    checkPoint(projX, projY);
  }
  return best;
}

/** Computes the strict intersection point of two segments (excluding endpoints at t=0 or t=1). @returns [x, y] or null. */
export function segmentStrictIntersectionPoint(
  a1: number[],
  a2: number[],
  b1: number[],
  b2: number[],
): number[] | null {
  const [x1, y1] = a1,
    [x2, y2] = a2,
    [x3, y3] = b1,
    [x4, y4] = b2;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  if (t <= 0.01 || t >= 0.99 || u <= 0.01 || u >= 0.99) return null;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/** Like segmentStrictIntersectionPoint but allows endpoint intersections (t/u in [0,1], not just (0.01,0.99)). Catches TEE formations where one ramal ends at the crossing point. */
export function segmentLooseIntersectionPoint(
  a1: number[],
  a2: number[],
  b1: number[],
  b2: number[],
): number[] | null {
  const [x1, y1] = a1,
    [x2, y2] = a2,
    [x3, y3] = b1,
    [x4, y4] = b2;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

// Detects a codo formed where this ramal's endpoint meets ANOTHER ramal's endpoint at (roughly)
// the same point — unlike an internal-vertex check (consecutive points of the SAME ramal), this
// covers two separately-drawn ramales joining end-to-end, or a drag that newly aligns one
// ramal's endpoint with another's.
/** Detects when a ramal's endpoint meets another separately-drawn ramal's endpoint, forming a codo (elbow) junction. @returns angle and other ramal id, or null. */
export function detectJunctionAccesorio(
  engine: IPlanoEngineCore,
  ramalId: string,
  epIdx: number,
): { angleDeg: number; otherRamalId: string } | null {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return null;
  const ep = r.pts[epIdx];
  const otherIdxInR = epIdx === 0 ? 1 : r.pts.length - 2;
  const awayRx = r.pts[otherIdxInR][0] - ep[0],
    awayRy = r.pts[otherIdxInR][1] - ep[1];
  const lenR = Math.hypot(awayRx, awayRy);
  if (lenR < 0.001) return null;

  const TOL = 0.5;
  for (const r2 of engine.ramales) {
    if (r2.id === r.id || !sameNetGroup(r2.net, r.net)) continue;
    if (!r2.pts || r2.pts.length < 2) continue;
    for (const j of [0, r2.pts.length - 1]) {
      const p2 = r2.pts[j];
      if (Math.hypot(p2[0] - ep[0], p2[1] - ep[1]) >= TOL) continue;
      const otherIdxInR2 = j === 0 ? 1 : r2.pts.length - 2;
      const awayR2x = r2.pts[otherIdxInR2][0] - p2[0],
        awayR2y = r2.pts[otherIdxInR2][1] - p2[1];
      const lenR2 = Math.hypot(awayR2x, awayR2y);
      if (lenR2 < 0.001) continue;
      const dot = (awayRx * awayR2x + awayRy * awayR2y) / (lenR * lenR2);
      const rawAngle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
      const turnAngle = 180 - rawAngle;
      if (Math.abs(turnAngle - 45) < 5 || Math.abs(turnAngle - 90) < 5) {
        const snapped = Math.abs(turnAngle - 45) < Math.abs(turnAngle - 90) ? 45 : 90;
        return { angleDeg: snapped, otherRamalId: r2.id };
      }
    }
  }
  return null;
}

export interface AccesorioTrigger {
  ramalId: string;
  angleDeg: number;
  junctionIndex: number;
  point: number[];
  net: string;
  isTee: boolean;
  isBilateral?: boolean;
}

// Single source of truth for "does this ramal need the accesorio-selection modal right now",
// used both right after a ramal is drawn and after a drag ends — a junction can be created
// either way (two separate ramales joined by drawing, or by dragging one into a new ramal).
// Skips a junction that already has a resolved accesorio/aparato there, so it doesn't nag on
// every subsequent drag once the user has answered it.
/** Determines whether a ramal needs the accesorio-selection modal (tee/codo/yee) at any of its unresolved endpoints or interior vertices. @returns trigger info or null. */
export function detectAccesorioTrigger(
  engine: IPlanoEngineCore,
  ramalId: string,
): AccesorioTrigger | null {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return null;

  const lastIdx = r.pts.length - 1;
  const endpointResolved = (idx: number) =>
    idx === 0 ? !!(r.accesorioInicio || r.aparatoInicio) : !!(r.accesorioFin || r.aparatoFin);

  for (const epIdx of [0, lastIdx]) {
    if (endpointResolved(epIdx)) continue;
    const ep = r.pts[epIdx];
    const tee = isTeeAtEndpoint(ep, engine, r.id, r.net);
    if (tee.isTee && tee.throughRamalId) {
      // Already-resolved tee: if ANY ramal at this junction point already has an accessory
      // (placed by a previous modal selection), don't re-trigger the popup.
      const TOL = 0.5;
      let alreadyResolved = false;
      for (const rr of engine.ramales) {
        if (!sameNetGroup(rr.net, r.net) || !rr.pts || rr.id === r.id) continue;
        if (rr.accesorioInicio && Math.hypot(rr.pts[0][0] - ep[0], rr.pts[0][1] - ep[1]) < TOL) {
          alreadyResolved = true;
          break;
        }
        if (
          rr.accesorioFin &&
          Math.hypot(rr.pts[rr.pts.length - 1][0] - ep[0], rr.pts[rr.pts.length - 1][1] - ep[1]) <
            TOL
        ) {
          alreadyResolved = true;
          break;
        }
        if (rr.accMed) {
          for (const [k, v] of Object.entries(rr.accMed)) {
            const m = k.match(/^accMed(\d+)$/);
            if (!m || !v) continue;
            const p = rr.pts[parseInt(m[1], 10)];
            if (p && Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL) {
              alreadyResolved = true;
              break;
            }
          }
          if (alreadyResolved) break;
        }
      }
      if (alreadyResolved) continue;
      return {
        ramalId: tee.throughRamalId,
        angleDeg: 90,
        junctionIndex: -1,
        point: ep,
        net: r.net,
        isTee: true,
      };
    }
  }

  const isGas = r.net === 'gas';
  for (const epIdx of [0, lastIdx]) {
    if (endpointResolved(epIdx)) continue;
    const ep = r.pts[epIdx];
    // If ANY other ramal at this endpoint already wears an accesorio, the junction is resolved —
    // don't pop the modal again just because a codo angle happens to exist here too.
    let epAlreadyResolved = false;
    {
      const TOL = 0.5;
      for (const rr of engine.ramales) {
        if (!sameNetGroup(rr.net, r.net) || !rr.pts || rr.id === r.id) continue;
        if (rr.accesorioInicio && Math.hypot(rr.pts[0][0] - ep[0], rr.pts[0][1] - ep[1]) < TOL) {
          epAlreadyResolved = true;
          break;
        }
        if (
          rr.accesorioFin &&
          Math.hypot(rr.pts[rr.pts.length - 1][0] - ep[0], rr.pts[rr.pts.length - 1][1] - ep[1]) <
            TOL
        ) {
          epAlreadyResolved = true;
          break;
        }
        if (rr.accMed) {
          for (const [k, v] of Object.entries(rr.accMed)) {
            const m = k.match(/^accMed(\d+)$/);
            if (!m || !v) continue;
            const p = rr.pts[parseInt(m[1], 10)];
            if (p && Math.hypot(p[0] - ep[0], p[1] - ep[1]) < TOL) {
              epAlreadyResolved = true;
              break;
            }
          }
          if (epAlreadyResolved) break;
        }
      }
    }
    if (epAlreadyResolved) continue;
    const junction = detectJunctionAccesorio(engine, r.id, epIdx);
    if (junction) {
      return {
        ramalId: junction.otherRamalId,
        angleDeg: junction.angleDeg,
        junctionIndex: -1,
        point: r.pts[epIdx],
        net: r.net,
        isTee: isGas ? true : false,
      };
    }
  }

  if (r.pts.length >= 3) {
    for (let i = 1; i < lastIdx; i++) {
      // accMed is a nested map keyed by 'accMed<i>' on PlanoRamal (PlanoState.ts:245) — the
      // previous flat r['accMed<i>'] read silently never matched, so vertices that already had
      // an accessory could still re-trigger the junction/accesorio modal. Read the nested key.
      if (r.accMed?.[`accMed${i}`]) continue;
      const prev = r.pts[i - 1];
      const curr = r.pts[i];
      const next = r.pts[i + 1];
      const d1x = curr[0] - prev[0],
        d1y = curr[1] - prev[1];
      const d2x = next[0] - curr[0],
        d2y = next[1] - curr[1];
      const len1 = Math.hypot(d1x, d1y),
        len2 = Math.hypot(d2x, d2y);
      if (len1 < 0.001 || len2 < 0.001) continue;
      const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);
      const cosVal = Math.max(-1, Math.min(1, dot));
      const angleDeg = (Math.acos(cosVal) * 180) / Math.PI;
      if (Math.abs(angleDeg - 45) < 5 || Math.abs(angleDeg - 90) < 5) {
        const snapped = Math.abs(angleDeg - 45) < Math.abs(angleDeg - 90) ? 45 : 90;
        return {
          ramalId: r.id,
          angleDeg: snapped,
          junctionIndex: i,
          point: curr,
          net: r.net,
          isTee: isGas ? true : false,
        };
      }
    }
  }

  return null;
}

// Returns which EXISTING ramal (not the one just drawn/dragged, `currentRamalId`) the tee should
// be assigned to — the accessory always belongs to the ramal that was already there, never the
// one that was just created. Prefers the ramal whose BODY (mid-segment, not one of its own
// endpoints) the junction point lies on — that's unambiguously "the one being tee'd into" — and
// falls back to any other ramal sharing the point when all three segments meet exactly endpoint
// to endpoint (no single ramal's body is the "through" one in that case).
/** Checks whether a point forms a tee junction: at least 3 segments from existing ramales meet here, and which ramal's body the junction lies on. @returns isTee flag and the through-ramal id. */
export function isTeeAtEndpoint(
  ep: number[],
  engine: IPlanoEngineCore,
  currentRamalId: string,
  net: string,
): { isTee: boolean; throughRamalId: string | null } {
  const TOL = 0.5;
  let segmentCount = 0;
  let throughRamalId: string | null = null;
  let anyOtherRamalId: string | null = null;
  for (const r of engine.ramales) {
    if (!sameNetGroup(r.net, net)) continue;
    if (!r.pts || r.pts.length < 2) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const p1 = r.pts[i];
      const p2 = r.pts[i + 1];
      const dist = pointToSegmentDist(ep[0], ep[1], p1[0], p1[1], p2[0], p2[1]);
      if (dist < TOL) {
        const atP1 = Math.hypot(ep[0] - p1[0], ep[1] - p1[1]) < TOL;
        const atP2 = Math.hypot(ep[0] - p2[0], ep[1] - p2[1]) < TOL;
        if (atP1 || atP2) {
          segmentCount++;
          if (r.id !== currentRamalId) {
            // Prefer a ramal that was NOT auto-created by a split (no mergesFrom) over a
            // downstream stub that was — the accesorio must go on the genuine existing ramal.
            if (
              !anyOtherRamalId ||
              (!r.mergesFrom && engine.ramales.find((x) => x.id === anyOtherRamalId)?.mergesFrom)
            ) {
              anyOtherRamalId = r.id;
            }
          }
        } else {
          segmentCount += 2;
          if (r.id !== currentRamalId) throughRamalId = r.id;
        }
      }
    }
  }
  return { isTee: segmentCount >= 3, throughRamalId: throughRamalId ?? anyOtherRamalId };
}

// When two yee (45°) branch points sit within 10mm on the same ramal, they form a "tee salida
// bilateral" (double yee). Detects whether ramalId belongs to such a pair.
export function detectDoubleYeeTrigger(
  engine: IPlanoEngineCore,
  ramalId: string,
): AccesorioTrigger | null {
  const r = engine.ramales.find((x) => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return null;
  const DOUBLE_YEE_MM = 10;
  const TOL = 0.5;

  // Collect yee-eligible vertices: must be on san/ll/vent, non-endpoint, with a 45° internal angle
  type YeeVertex = { ramalId: string; idx: number; point: number[] };
  const yeeVertices: YeeVertex[] = [];
  const nets = ['san', 'll', 'vent'];
  if (!nets.includes(r.net)) return null;

  for (const rr of engine.ramales) {
    if (!nets.includes(rr.net) || !rr.pts || rr.pts.length < 3) continue;
    for (let i = 1; i < rr.pts.length - 1; i++) {
      const prev = rr.pts[i - 1],
        curr = rr.pts[i],
        next = rr.pts[i + 1];
      const d1x = curr[0] - prev[0],
        d1y = curr[1] - prev[1];
      const d2x = next[0] - curr[0],
        d2y = next[1] - curr[1];
      const len1 = Math.hypot(d1x, d1y),
        len2 = Math.hypot(d2x, d2y);
      if (len1 < 0.001 || len2 < 0.001) continue;
      const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);
      const cosVal = Math.max(-1, Math.min(1, dot));
      const angleDeg = (Math.acos(cosVal) * 180) / Math.PI;
      if (Math.abs(angleDeg - 45) < 5) {
        yeeVertices.push({ ramalId: rr.id, idx: i, point: curr });
      }
    }
  }

  // Find pairs of same-ramal yee vertices within DOUBLE_YEE_MM
  for (let i = 0; i < yeeVertices.length; i++) {
    for (let j = i + 1; j < yeeVertices.length; j++) {
      const a = yeeVertices[i],
        b = yeeVertices[j];
      if (a.ramalId !== b.ramalId) continue;
      const dist = Math.hypot(b.point[0] - a.point[0], b.point[1] - a.point[1]);
      if (dist > DOUBLE_YEE_MM) continue;
      // This ramal has a double yee — check if ramalId is one of the two yee-forming ramales
      // or the through-ramal of one of them
      if (
        a.ramalId === ramalId ||
        b.ramalId === ramalId ||
        engine.ramales.some(
          (rx) =>
            rx.id === ramalId &&
            rx.pts.some(
              (pt) =>
                Math.hypot(pt[0] - a.point[0], pt[1] - a.point[1]) < TOL ||
                Math.hypot(pt[0] - b.point[0], pt[1] - b.point[1]) < TOL,
            ),
        )
      ) {
        // Check not already resolved
        const ep = a.point;
        let alreadyResolved = false;
        for (const rr of engine.ramales) {
          if (!sameNetGroup(rr.net, r.net) || !rr.pts) continue;
          if (rr.accesorioInicio && Math.hypot(rr.pts[0][0] - ep[0], rr.pts[0][1] - ep[1]) < TOL) {
            alreadyResolved = true;
            break;
          }
          if (
            rr.accesorioFin &&
            Math.hypot(rr.pts[rr.pts.length - 1][0] - ep[0], rr.pts[rr.pts.length - 1][1] - ep[1]) <
              TOL
          ) {
            alreadyResolved = true;
            break;
          }
        }
        if (alreadyResolved) continue;
        return {
          ramalId: a.ramalId,
          angleDeg: 45,
          junctionIndex: -1,
          point: a.point,
          net: r.net,
          isTee: true,
        };
      }
    }
  }
  return null;
}
