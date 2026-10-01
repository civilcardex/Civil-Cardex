import type { MOUSE } from 'three';
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
