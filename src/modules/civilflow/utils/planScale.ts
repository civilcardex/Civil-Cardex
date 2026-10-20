import { loadFromStorage, saveToStorage } from '../services/storageService';
import { TRAZOS_PREFIX } from '../constants/storage-keys';

/**
 * Escala con la que se dibujó un plano: la del DOC guardado (metros por px de plano).
 * El fondo del PDF se rasteriza con este MISMO factor — si se usa otro, la lámina y el
 * dibujo quedan en escalas distintas y los elementos se ven corridos (34% con doc a
 * 0.669 rasterizado a 0.5, orig. usuario).
 * @param planId - id del plano.
 * @returns escala del doc (ej. 0.669), o null si el plano no tiene doc en la caché local.
 */
export function escalaDeDoc(planId: string | number | null | undefined): number | null {
  if (planId == null || planId === '') return null;
  const doc = loadFromStorage<{ scaleM?: number } | null>(TRAZOS_PREFIX + String(planId), null);
  return typeof doc?.scaleM === 'number' && doc.scaleM > 0 ? doc.scaleM : null;
}

/** Clave del tamaño de la lámina por plano (px CSS de la página, a escala 1). */
const PAGINA_KEY = 'pagina_';

/**
 * Tamaño de la LÁMINA de un plano (px CSS del PDF a escala 1 — el tamaño del archivo, no el
 * de la escala del dibujo): con él el lienzo de dibujo y el contenedor se dimensionan ANTES de
 * que llegue el PDF — si no, el dibujo se pinta en un lienzo de 300×150 y al llegar la lámina
 * el contenedor se re-centra (el "salto" del visor, orig. usuario) y el trazo queda recortado
 * (el "recuadro", orig. usuario).
 * @param planId - id del plano.
 * @param escala - escala del doc (metros por px): el tamaño se devuelve YA aplicado.
 * @returns tamaño {w,h} en px CSS, o null si el plano aún no se ha rasterizado.
 */
export function paginaDeDoc(
  planId: string | number | null | undefined,
  escala?: number,
): { w: number; h: number } | null {
  if (planId == null || planId === '') return null;
  const p = loadFromStorage<{ w?: number; h?: number } | null>(PAGINA_KEY + String(planId), null);
  if (!p || !(Number(p.w) > 0) || !(Number(p.h) > 0)) return null;
  const f = escala && escala > 0 ? escala : 1;
  return { w: Math.round(Number(p.w) * f), h: Math.round(Number(p.h) * f) };
}

/** Guarda el tamaño de la LÁMINA de un plano (a escala 1 — lo escribe el render del PDF). */
export function guardarPaginaDeDoc(
  planId: string | number | null | undefined,
  w: number,
  h: number,
): void {
  if (planId == null || planId === '' || !(w > 0) || !(h > 0)) return;
  saveToStorage(PAGINA_KEY + String(planId), { w, h });
}

/** Petición de rasterización del fondo (página + escala de papel + opciones de densidad). */
export interface RenderReq {
  pageNum: number;
  sc: number;
  opts?: { bgOnly?: boolean; extraScale?: number };
}

/** Resultado de la cola: `arranca` = renderizar ya; `pendiente` = lo que queda esperando. */
export interface FilaRenderRes {
  arranca: boolean;
  pendiente: RenderReq | null;
}

/**
 * Decide si una petición de render arranca o se encola (F2): si hay un render en vuelo no
 * se descarta — queda como pendiente (la última gana) y se ejecuta al cerrar el actual.
 * Antes el guard la tiraba y la lámina se quedaba en la escala vieja toda la sesión.
 */
export function filaRender(
  enVuelo: boolean,
  pendiente: RenderReq | null,
  req: RenderReq,
): FilaRenderRes {
  if (!enVuelo) return { arranca: true, pendiente };
  return { arranca: false, pendiente: req };
}
