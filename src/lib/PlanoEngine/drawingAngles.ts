export function checkRamalAngles(pts: number[][], net: string): boolean {
  if (pts.length < 2) return true;
  const isSanOrLl = net === 'san' || net === 'll';

  if (!isSanOrLl) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      if (Math.hypot(dx, dy) < 0.1) continue;
      const deg = Math.round(((Math.atan2(dy, dx) * 180 / Math.PI) % 360 + 360) % 360);
      const rem = deg % 45;
      if (rem > 1 && rem < 44) {
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

    const a1 = Math.atan2(dy1, dx1) * 180 / Math.PI;
    const a2 = Math.atan2(dy2, dx2) * 180 / Math.PI;
    let diff = Math.abs(a2 - a1) % 360;
    if (diff > 180) diff = 360 - diff;

    const internalAngle = 180 - diff;

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
