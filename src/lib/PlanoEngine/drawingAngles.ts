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

export function _strokeAngle(pts: number[][]): number {
  if (pts.length < 2) return 0;
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segLens.push(l);
    totalLen += l;
  }
  const half = totalLen / 2;
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    if (acc + segLens[i] >= half) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dy = pts[i + 1][1] - pts[i][1];
      if (segLens[i] < 1) return 0;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      return Math.round(angle);
    }
    acc += segLens[i];
  }
  return 0;
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

export function isTeeAtEndpoint(ep: number[], engine: IPlanoEngineCore, _currentRamalId: string, net: string): boolean {
  const TOL = 0.5;
  let segmentCount = 0;
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
        if (atP1) {
          segmentCount++;
        } else if (atP2) {
          segmentCount++;
        } else {
          segmentCount += 2;
        }
      }
    }
  }
  return segmentCount >= 3;
}

