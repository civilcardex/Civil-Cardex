const PT_LINE = 16;

function hitTestPoint(px: number, py: number, x: number, y: number, threshold = PT_LINE) {
  return Math.hypot(px - x, py - y) <= threshold;
}

export function hitTestLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number, threshold = PT_LINE) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return hitTestPoint(px, py, x1, y1, threshold);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) <= threshold;
}

export function pointInPoly(px: number, py: number, cvsPts: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = cvsPts.length - 1; i < cvsPts.length; j = i++) {
    const xi = cvsPts[i].x, yi = cvsPts[i].y;
    const xj = cvsPts[j].x, yj = cvsPts[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInLabelBox(px: number, py: number, box: { cx: number; cy: number; w: number; h: number; angle: number; corners?: { x: number; y: number }[] }) {
  if (!box || !box.corners) return false;
  const dx = px - box.cx, dy = py - box.cy;
  const cosA = Math.cos(-box.angle), sinA = Math.sin(-box.angle);
  const lx = dx * cosA - dy * sinA;
  const ly = dx * sinA + dy * cosA;
  return Math.abs(lx) <= box.w / 2 && Math.abs(ly) <= box.h / 2;
}

export function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function snapToSegment(x: number, y: number, pts: number[][], threshold: number = Infinity) {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const ddx = x2 - x1, ddy = y2 - y1, len2 = ddx * ddx + ddy * ddy;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - x1) * ddx + (y - y1) * ddy) / len2));
    const ptx = x1 + t * ddx, pty = y1 + t * ddy;
    const d = Math.hypot(x - ptx, y - pty);
    if (d < minD && d <= threshold) { minD = d; best = { x: ptx, y: pty }; }
  }
  return best;
}

export function rotatedRectCorners(
  cx: number, cy: number, w: number, h: number, angle: number, margin = 0
): { corners: { x: number; y: number }[]; minX: number; minY: number; maxX: number; maxY: number } {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const hw = w / 2, hh = h / 2;
  const corners = [
    { x: cx + cosA * (-hw) - sinA * (-hh), y: cy + sinA * (-hw) + cosA * (-hh) },
    { x: cx + cosA * (hw) - sinA * (-hh), y: cy + sinA * (hw) + cosA * (-hh) },
    { x: cx + cosA * (hw) - sinA * (hh), y: cy + sinA * (hw) + cosA * (hh) },
    { x: cx + cosA * (-hw) - sinA * (hh), y: cy + sinA * (-hw) + cosA * (hh) },
  ];
  return {
    corners,
    minX: Math.min(...corners.map(c => c.x)) - margin,
    minY: Math.min(...corners.map(c => c.y)) - margin,
    maxX: Math.max(...corners.map(c => c.x)) + margin,
    maxY: Math.max(...corners.map(c => c.y)) + margin,
  };
}

