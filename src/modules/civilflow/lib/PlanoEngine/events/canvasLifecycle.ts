/**
 * Ciclo de vida del canvas (extraído verbatim de PlanoEngine.ts): re-medida explícita del
 * lienzo, cancelación de cuadros pendientes al destruir, coalescing del render por cuadro,
 * caché del rect del canvas, helper de posición del puntero, touch con preventDefault y
 * zoom por botones. La clase PlanoEngine delega aquí en 1 línea.
 * Ej: scheduleRender(engine) agrupa una ráfaga de N llamadas del ResizeObserver en UN solo
 * repaint por cuadro.
 */
import type { EngineFull } from '../engineFull.ts';
import type { Point } from '../PlanoState.ts';
import { zoomAnclado } from '../planoCamera.ts';

/** Vista del motor para el ciclo de render: EngineFull más los campos privados de la clase
 *  (flag de repaint pedido, id del rAF pendiente y caché del rect). Ej: scheduleRender usa
 *  _needsRender/_rafId para coalescer ráfagas en un solo cuadro. */
interface EngineLifecycleView extends EngineFull {
  _needsRender: boolean;
  _rafId: number | null;
  _rectCache: { rect: DOMRect; t: number } | null;
}

/** Cancela los cuadros pendientes (repaint programado y flush de rueda): lo llama destroy()
 *  para que nada dispare un render sobre el canvas ya desmontado. */
export function cancelPendingFrames(engine: EngineFull): void {
  const eng = engine as EngineLifecycleView;
  if (eng._rafId !== null) {
    cancelAnimationFrame(eng._rafId);
    eng._rafId = null;
  }
  if (eng._wheelRaf) {
    cancelAnimationFrame(eng._wheelRaf);
    eng._wheelRaf = 0;
    eng._wheelAccum = 0;
  }
}

/** Re-mide el canvas (width/height + transform DPR) a un tamaño explícito (export). */
export function resizeCanvas(engine: EngineFull, w: number, h: number): void {
  const dpr = engine.dpr || 1;
  engine.canv.width = Math.floor(w * dpr);
  engine.canv.height = Math.floor(h * dpr);
  engine.canv.style.width = w + 'px';
  engine.canv.style.height = h + 'px';
  engine.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  engine.render();
}

/** Programa UN repaint en el próximo cuadro: si ya hay uno pedido no hace nada — la ráfaga
 *  de llamadas (ResizeObserver, rueda) pinta una sola vez por frame. */
export function scheduleRender(engine: EngineFull): void {
  const eng = engine as EngineLifecycleView;
  if (eng._needsRender) return;
  eng._needsRender = true;
  eng._rafId = requestAnimationFrame(() => {
    eng._rafId = null;
    eng._needsRender = false;
    eng.render();
  });
}

/** Envuelve un handler de touch con preventDefault (el canvas no scrollea la página). */
export function wrapTouch(fn: (e: TouchEvent) => void): (e: TouchEvent) => void {
  return (e: TouchEvent) => {
    e.preventDefault();
    fn(e);
  };
}

export function getPos(engine: EngineFull, e: MouseEvent | TouchEvent): Point {
  const r = engine._cachedRect();
  const t = e instanceof TouchEvent ? (e as TouchEvent).touches[0] : (e as MouseEvent);
  /* Corrección de ESCALA (ped. usuario: en ciertos tamaños el cursor no seguía el trazo):
   * clientX-rect.left está en px de PANTALLA (post-escala del navegador/transform de
   * ancestros), pero el dibujo usa px CSS locales del lienzo. El factor rect.width ↔
   * canv.width/dpr los alinea — es 1 cuando coincide, así que nunca estorba. */
  const sx = r.width > 0 ? engine.canv.width / engine.dpr / r.width : 1;
  const sy = r.height > 0 ? engine.canv.height / engine.dpr / r.height : 1;
  return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
}

/** Rect del canvas con caché de 32ms: rueda/pinch/mousemove lo piden 60-120/s. */
export function cachedRect(engine: EngineFull): DOMRect {
  const eng = engine as EngineLifecycleView;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const c = eng._rectCache;
  if (c && now - c.t < 32) return c.rect;
  const rect = engine.canv.getBoundingClientRect();
  eng._rectCache = { rect, t: now };
  return rect;
}

/** Zoom por botones (modo consulta móvil/tablet): escala alrededor del centro del canvas. */
export function zoomStep(engine: EngineFull, factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0) return;
  const rect = engine.canv.getBoundingClientRect();
  zoomAnclado(engine, engine.zoom * factor, rect.width / 2, rect.height / 2);
}
