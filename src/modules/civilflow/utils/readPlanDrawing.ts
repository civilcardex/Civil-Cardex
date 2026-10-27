import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';

/**
 * Cache de docs parseados por plan (performance: los paneles de lluvias re-leían los
 * 30 pisos ×4-6 JSON.parse por render). Invalidación POR VALOR del raw: si el doc
 * cambió (autosave, otra pestaña, clear), el string difiere y re-parsea — sin hooks
 * de invalidación. Tope FIFO de 40 pisos: el heap de 30 docs ≈ decenas de MB, acotado.
 */
const CACHE_MAX = 40;
const cache = new Map<string, { raw: string; data: unknown }>();

function cacheGet(planId: string, raw: string): unknown | undefined {
  const hit = cache.get(planId);
  if (hit && hit.raw === raw) {
    // Refrescar posición FIFO (Map mantiene orden de inserción).
    cache.delete(planId);
    cache.set(planId, hit);
    return hit.data;
  }
  return undefined;
}

function cachePut(planId: string, raw: string, data: unknown): void {
  if (cache.size >= CACHE_MAX) {
    const masViejo = cache.keys().next().value;
    if (masViejo != null) cache.delete(masViejo);
  }
  cache.set(planId, { raw, data });
}

/**
 * Lee el dibujo (doc) de un plano del storage con cache invalidada POR VALOR del raw: si el
 * doc cambió (autosave, otra pestaña, clear) el string difiere y re-parsea; tope FIFO de 40
 * pisos. Devuelve null si no existe, está roto o es null explícito — los que solo prueban
 * existencia heredan la auto-cura (el doc corrupto se re-descarga de BD). Única fuente de
 * lectura: antes estaba COPIADA en 20 sitios con parseo y defaults propios.
 */
export function leerDocDePlan<T = unknown>(planId: string | number): T | null {
  let raw: string | null;
  try {
    // Lectura directa (loadFromStorage ya parsea — aquí el parse es nuestro, cacheado).
    raw = localStorage.getItem('civilflow_' + TRAZOS_PREFIX + String(planId));
  } catch {
    return null;
  }
  if (!raw) return null;
  const hit = cacheGet(String(planId), raw);
  if (hit !== undefined) return hit as T;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  cachePut(String(planId), raw, data);
  return data as T;
}
