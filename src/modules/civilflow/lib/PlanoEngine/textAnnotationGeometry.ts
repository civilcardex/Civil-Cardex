// Shared geometry for text-annotation resize: the box's on-canvas corner position for a named
// corner in the box's own local (unrotated) frame, and rotating a local-frame point into canvas
// space. Both handleMouseDown.ts (grab) and handleDragMove.ts (drag) need the exact same math so
// the corner that's grabbed stays anchored precisely opposite the one being resized.

export type TextCorner = 'tl' | 'tr' | 'bl' | 'br';

export function oppositeTextCorner(c: TextCorner): TextCorner {
  return c === 'tl' ? 'br' : c === 'tr' ? 'bl' : c === 'bl' ? 'tr' : 'tl';
}

// boxWFull/boxHFull are the full padded box dimensions in canvas px (matches renderTextAnnotations.ts:
// rect drawn at (-pad, -fs-pad) sized boxWFull x boxHFull).
export function textLocalCorner(
  corner: TextCorner,
  fs: number,
  pad: number,
  boxWFull: number,
  boxHFull: number,
): { lx: number; ly: number } {
  const lx = corner === 'tl' || corner === 'bl' ? -pad : -pad + boxWFull;
  const ly = corner === 'tl' || corner === 'tr' ? -fs - pad : -fs - pad + boxHFull;
  return { lx, ly };
}

export function rotateLocalPoint(lx: number, ly: number, angle: number): { x: number; y: number } {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  return { x: lx * cos - ly * sin, y: lx * sin + ly * cos };
}
