import { pointToSegmentDist } from './HitTester';
import type { IPlanoEngineCore } from './PlanoState';

export function checkRamalAngles(pts: number[][], net: string, tipo?: string): boolean {
  if (pts.length < 2) return true;
  const isSanOrLl = net === 'san' || net === 'll';
  const isTributarioAcAf = (net === 'af' || net === 'ac') && tipo === 'tributario';

  if (!isSanOrLl) {
    const requiredStep = isTributarioAcAf ? 90 : 45;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      if (Math.hypot(dx, dy) < 0.1) continue;
      const deg = Math.round(((Math.atan2(dy, dx) * 180 / Math.PI) % 360 + 360) % 360);
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

    const dx1 = x2 - x1, dy1 = y2 - y1;
    const dx2 = x3 - x2, dy2 = y3 - y2;
    if (Math.hypot(dx1, dy1) < 0.1 || Math.hypot(dx2, dy2) < 0.1) continue;

    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);
    const dot = dx1 * dx2 + dy1 * dy2;
    const cosVal = dot / (len1 * len2);
    const turnAngle = Math.acos(Math.max(-1, Math.min(1, cosVal))) * 180 / Math.PI;
    const internalAngle = 180 - turnAngle;

    if (isSanOrLl) {
      if (internalAngle < 134) {
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

export function segmentsIntersect(a1: number[], a2: number[], b1: number[], b2: number[]): boolean {
  const [x1, y1] = a1, [x2, y2] = a2, [x3, y3] = b1, [x4, y4] = b2;
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

export function _firstSegmentAngle(pts: number[][]): number {
  if (pts.length < 2) return 0;
  const dx = pts[1][0] - pts[0][0];
  const dy = pts[1][1] - pts[0][1];
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return Math.round(angle);
}

export function snapTributaryToPadre45Deg(cursorX: number, cursorY: number, lastX: number, lastY: number, pts: number[][], threshold: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;

  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);
    const ux = dx / len, uy = dy / len;

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

export function segmentStrictIntersectionPoint(a1: number[], a2: number[], b1: number[], b2: number[]): number[] | null {
  const [x1, y1] = a1, [x2, y2] = a2, [x3, y3] = b1, [x4, y4] = b2;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  if (t <= 0.01 || t >= 0.99 || u <= 0.01 || u >= 0.99) return null;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

// Detects a codo formed where this ramal's endpoint meets ANOTHER ramal's endpoint at (roughly)
// the same point — unlike an internal-vertex check (consecutive points of the SAME ramal), this
// covers two separately-drawn ramales joining end-to-end, or a drag that newly aligns one
// ramal's endpoint with another's.
export function detectJunctionAccesorio(
  engine: IPlanoEngineCore,
  ramalId: string,
  epIdx: number
): { angleDeg: number; otherRamalId: string } | null {
  const r = engine.ramales.find(x => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2) return null;
  const ep = r.pts[epIdx];
  const otherIdxInR = epIdx === 0 ? 1 : r.pts.length - 2;
  const awayRx = r.pts[otherIdxInR][0] - ep[0], awayRy = r.pts[otherIdxInR][1] - ep[1];
  const lenR = Math.hypot(awayRx, awayRy);
  if (lenR < 0.001) return null;

  const TOL = 0.5;
  for (const r2 of engine.ramales) {
    if (r2.id === r.id || r2.net !== r.net) continue;
    if (!r2.pts || r2.pts.length < 2) continue;
    for (const j of [0, r2.pts.length - 1]) {
      const p2 = r2.pts[j];
      if (Math.hypot(p2[0] - ep[0], p2[1] - ep[1]) >= TOL) continue;
      const otherIdxInR2 = j === 0 ? 1 : r2.pts.length - 2;
      const awayR2x = r2.pts[otherIdxInR2][0] - p2[0], awayR2y = r2.pts[otherIdxInR2][1] - p2[1];
      const lenR2 = Math.hypot(awayR2x, awayR2y);
      if (lenR2 < 0.001) continue;
      const dot = (awayRx * awayR2x + awayRy * awayR2y) / (lenR * lenR2);
      const rawAngle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      const turnAngle = 180 - rawAngle;
      if (Math.abs(turnAngle - 45) < 5 || Math.abs(turnAngle - 90) < 5) {
        return { angleDeg: Math.round(turnAngle), otherRamalId: r2.id };
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
}

// Single source of truth for "does this ramal need the accesorio-selection modal right now",
// used both right after a ramal is drawn and after a drag ends — a junction can be created
// either way (two separate ramales joined by drawing, or by dragging one into a new ramal).
// Skips a junction that already has a resolved accesorio/aparato there, so it doesn't nag on
// every subsequent drag once the user has answered it.
export function detectAccesorioTrigger(engine: IPlanoEngineCore, ramalId: string): AccesorioTrigger | null {
  const r = engine.ramales.find(x => x.id === ramalId);
  if (!r || !r.pts || r.pts.length < 2 || !['af', 'ac', 'gas'].includes(r.net)) return null;

  const lastIdx = r.pts.length - 1;
  const endpointResolved = (idx: number) =>
    idx === 0 ? !!(r.accesorioInicio || r.aparatoInicio) : !!(r.accesorioFin || r.aparatoFin);

  for (const epIdx of [0, lastIdx]) {
    if (endpointResolved(epIdx)) continue;
    const ep = r.pts[epIdx];
    const tee = isTeeAtEndpoint(ep, engine, r.id, r.net);
    if (tee.isTee && tee.throughRamalId) {
      // The accessory belongs to the ramal that was already there, not the one just drawn/dragged
      // (r.id) — junctionIndex is meaningless for the existing ramal (its own vertex list doesn't
      // necessarily have an index at this point), so the modal writes via a position match instead.
      return { ramalId: tee.throughRamalId, angleDeg: 90, junctionIndex: -1, point: ep, net: r.net, isTee: true };
    }
  }

  for (const epIdx of [0, lastIdx]) {
    if (endpointResolved(epIdx)) continue;
    const junction = detectJunctionAccesorio(engine, r.id, epIdx);
    if (junction) {
      return { ramalId: junction.otherRamalId, angleDeg: junction.angleDeg, junctionIndex: -1, point: r.pts[epIdx], net: r.net, isTee: false };
    }
  }

  if (r.pts.length >= 3) {
    for (let i = 1; i < lastIdx; i++) {
      if ((r as unknown as Record<string, unknown>)[`accMed${i}`]) continue;
      const prev = r.pts[i - 1];
      const curr = r.pts[i];
      const next = r.pts[i + 1];
      const d1x = curr[0] - prev[0], d1y = curr[1] - prev[1];
      const d2x = next[0] - curr[0], d2y = next[1] - curr[1];
      const len1 = Math.hypot(d1x, d1y), len2 = Math.hypot(d2x, d2y);
      if (len1 < 0.001 || len2 < 0.001) continue;
      const dot = (d1x * d2x + d1y * d2y) / (len1 * len2);
      const cosVal = Math.max(-1, Math.min(1, dot));
      const angleDeg = Math.acos(cosVal) * 180 / Math.PI;
      if (Math.abs(angleDeg - 45) < 5 || Math.abs(angleDeg - 90) < 5) {
        return { ramalId: r.id, angleDeg: Math.round(angleDeg), junctionIndex: i, point: curr, net: r.net, isTee: false };
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
export function isTeeAtEndpoint(ep: number[], engine: IPlanoEngineCore, currentRamalId: string, net: string): { isTee: boolean; throughRamalId: string | null } {
  const TOL = 0.5;
  let segmentCount = 0;
  let throughRamalId: string | null = null;
  let anyOtherRamalId: string | null = null;
  for (const r of engine.ramales) {
    if (r.net !== net) continue;
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
          if (r.id !== currentRamalId && !anyOtherRamalId) anyOtherRamalId = r.id;
        } else {
          segmentCount += 2;
          if (r.id !== currentRamalId) throughRamalId = r.id;
        }
      }
    }
  }
  return { isTee: segmentCount >= 3, throughRamalId: throughRamalId ?? anyOtherRamalId };
}

