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
}) {
  engine.canv.addEventListener('mousedown', engine._onDown);
  engine.canv.addEventListener('mousemove', engine._onMove);
  engine.canv.addEventListener('mouseup', engine._onUp);
  engine.canv.addEventListener('mouseleave', engine._onUp);
  engine.canv.addEventListener('dblclick', engine._onDblClick);
  engine.canv.addEventListener('wheel', engine._onWheel, { passive: false });
  engine.canv.addEventListener('touchstart', engine._wrapTouch(engine._onDown as (e: TouchEvent) => void), { passive: false });
  engine.canv.addEventListener('touchmove', engine._wrapTouch(engine._onMove as (e: TouchEvent) => void), { passive: false });
  engine.canv.addEventListener('touchend', (e: TouchEvent) => { e.preventDefault(); engine._onUp(e); }, { passive: false });
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
}) {
  engine.canv.removeEventListener('mousedown', engine._onDown);
  engine.canv.removeEventListener('mousemove', engine._onMove);
  engine.canv.removeEventListener('mouseup', engine._onUp);
  engine.canv.removeEventListener('mouseleave', engine._onUp);
  engine.canv.removeEventListener('dblclick', engine._onDblClick);
  engine.canv.removeEventListener('wheel', engine._onWheel);
  document.removeEventListener('keydown', engine._onKeyDown);
}
