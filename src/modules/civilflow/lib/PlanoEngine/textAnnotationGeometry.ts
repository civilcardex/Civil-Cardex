// Geometría compartida para el redimensionado de anotaciones de texto: posición en lienzo de la
// esquina de la caja para una esquina nombrada en el marco local (sin rotar) de la propia caja,
// y rotación de un punto del marco local al espacio del lienzo. Tanto handleMouseDown.ts (agarre)
// como handleDragMove.ts (arrastre) necesitan exactamente las mismas matemáticas para que la
// esquina agarrada quede anclada con precisión en el lado opuesto a la que se redimensiona.

export type TextCorner = 'tl' | 'tr' | 'bl' | 'br';

export function oppositeTextCorner(c: TextCorner): TextCorner {
  return c === 'tl' ? 'br' : c === 'tr' ? 'bl' : c === 'bl' ? 'tr' : 'tl';
}

// boxWFull/boxHFull son las dimensiones completas de la caja con padding en px de lienzo (coincide
// con renderTextAnnotations.ts: rect dibujado en (-pad, -fs-pad) con tamaño boxWFull x boxHFull).
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
