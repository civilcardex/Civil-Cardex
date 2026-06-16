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
