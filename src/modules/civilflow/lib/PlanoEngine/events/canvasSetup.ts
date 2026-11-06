/** Registro/retiro de los listeners del canvas y del keydown global del motor (extraído de
 *  PlanoEngine.ts por el guard de líneas). Los handlers ya vienen atados en el constructor
 *  (_onDown = _onDownHandler.bind(this)); aquí solo se cuelgan y se descuelgan, con los de
 *  touch envueltos en preventDefault (el canvas no debe scrollear la página).
 *  Ej: el constructor llama setupCanvasEvents(this) y destroy() llama teardownCanvasEvents(this). */
import type { EngineFull } from '../engineFull.ts';

/** Cuelga los listeners del canvas (mouse/rueda/touch) y el keydown del documento. */
export function setupCanvasEvents(engine: EngineFull): void {
  engine._touchStartHandler = engine._wrapTouch(engine._onDown as (e: TouchEvent) => void);
  engine._touchMoveHandler = engine._wrapTouch(engine._onMove as (e: TouchEvent) => void);
  engine._touchEndHandler = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length < 2) engine._pinchDist0 = null;
    engine._onUp(e);
  };

  engine.canv.addEventListener('mousedown', engine._onDown);
  engine.canv.addEventListener('mousemove', engine._onMove);
  engine.canv.addEventListener('mouseup', engine._onUp);
  engine.canv.addEventListener('mouseleave', engine._onUp);
  engine.canv.addEventListener('dblclick', engine._onDblClick);
  engine.canv.addEventListener('wheel', engine._onWheel, { passive: false });
  engine.canv.addEventListener('touchstart', engine._touchStartHandler, { passive: false });
  engine.canv.addEventListener('touchmove', engine._touchMoveHandler, { passive: false });
  engine.canv.addEventListener('touchend', engine._touchEndHandler, { passive: false });
  // Llamada/gesture del SO interrumpen el touch sin touchend: sin este reset, panning/drag
  // quedan huérfanos y el próximo touchmove de 1 dedo arrastra o panea sin querer.
  engine.canv.addEventListener('touchcancel', engine._touchEndHandler);
  document.addEventListener('keydown', engine._onKeyDown);
}

/** Retira exactamente lo que colgó setupCanvasEvents (espejo 1:1). */
export function teardownCanvasEvents(engine: EngineFull): void {
  engine.canv.removeEventListener('mousedown', engine._onDown);
  engine.canv.removeEventListener('mousemove', engine._onMove);
  engine.canv.removeEventListener('mouseup', engine._onUp);
  engine.canv.removeEventListener('mouseleave', engine._onUp);
  engine.canv.removeEventListener('dblclick', engine._onDblClick);
  engine.canv.removeEventListener('wheel', engine._onWheel);
  if (engine._touchStartHandler)
    engine.canv.removeEventListener('touchstart', engine._touchStartHandler);
  if (engine._touchMoveHandler)
    engine.canv.removeEventListener('touchmove', engine._touchMoveHandler);
  if (engine._touchEndHandler) {
    engine.canv.removeEventListener('touchend', engine._touchEndHandler);
    engine.canv.removeEventListener('touchcancel', engine._touchEndHandler);
  }
  document.removeEventListener('keydown', engine._onKeyDown);
}
