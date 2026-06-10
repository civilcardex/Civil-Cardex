const PT_LINE = 16;

export function hitTestPoint(px: number, py: number, x: number, y: number, threshold = PT_LINE) {
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

export function hitTestRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
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

export function snapToSegment(x: number, y: number, pts: number[][]) {
  let best: { x: number; y: number } | null = null;
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const ddx = x2 - x1, ddy = y2 - y1, len2 = ddx * ddx + ddy * ddy;
    if (len2 < 1) continue;
    const t = Math.max(0, Math.min(1, ((x - x1) * ddx + (y - y1) * ddy) / len2));
    const ptx = x1 + t * ddx, pty = y1 + t * ddy;
    const d = Math.hypot(x - ptx, y - pty);
    if (d < minD) { minD = d; best = { x: ptx, y: pty }; }
  }
  return best;
}
