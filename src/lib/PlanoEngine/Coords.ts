export interface CoordsState {
  zoom: number;
  offX: number;
  offY: number;
  scaleM: number;
}

export function toCvs(state: CoordsState, px: number, py: number): { x: number; y: number } {
  return { x: px * state.zoom + state.offX, y: py * state.zoom + state.offY };
}

export function toPlane(state: CoordsState, cx: number, cy: number): { x: number; y: number } {
  return { x: (cx - state.offX) / state.zoom, y: (cy - state.offY) / state.zoom };
}

export function pxToM(state: CoordsState, px: number): number {
  return +(px / 96 * 2.54 * state.scaleM).toFixed(3);
}

export function mm2cvs(state: CoordsState, mm: number): number {
  return mm * 96 / 25.4 * state.zoom;
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

export function snapAngle(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return { x: x1, y: y1 };
  const deg = Math.atan2(dy, dx) * 180 / Math.PI;
  const allowed = [0, 45, 90, 135, 180, -135, -90, -45];
  let best = 0, minDiff = 999;
  for (const a of allowed) {
    const diff = Math.abs(((deg - a) + 540) % 360 - 180);
    if (diff < minDiff) { minDiff = diff; best = a; }
  }
  const sr = best * Math.PI / 180;
  return { x: x0 + dist * Math.cos(sr), y: y0 + dist * Math.sin(sr) };
}
