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
