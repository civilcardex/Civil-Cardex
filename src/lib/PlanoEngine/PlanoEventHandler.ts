export function getCanvasPosition(canv: HTMLCanvasElement, e: MouseEvent | TouchEvent) {
  const r = canv.getBoundingClientRect();
  const t = e instanceof TouchEvent ? (e as TouchEvent).touches[0] : e as MouseEvent;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

export function wrapTouch(fn: (e: TouchEvent) => void) {
  return (e: TouchEvent) => { e.preventDefault(); fn(e); };
}

export function setupCanvasEvents(engine: {
  canv: HTMLCanvasElement;
  _onDown: (e: MouseEvent | TouchEvent) => void;
  _onMove: (e: MouseEvent | TouchEvent) => void;
  _onUp: (e: MouseEvent | TouchEvent) => void;
  _onDblClick: (e: MouseEvent) => void;
  _onWheel: (e: WheelEvent) => void;
  _onKeyDown: (e: KeyboardEvent) => void;
  _wrapTouch: (fn: (e: TouchEvent) => void) => (e: TouchEvent) => void;
  [key: string]: any;
}) {
  engine._touchStartHandler = engine._wrapTouch(engine._onDown as (e: TouchEvent) => void);
  engine._touchMoveHandler = engine._wrapTouch(engine._onMove as (e: TouchEvent) => void);
  engine._touchEndHandler = (e: TouchEvent) => { e.preventDefault(); engine._onUp(e); };

  engine.canv.addEventListener('mousedown', engine._onDown);
  engine.canv.addEventListener('mousemove', engine._onMove);
  engine.canv.addEventListener('mouseup', engine._onUp);
  engine.canv.addEventListener('mouseleave', engine._onUp);
  engine.canv.addEventListener('dblclick', engine._onDblClick);
  engine.canv.addEventListener('wheel', engine._onWheel, { passive: false });
  engine.canv.addEventListener('touchstart', engine._touchStartHandler, { passive: false });
  engine.canv.addEventListener('touchmove', engine._touchMoveHandler, { passive: false });
  engine.canv.addEventListener('touchend', engine._touchEndHandler, { passive: false });
  document.addEventListener('keydown', engine._onKeyDown);
}

export function teardownCanvasEvents(engine: {
  canv: HTMLCanvasElement;
  _onDown: (e: MouseEvent | TouchEvent) => void;
  _onMove: (e: MouseEvent | TouchEvent) => void;
  _onUp: (e: MouseEvent | TouchEvent) => void;
  _onDblClick: (e: MouseEvent) => void;
  _onWheel: (e: WheelEvent) => void;
  _onKeyDown: (e: KeyboardEvent) => void;
  [key: string]: any;
}) {
  engine.canv.removeEventListener('mousedown', engine._onDown);
  engine.canv.removeEventListener('mousemove', engine._onMove);
  engine.canv.removeEventListener('mouseup', engine._onUp);
  engine.canv.removeEventListener('mouseleave', engine._onUp);
  engine.canv.removeEventListener('dblclick', engine._onDblClick);
  engine.canv.removeEventListener('wheel', engine._onWheel);
  if (engine._touchStartHandler) {
    engine.canv.removeEventListener('touchstart', engine._touchStartHandler);
  }
  if (engine._touchMoveHandler) {
    engine.canv.removeEventListener('touchmove', engine._touchMoveHandler);
  }
  if (engine._touchEndHandler) {
    engine.canv.removeEventListener('touchend', engine._touchEndHandler);
  }
  document.removeEventListener('keydown', engine._onKeyDown);
}
