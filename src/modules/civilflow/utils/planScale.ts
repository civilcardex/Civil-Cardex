import { loadFromStorage, saveToStorage, trazosDocHasContent } from '../services/storageService.ts';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';
import { VERSION_LAMINA_BASE } from '../lib/PlanoEngine/planoCoords.ts';
import type { PlanTrazos } from '../services/storageService.ts';

/** El PDF usa 72 puntos por pulgada; el factor interno cuenta 96. Ej.: 0.6667 en PDF → 1:50. */
export function escalaDePapel(factorInterno: number, esPdf: boolean): number {
  return factorInterno * (esPdf ? 72 / 96 : 1);
}

export function esArchivoPdf(file: Pick<File, 'type' | 'name'>): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Los dibujos nuevos usan coordenadas del PDF base; los antiguos conservan su tamaño guardado. */
export function escalaDeLamina(planId: string | number | null | undefined): number | null {
  if (planId == null || planId === '') return null;
  const doc = leerDocEscala(planId);
  if (!doc) return null;
  if ((doc.v ?? 0) >= VERSION_LAMINA_BASE || (!doc.ts && !trazosDocHasContent(doc))) return 1;
  return escalaValida(doc.scaleM);
}

function leerDocEscala(planId: string | number) {
  const raw = loadFromStorage<PlanTrazos | string | null>(TRAZOS_PREFIX + String(planId), null);
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as PlanTrazos | null;
  } catch {
    return null;
  }
}

function escalaValida(scale: number | undefined): number | null {
  return typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : null;
}

/**
 * Escala con la que se dibujó un plano: la del DOC guardado (metros por px de plano).
 * Se usa para medir el dibujo; no es el tamaño de la lámina.
 * @param planId - id del plano.
 * @returns escala del doc (ej. 0.669), o null si el plano no tiene doc en la caché local.
 */
export function escalaDeDoc(planId: string | number | null | undefined): number | null {
  if (planId == null || planId === '') return null;
  return escalaValida(leerDocEscala(planId)?.scaleM);
}

/** Clave del tamaño de la lámina por plano (px CSS de la página, a escala 1). */
const PAGINA_KEY = 'pagina_';

/**
 * Tamaño de la LÁMINA de un plano (px CSS del PDF a escala 1): con él el lienzo de dibujo y
 * el contenedor se dimensionan ANTES de que llegue el PDF — sin esto el dibujo nacía en un
 * lienzo 300×150, el visor saltaba al re-centrar y el trazo quedaba recortado (orig. usuario).
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
  mountCheck?: number;
  opts?: { bgOnly?: boolean; extraScale?: number; causa?: string };
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
