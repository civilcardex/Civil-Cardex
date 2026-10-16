import type { Point } from './planoCoords';

export type { Point };

/** Lo mínimo que necesita la cámara para pintar: cuánto se agranda el dibujo (zoom) y cuánto se
 *  ha desplazado de lado (pan). */
export interface CamaraConRender {
  zoom: number;
  offX: number;
  offY: number;
  render(): void;
}

/** Acercar o alejar sin perder el punto del mouse: la rueda, el pellizco con dos dedos y los
 *  botones +/- usan todos esta misma cuenta, y el zoom se limita entre 0.05 y 6.
 *  Ej: con zoom 2, seguir con la rueda deja el punto (500,300) del dibujo bajo el cursor.
 *  Si el motor sabe agrupar renders, pinta una vez por cuadro en vez de una por evento. */
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
