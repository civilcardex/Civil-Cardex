// localStorage del visor: carga/guardado con prefijo civilflow_, cuota, trazos locales y
// proyecto activo (validación UUID). Extraído verbatim de storageService (2026-10-06).
import { devError } from '../../../../utils/devError';
import { TRAZOS_PREFIX, ACTIVE_PROYECTO_ID_KEY } from '../../constants/storage-keys';
import type { PlanoWorkData } from '../../lib/PlanoEngine/PlanoPersistence';

const PREFIX = 'civilflow_';

/**
 * Lee y parsea un valor JSON desde localStorage.
 * @param key - Clave de storage (con prefijo `civilflow_`).
 * @param fallback - Valor por defecto cuando la clave no existe o el parseo falla.
 * @returns Valor parseado de tipo T, o fallback ante error.
 */
export function loadFromStorage<T>(key: string, fallback: T): T {
  const fullKey = PREFIX + key;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    devError('storageService load:', key, e);
    return fallback;
  }
}

/**
 * Serializa un valor a JSON y lo escribe en localStorage.
 * @param key - Clave de storage (con prefijo `civilflow_`).
 * @param data - Cualquier valor serializable a JSON.
 * @returns true si se guardó; false si falló (p. ej. cuota llena — antes fallaba mudo y
 * la caché local vieja hacía que el GC borrara claves de aparatos, orig. usuario piso 2).
 * Emite `civilflow_local_quota` / `civilflow_local_quota_ok` en window para la franja de UI.
 */
const quotaFailedKeys = new Set<string>();
/** Guarda un doc de trazos en caché preservando la marca `assocLayout` del doc PREVIO:
 *  la marca vive en el DOC (serializeWork no la lleva), y perderla re-arma la migración
 *  completa en la próxima apertura (pasadas 1+2 + push destructivo redundante). Todos los
 *  escritores de caché de trazos deben pasar por aquí, no por saveToStorage crudo. */
export function saveTrazosLocales(planId: string | number, doc: Record<string, unknown>): void {
  try {
    const previo = loadFromStorage<{ assocLayout?: number } | null>(
      TRAZOS_PREFIX + String(planId),
      null,
    );
    if (doc.assocLayout == null && previo?.assocLayout != null) {
      doc.assocLayout = previo.assocLayout;
    }
  } catch {
    /* sin marca previa accesible: guardar tal cual */
  }
  saveToStorage(TRAZOS_PREFIX + String(planId), doc);
}

export function saveToStorage(key: string, data: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    devError('storageService save:', key, e);
    quotaFailedKeys.add(key);
    try {
      window.dispatchEvent(new CustomEvent('civilflow_local_quota', { detail: { key } }));
    } catch {
      /* ignore */
    }
    return false;
  }
  if (quotaFailedKeys.size > 0) {
    quotaFailedKeys.clear();
    try {
      window.dispatchEvent(new Event('civilflow_local_quota_ok'));
    } catch {
      /* ignore */
    }
  }
  return true;
}

/**
 * Elimina una clave de localStorage.
 * @param key - Clave de storage (con prefijo `civilflow_`).
 */
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    devError('storageService remove:', key, e);
  }
}

/** Id numérico pre-conversión (p. ej. "42"): curado en vez de propagar un 22P02
 *  a loadProyectoData — el proyecto se re-abre desde la lista. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id activo (uuid) o null. Los ids legacy pre-conversión (numéricos) devuelven null
 *  PERO no se purgan aquí — la purga vive en efecto (ver uso en WorkAreaCivilFlow). */
export function getActiveProyectoId(): string | null {
  const raw = localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
  const id = raw && raw.trim() ? raw.trim() : null;
  return id && UUID_RE.test(id) ? id : null;
}

export type PlanTrazos = Partial<PlanoWorkData>;

/**
 * Carga datos de trazado de plano cacheados en localStorage para un plano dado.
 * @param planId - Identificador del plano (va después del prefijo de trazos).
 * @returns Objeto PlanTrazos parseado, o null si no existe.
 */
export function loadPlanTrazos(planId: string): PlanTrazos | null {
  return loadFromStorage<PlanTrazos | null>(TRAZOS_PREFIX + planId, null);
}

/**
 * Persiste datos de trazado de plano en la caché de localStorage.
 * @param planId - Identificador del plano (va después del prefijo de trazos).
 * @param data - Payload de trazos a cachear.
 */
export function savePlanTrazos(planId: string, data: unknown): void {
  saveToStorage(TRAZOS_PREFIX + planId, data);
}
