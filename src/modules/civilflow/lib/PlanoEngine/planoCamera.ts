import type { Point } from './planoCoords';

export type { Point };
/** Acercar/alejar la vista SIN perder el punto donde está el mouse: la rueda, el pellizco y los
 *  botones usan esta misma matemática (zoom entre 0.05 y 6). */

export interface CamaraConRender {
  zoom: number;
  offX: number;
  offY: number;
  render(): void;
}

/** Aplica el zoom anclado: si el motor puede agrupar renders, se pinta UNA sola vez por cuadro (en
 *  vez de una por evento de rueda). */
export function zoomAnclado(cam: CamaraConRender, nzRaw: number, mx: number, my: number): void {
  const nz = Math.max(0.05, Math.min(6, nzRaw));
  if (nz === cam.zoom) return;
  cam.offX = mx - (mx - cam.offX) * (nz / cam.zoom);
  cam.offY = my - (my - cam.offY) * (nz / cam.zoom);
  cam.zoom = nz;
  const c = cam as CamaraConRender & { scheduleRender?: () => void };
  if (typeof c.scheduleRender === 'function') c.scheduleRender();
  else cam.render();
}
