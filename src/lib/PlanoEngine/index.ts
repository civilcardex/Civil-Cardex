// NETS re-exported from PlanoState via PlanoEngine (drawing-engine network defs).
// For UI display use uiConfig.REDES instead.
export { default, NETS } from './PlanoEngine';

export { renderGrid, drawArrow } from './CanvasRenderer';
export {
  hitTestPoint, hitTestLine, hitTestRect,
  pointInPoly, pointInLabelBox, pointToSegmentDist, snapToSegment,
} from './HitTester';
export { renameElement, deleteElement, findElementById } from './ElementManager';

export type { PlanoElement } from './PlanoState';
export type {
  PlanoRamal, PlanoBajante, PlanoArea, PlanoDimension, PlanoTextAnnotation,
  PlanoLevel, PlanoNet, PlanoNetCounts,
  PlanoActiveRamal, PlanoActiveArea, PlanoRamalDefaults,
  LabelBoxCorners, CanvasBox,
} from './PlanoState';
