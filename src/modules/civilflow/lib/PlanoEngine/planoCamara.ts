import type { Point } from './planoCoordenadas.ts';

export type { Point };

/** Lo mínimo que necesita la cámara para pintar: cuánto se agranda el dibujo (zoom) y cuánto se
 *  ha desplazado de lado (pan). */
export interface CamaraConRender {
  zoom: number;
  offX: number;
  offY: number;
  render(): void;
}

/** Tamaño del lienzo de DIBUJO: debe cubrir el ÁREA VISIBLE, no solo la caja de la hoja.
 *  Con zoom > 1 el fondo se sale de la hoja (lo recorta el contenedor) pero un lienzo medido
 *  como la hoja cortaba el TRAZO en su borde: un "recuadro" que partía la geometría (laterales
 *  y superiores recortados, orig. usuario). Aquí el lienzo cubre la hoja×zoom y el viewport:
 *  el trazo se recorta JUSTO donde se recorta el fondo.
 * @param visW - ancho del área visible (el contenedor del visor).
 * @param visH - alto del área visible.
 * @param pageW - ancho de la hoja en px de la escala actual (0 si aún no se conoce).
 * @param pageH - alto de la hoja.
 * @param zoom - zoom de la cámara.
 * @returns tamaño del lienzo en px CSS.
 */
export function tamanoLienzoDibujo(args: {
  visW: number;
  visH: number;
  pageW: number;
  pageH: number;
  zoom: number;
}): { w: number; h: number } {
  const { visW, visH, pageW, pageH, zoom } = args;
  const z = zoom > 0 ? zoom : 1;
  return {
    w: Math.max(visW || 0, Math.ceil(pageW * z)),
    h: Math.max(visH || 0, Math.ceil(pageH * z)),
  };
}

/** El encuadre que se aplica: zoom + desplazamiento (en px de la hoja, espacio del canvas). */
export interface Encuadre {
  zoom: number;
  offX: number;
  offY: number;
}

/** Rectángulo del DIBUJO dentro de la hoja (en px de plano, no de pantalla). */
export interface BboxDibujo {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Encuadre que muestra la HOJA COMPLETA centrada en el viewport.
 * @param visW - ancho del \u00e1rea visible.
 * @param visH - alto del \u00e1rea visible.
 * @param pageW - ancho de la hoja.
 * @param pageH - alto de la hoja.
 * @param pad - aire (px) alrededor de la hoja.
 */
export function encuadrarHoja(args: {
  visW: number;
  visH: number;
  pageW: number;
  pageH: number;
  pad?: number;
}): Encuadre {
  const { visW, visH, pageW, pageH } = args;
  const pad = args.pad ?? 16;
  const availW = Math.max(1, visW - pad * 2);
  const availH = Math.max(1, visH - pad * 2);
  const sc = Math.min(availW / pageW, availH / pageH);
  return {
    zoom: sc,
    // El lienzo de DIBUJO mide el \u00e1rea VISIBLE (no la l\u00e1mina): la l\u00e1mina se centra en
    // el viewport. La f\u00f3rmula anterior (pageW*(1-sc)/2) la dejaba corrida a un lado.
    offX: (visW - pageW * sc) / 2,
    offY: (visH - pageH * sc) / 2,
  };
}

/**
 * Encuadre que muestra SOLO el DIBUJO (el contenido), centrado: recorta el fondo negro de la
 * l\u00e1mina y del visor (orig. usuario: "que se vea solo el plano, no el fondo negro").
 * Si no hay dibujo (piso vac\u00edo) cae a la hoja completa.
 * @param bbox - rect\u00e1ngulo del dibujo en px de plano (null si no hay nada).
 */
export function encuadrarDibujo(args: {
  visW: number;
  visH: number;
  pageW: number;
  pageH: number;
  bbox: BboxDibujo | null;
  pad?: number;
}): Encuadre {
  const { visW, visH, bbox } = args;
  if (!bbox || bbox.maxX <= bbox.minX || bbox.maxY <= bbox.minY) {
    return encuadrarHoja(args);
  }
  const pad = args.pad ?? 8;
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const availW = Math.max(1, visW - pad * 2);
  const availH = Math.max(1, visH - pad * 2);
  const sc = Math.min(availW / w, availH / h);
  // El motor dibuja as\u00ed: cvs = plano * zoom + off \u2192 para centrar el bbox:
  // off = centro del viewport - centro del dibujo * zoom.
  return {
    zoom: sc,
    offX: visW / 2 - ((bbox.minX + bbox.maxX) / 2) * sc,
    offY: visH / 2 - ((bbox.minY + bbox.maxY) / 2) * sc,
  };
}

/** Rect\u00e1ngulo que abarca un conjunto de puntos (px de plano). */
export function bboxDePuntos(pts: Array<{ x: number; y: number }>): BboxDibujo | null {
  if (!pts.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY };
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
