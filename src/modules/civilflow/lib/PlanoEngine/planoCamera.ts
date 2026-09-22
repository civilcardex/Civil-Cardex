import type { Point } from './planoCoords';

export type { Point };
/**
 * Cámara del motor CAD: zoom absoluto anclado a un punto del canvas (la MISMA matemática que
 * repetían doZoom / zoomStep / rueda / pinch — ahora un solo lugar). Clamp 0.05–6.
 */

export interface CamaraConRender {
  zoom: number;
  offX: number;
  offY: number;
  render(): void;
}

/** Aplica el zoom absoluto `nzRaw` (clampeado) manteniendo el punto (mx,my) del canvas fijo
 *  en pantalla. No-op si el zoom ya es igual tras el clamp. */
export function zoomAnclado(cam: CamaraConRender, nzRaw: number, mx: number, my: number): void {
  const nz = Math.max(0.05, Math.min(6, nzRaw));
  if (nz === cam.zoom) return;
  cam.offX = mx - (mx - cam.offX) * (nz / cam.zoom);
  cam.offY = my - (my - cam.offY) * (nz / cam.zoom);
  cam.zoom = nz;
  cam.render();
}
