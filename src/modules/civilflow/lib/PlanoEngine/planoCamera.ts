import type { Point } from './planoCoords.ts';

export type { Point };

/** Lo mínimo que necesita la cámara para pintar: cuánto se agranda el dibujo (zoom) y cuánto se
 *  ha desplazado de lado (pan). */
export interface CamaraConRender {
  zoom: number;
  offX: number;
  offY: number;
  render(): void;
}

/** Tamaño del lienzo de DIBUJO: SOLO el área visible del visor (el contenedor ya recorta el exceso; antes con zoom alto cada frame repintaba ~50 MP). Ej: visor 1200×800 → lienzo 1200×800 CSS. @param visW - ancho visible. @param visH - alto visible. @returns tamaño en px CSS (0 si el área aún no está medida). */
export function tamanoLienzoDibujo(args: { visW: number; visH: number }): { w: number; h: number } {
  return { w: Math.max(0, Math.floor(args.visW || 0)), h: Math.max(0, Math.floor(args.visH || 0)) };
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
 * @returns identidad {zoom:1, off:0} si la lámina aún no está medida (pageW/pageH = 0): sin
 *   ese guard, sc=Infinity y offX=NaN — el canvas con transform NaN no pinta nada.
 */
export function encuadrarHoja(args: {
  visW: number;
  visH: number;
  pageW: number;
  pageH: number;
  pad?: number;
}): Encuadre {
  const { visW, visH, pageW, pageH } = args;
  if (!(pageW > 0) || !(pageH > 0)) return { zoom: 1, offX: 0, offY: 0 };
  const pad = args.pad ?? 16;
  const availW = Math.max(1, visW - pad * 2);
  const availH = Math.max(1, visH - pad * 2);
  const sc = Math.min(availW / pageW, availH / pageH);
  return {
    zoom: sc,
    // El lienzo de DIBUJO mide el área VISIBLE (no la lámina): la lámina se centra en
    // el viewport. La fórmula anterior (pageW*(1-sc)/2) la dejaba corrida a un lado.
    offX: (visW - pageW * sc) / 2,
    offY: (visH - pageH * sc) / 2,
  };
}

/** Encuadre que muestra SOLO el DIBUJO (el contenido) centrado, recortando el fondo de la lámina; cae a la hoja completa si bbox es null. Ej: un piso con 3 trazos se centra en esos 3 trazos. @param bbox - rectángulo del dibujo en px de plano (null si no hay nada). */
export function encuadrarDibujo(args: {
  visW: number;
  visH: number;
  pageW: number;
  pageH: number;
  bbox: BboxDibujo | null;
  pad?: number;
}): Encuadre {
  const { visW, visH, bbox } = args;
  if (!bbox) {
    return encuadrarHoja(args);
  }
  const pad = args.pad ?? 8;
  const w = Math.max(1, bbox.maxX - bbox.minX);
  const h = Math.max(1, bbox.maxY - bbox.minY);
  const availW = Math.max(1, visW - pad * 2);
  const availH = Math.max(1, visH - pad * 2);
  const sc = Math.min(availW / w, availH / h);
  // El motor dibuja así: cvs = plano * zoom + off → para centrar el bbox:
  // off = centro del viewport - centro del dibujo * zoom.
  return {
    zoom: sc,
    offX: visW / 2 - ((bbox.minX + bbox.maxX) / 2) * sc,
    offY: visH / 2 - ((bbox.minY + bbox.maxY) / 2) * sc,
  };
}

/** Rectángulo del dibujo de un motor INCLUIDAS las cotas (dims): sin ellas, un piso que solo tenga cotas caería a encuadrar la hoja vacía. @returns bbox en px de plano, o null si no hay nada trazado. */
export function ptsDeDibujoConDims(eng: {
  ramales?: Array<{ pts?: number[][] }>;
  bajantes?: Array<{ x?: number; y?: number }>;
  areas?: Array<{ pts?: number[][] }>;
  dims?: Array<{ x1?: number; y1?: number; x2?: number; y2?: number }>;
}): BboxDibujo | null {
  const pts: Array<{ x: number; y: number }> = [];
  for (const r of eng.ramales || []) for (const p of r.pts || []) pts.push({ x: p[0], y: p[1] });
  for (const b of eng.bajantes || []) {
    if (typeof b.x === 'number' && typeof b.y === 'number') pts.push({ x: b.x, y: b.y });
  }
  for (const a of eng.areas || []) {
    for (const p of (a as { pts?: number[][] }).pts || []) pts.push({ x: p[0], y: p[1] });
  }
  for (const d of eng.dims || []) {
    const dd = d as { x1?: number; y1?: number; x2?: number; y2?: number };
    if (typeof dd.x1 === 'number' && typeof dd.y1 === 'number') pts.push({ x: dd.x1, y: dd.y1 });
    if (typeof dd.x2 === 'number' && typeof dd.y2 === 'number') pts.push({ x: dd.x2, y: dd.y2 });
  }
  return bboxDePuntos(pts);
}

/** Rectángulo que abarca un conjunto de puntos (px de plano). */
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