export function distanceToRamal(
  cx: number,
  cy: number,
  pts: number[][],
  toCvs: (px: number, py: number) => { x: number; y: number },
  rad: number
): number {
  if (pts.length < 2) return Infinity;

  const cvsPts = pts.map(pt => toCvs(pt[0], pt[1]));
  let minD = Infinity;

  for (let i = 0; i < cvsPts.length; i++) {
    const isCorner = i > 0 && i < cvsPts.length - 1;
    let actualRad = 0;
    let T_A = { x: 0, y: 0 };
    let T_C = { x: 0, y: 0 };
    let ccx = 0, ccy = 0;
    let angle_TA = 0, angle_TC = 0;
    let counterclockwise = false;

    if (isCorner) {
      const cvsA = cvsPts[i - 1];
      const cvsB = cvsPts[i];
      const cvsC = cvsPts[i + 1];

      const ax = cvsB.x - cvsA.x, ay = cvsB.y - cvsA.y;
      const bx = cvsC.x - cvsB.x, by = cvsC.y - cvsB.y;
      const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);

      if (lenA > 0 && lenB > 0) {
        const ux = -ax / lenA, uy = -ay / lenA; // B -> A
        const vx = bx / lenB, vy = by / lenB;   // B -> C
        const cosAngle = ux * vx + uy * vy;

        if (Math.abs(cosAngle) < 0.05) {
          actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);
          if (actualRad > 0.1) {
            T_A = { x: cvsB.x + actualRad * ux, y: cvsB.y + actualRad * uy };
            T_C = { x: cvsB.x + actualRad * vx, y: cvsB.y + actualRad * vy };
            ccx = cvsB.x + (ux + vx) * actualRad;
            ccy = cvsB.y + (uy + vy) * actualRad;
            angle_TA = Math.atan2(-vy, -vx);
            angle_TC = Math.atan2(-uy, -ux);
            const cross = ux * vy - uy * vx;
            counterclockwise = cross > 0;
          }
        }
      }
    }

    if (isCorner && actualRad > 0.1) {
      const distToCenter = Math.hypot(cx - ccx, cy - ccy);
      const distToCircle = Math.abs(distToCenter - actualRad);

      const angle = Math.atan2(cy - ccy, cx - ccx);
      const twoPi = Math.PI * 2;
      const normAngle = (angle % twoPi + twoPi) % twoPi;
      const normStart = (angle_TA % twoPi + twoPi) % twoPi;
      const normEnd = (angle_TC % twoPi + twoPi) % twoPi;

      let inArc = false;
      if (counterclockwise) {
        if (normStart >= normEnd) {
          inArc = normAngle >= normEnd && normAngle <= normStart;
        } else {
          inArc = normAngle >= normEnd || normAngle <= normStart;
        }
      } else {
        if (normStart <= normEnd) {
          inArc = normAngle >= normStart && normAngle <= normEnd;
        } else {
          inArc = normAngle >= normStart || normAngle <= normEnd;
        }
      }

      if (inArc) {
        minD = Math.min(minD, distToCircle);
      } else {
        minD = Math.min(minD, Math.hypot(cx - T_A.x, cy - T_A.y), Math.hypot(cx - T_C.x, cy - T_C.y));
      }
    }
  }

  for (let i = 0; i < cvsPts.length - 1; i++) {
    let start = cvsPts[i];
    let end = cvsPts[i + 1];

    const startIsCorner = i > 0;
    if (startIsCorner) {
      const cvsA = cvsPts[i - 1];
      const cvsB = cvsPts[i];
      const cvsC = cvsPts[i + 1];
      const ax = cvsB.x - cvsA.x, ay = cvsB.y - cvsA.y;
      const bx = cvsC.x - cvsB.x, by = cvsC.y - cvsB.y;
      const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
      if (lenA > 0 && lenB > 0) {
        const ux = -ax / lenA, uy = -ay / lenA;
        const vx = bx / lenB, vy = by / lenB;
        const cosAngle = ux * vx + uy * vy;
        if (Math.abs(cosAngle) < 0.05) {
          const actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);
          if (actualRad > 0.1) {
            start = { x: cvsB.x + actualRad * vx, y: cvsB.y + actualRad * vy }; // T_C
          }
        }
      }
    }

    const endIsCorner = i + 1 < cvsPts.length - 1;
    if (endIsCorner) {
      const cvsA = cvsPts[i];
      const cvsB = cvsPts[i + 1];
      const cvsC = cvsPts[i + 2];
      const ax = cvsB.x - cvsA.x, ay = cvsB.y - cvsA.y;
      const bx = cvsC.x - cvsB.x, by = cvsC.y - cvsB.y;
      const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
      if (lenA > 0 && lenB > 0) {
        const ux = -ax / lenA, uy = -ay / lenA;
        const vx = bx / lenB, vy = by / lenB;
        const cosAngle = ux * vx + uy * vy;
        if (Math.abs(cosAngle) < 0.05) {
          const actualRad = Math.min(rad, lenA * 0.8, lenB * 0.8);
          if (actualRad > 0.1) {
            end = { x: cvsB.x + actualRad * ux, y: cvsB.y + actualRad * uy }; // T_A
          }
        }
      }
    }

    const d = pointToSegmentDist(cx, cy, start.x, start.y, end.x, end.y);
    minD = Math.min(minD, d);
  }

  return minD;
}

