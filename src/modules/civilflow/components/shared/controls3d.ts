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

/** Neutraliza el autoscroll nativo de Chrome en clic central (compite con el pan asignado). Devuelve función de desenganche para el cleanup del visor. */
export function attachAntiAutoscroll(canvas: HTMLCanvasElement): () => void {
  const anti = (e: MouseEvent): void => {
    if (e.button === 1) e.preventDefault();
  };
  canvas.addEventListener('mousedown', anti);
  return () => canvas.removeEventListener('mousedown', anti);
}

/** Relación ancho/alto del canvas, protegida contra alto 0 (se usa 1px como piso): el
 *  mismo cálculo lo necesitaban los 3 visores 3D. */
export function aspectDe(el: { clientWidth: number; clientHeight: number }): number {
  return Math.max(0.1, el.clientWidth / Math.max(1, el.clientHeight));
}

/** Punto en el espacio 3D con operaciones básicas (copia, restar, producto punto):
 *  THREE.Vector3 las cumple, pero el módulo no depende del paquete three. */
export interface Punto3 {
  x: number;
  y: number;
  z: number;
  clone(): Punto3;
  sub(p: Punto3): Punto3;
  dot(p: Punto3): number;
}

/** Mide cuánto ocupa la caja en la vista (sus 8 esquinas sobre los ejes). Ej: encuadrar la orto con margen 8%. Vale para rci (Red Contra Incendio) y los otros 2 visores. */
export function proyeccionEsquinas(
  nueva: (x: number, y: number, z: number) => Punto3,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  centro: Punto3,
  right: Punto3,
  up: Punto3,
): { minR: number; maxR: number; minU: number; maxU: number } {
  let minR = 1e9;
  let maxR = -1e9;
  let minU = 1e9;
  let maxU = -1e9;
  for (const sx of [min.x, max.x])
    for (const sy of [min.y, max.y])
      for (const sz of [min.z, max.z]) {
        const v = nueva(sx, sy, sz).sub(centro);
        const r = v.dot(right);
        const u = v.dot(up);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
      }
  return { minR, maxR, minU, maxU };
}

/** Lo mínimo que necesita la animación de cámara compartida (cámara, controles y forma de
 *  cancelar/repintar): los 3 visores 3D lo cumplen tal cual. */
interface CamTweenApi {
  camP: { position: Vector3 };
  controls: { target: Vector3 };
  cancelAnim: number | null;
  /** Repinta solo mientras la cámara se mueve (ahorra batería). Ej: rci (Red Contra Incendio) pone 2 cuadros pendientes. */
  framesPendientes?: number;
}

/** Interpola cámara persp + target hacia la pose dada (ease-out cúbico).
 * El tween es común a los 3 visores; el encuadre/vistas sigue forkeado (viewsRci) y cada visor activa su persp ANTES de llamar. */
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
