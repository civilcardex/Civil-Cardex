/** Registro/retiro de los listeners del canvas y del keydown global del motor (extraído de
 *  PlanoEngine.ts por el guard de líneas). Los handlers ya vienen atados en el constructor
 *  (_onDown = _onDownHandler.bind(this)); aquí solo se cuelgan y se descuelgan, con los de
 *  touch envueltos en preventDefault (el canvas no debe scrollear la página).
 *  Ej: el constructor llama setupCanvasEvents(this) y destroy() llama teardownCanvasEvents(this). */
import type { EngineFull } from '../engineFull.ts';
import { captureDragGeometry } from '../PlanoHistory.ts';

const DRAG_KEYS = [
  'marqueeRect',
  'guideDrag',
  'multiDrag',
  'ghostDrag',
  'lblDrag',
  'txtDrag',
  'txtResize',
  'canalResizeDrag',
  'dimLblDrag',
  'bajDrag',
  'areaDrag',
  'areaPtDrag',
  'dimDrag',
  'ptDrag',
  'ramalDrag',
] as const;

/** Cuelga los listeners del canvas (mouse/rueda/touch) y el keydown del documento. */
export function setupCanvasEvents(engine: EngineFull): void {
  let started = false;
  let interrupted = false;
  let pending: { x: number; y: number; tool: string; planId: EngineFull['_loadedPlanId'] } | null =
    null;
  let rollback: (() => void) | null = null;
  let dragPlanId: EngineFull['_loadedPlanId'];
  /** Último toque sintetizado: dos toques rápidos en el mismo punto = doble toque táctil
   *  (el equivalente al doble clic con que se cierra el trazado en escritorio). */
  let lastTap: { t: number; x: number; y: number } | null = null;
  const interrupt = () => {
    if (dragPlanId === engine._loadedPlanId) rollback?.();
    rollback = null;
    pending = null;
    started = false;
    interrupted = true;
    engine.panning = false;
    for (const key of DRAG_KEYS) engine[key] = null;
    engine.canv.style.cursor =
      engine.tool === 'pan' ? 'grab' : engine.tool === 'sel' ? 'default' : 'crosshair';
    engine._pinchDist0 = null;
    engine._pinchMid0 = null;
    // Un gesto interrumpido NO debe dejar armado el doble toque del toque anterior.
    lastTap = null;
    engine.render();
  };
  engine._touchStartHandler = engine._wrapTouch((e) => {
    if (e.touches.length !== 1) {
      interrupt();
      return;
    }
    interrupted = false;
    const t = e.touches[0];
    if (engine.tool === 'sel' || engine.tool === 'pan') {
      started = true;
      dragPlanId = engine._loadedPlanId;
      engine._onDown(e);
    } else {
      // Asegurar que un segundo dedo no convierta el primer contacto en un punto de dibujo.
      pending = { x: t.clientX, y: t.clientY, tool: engine.tool, planId: engine._loadedPlanId };
    }
  });
  engine._touchMoveHandler = engine._wrapTouch((e) => {
    if (e.touches.length >= 2) {
      engine._onMove(e);
      return;
    }
    if (interrupted || !e.touches.length) return;
    const t = e.touches[0];
    if (pending && Math.hypot(t.clientX - pending.x, t.clientY - pending.y) > 10) {
      pending = null;
      lastTap = null; // el dedo se movió: esto ya no es un toque, es un arrastre.
    }
    if (started && !rollback && DRAG_KEYS.some((key) => key !== 'marqueeRect' && engine[key])) {
      rollback = captureDragGeometry(engine);
    }
    if (started || pending) engine._onMove(e);
  });
  engine._touchEndHandler = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length < 2) engine._pinchDist0 = null;
    engine._pinchMid0 = null;
    if (e.type === 'touchcancel') {
      interrupt();
      return;
    }
    if (e.touches.length > 0 || interrupted) return;
    const t = e.changedTouches[0];
    /* DOBLE TOQUE (ped. usuario 2026-11-25): el 2.º toque rápido sobre el MISMO punto con un
     *  trazado abierto cierra el ramal/tributario (el equivalente táctil del doble clic de
     *  escritorio). Se detecta ANTES de sintetizar el punto para no insertar el duplicado:
     *  el punto final ya lo puso el 1.er toque. Con un solo punto no hay nada que cerrar —
     *  se ignora el toque y el trazado sigue. Ventana 600 ms / 30 px (holgada para el pulso
     *  en tablet — ped. usuario 2026-11-25: «aumenta el tiempo para dar doble click»). */
    const ramalAbierto = engine.activeRamal;
    // El SEGUNDO toque tiene que ser un toque válido por sí mismo: si el dedo se arrastró
    // (pending ya fue descartado) o cambió de plano/herramienta, no cierra nada.
    const toqueValido =
      !!pending &&
      !!t &&
      pending.planId === engine._loadedPlanId &&
      pending.tool === engine.tool &&
      Math.hypot(t.clientX - pending.x, t.clientY - pending.y) <= 10;
    const esDobleToque =
      toqueValido &&
      !!lastTap &&
      Date.now() - lastTap.t <= 600 &&
      !!t &&
      Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) <= 30 &&
      engine.tool === 'line' &&
      !!ramalAbierto;
    lastTap = pending && t && !esDobleToque ? { t: Date.now(), x: t.clientX, y: t.clientY } : null;
    if (esDobleToque && ramalAbierto) {
      pending = null;
      if (ramalAbierto.pts.length >= 2) engine.finishRamal();
      return;
    }
    if (
      pending &&
      t &&
      pending.planId === engine._loadedPlanId &&
      pending.tool === engine.tool &&
      Math.hypot(t.clientX - pending.x, t.clientY - pending.y) <= 10
    ) {
      engine._onDown(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY }));
    }
    if (started || pending) engine._onUp(e);
    pending = null;
    started = false;
    rollback = null;
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
  engine.canv.addEventListener('touchcancel', engine._touchEndHandler, { passive: false });
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
