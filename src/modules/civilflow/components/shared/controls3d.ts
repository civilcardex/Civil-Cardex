import type { MOUSE, Vector3 } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Controles de mouse UNIFICADOS de los 3 visores 3D (aparatos/epc/rci) — decisión usuario
// 2026-09-22, consistente con la isometría de redes: derecho = nada.

/** Mapeo de botones: izquierdo = girar, central = mover (pan). El dolly del botón central se
 *  pierde con este mapeo (la rueda del mouse sigue zoomeando) y el derecho queda sin acción. */
export function aplicarControlesOrbit(controls: OrbitControls, mouse: typeof MOUSE): void {
  // Sin RIGHT: OrbitControls lo trata como no-op.
  controls.mouseButtons = { LEFT: mouse.ROTATE, MIDDLE: mouse.PAN };
}

/** Neutraliza el autoscroll nativo de Chrome en clic central (compite con el pan asignado).
 *  @returns función de desenganche para el cleanup del visor. */
export function attachAntiAutoscroll(canvas: HTMLCanvasElement): () => void {
  const anti = (e: MouseEvent): void => {
    if (e.button === 1) e.preventDefault();
  };
  canvas.addEventListener('mousedown', anti);
  return () => canvas.removeEventListener('mousedown', anti);
}

/** Aspect del canvas con guardas (alto 0 y ratio mínimo): el bloque de 4 líneas se repetía
 *  en los 3 visores 3D. */
export function aspectDe(el: { clientWidth: number; clientHeight: number }): number {
  return Math.max(0.1, el.clientWidth / Math.max(1, el.clientHeight));
}

/** Api mínima del tween compartido: los 3 visores 3D la satisfacen estructuralmente. */
interface CamTweenApi {
  camP: { position: Vector3 };
  controls: { target: Vector3 };
  cancelAnim: number | null;
  /** Render bajo demanda (rci3d): si existe, se repinta mientras dura la animación. */
  framesPendientes?: number;
}

/** Interpola cámara persp + target hacia la pose dada (ease-out cúbico). El tween es común
 *  a los 3 visores; el encuadre/vistas sigue forkeado (viewsRci) y cada visor activa su
 *  persp ANTES de llamar. */
export function animarCamaraHacia(
  api: CamTweenApi,
  toPos: Vector3,
  toTgt: Vector3,
  dur = 700,
): void {
  if (api.cancelAnim != null) cancelAnimationFrame(api.cancelAnim);
  const fromPos = api.camP.position.clone();
  const fromTgt = api.controls.target.clone();
  const t0 = performance.now();
  const step = (): void => {
    const t = Math.min(1, (performance.now() - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    api.camP.position.lerpVectors(fromPos, toPos, e);
    api.controls.target.lerpVectors(fromTgt, toTgt, e);
    if (api.framesPendientes != null) api.framesPendientes = 2;
    if (t < 1) api.cancelAnim = requestAnimationFrame(step);
    else api.cancelAnim = null;
  };
  api.cancelAnim = requestAnimationFrame(step);
}
