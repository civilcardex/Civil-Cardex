import { loadFromStorage } from '../services/storageService.ts';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';

/**
 * Lee el dibujo (doc) de un plano del storage local.
 *
 * Devuelve null en TRES casos: no existe, es un JSON roto, o es null explícito. Los
 * consumidores que solo prueban EXISTENCIA (p. ej. prefetchTrazos) heredan la auto-cura:
 * un doc corrupto se re-descarga de la BD — antes (lectura cruda) el string roto contaba
 * como "presente" y el piso quedaba atrapado con su caché dañada.
 *
 * Antes esta lectura estaba COPIADA en 20 sitios (tablas, checks, contextos): cada copia
 * con su propio parseo y sus propios defaults. Una sola fuente para evitar que dos
 * pantallas lean doc distinto del mismo plano.
 */
export function leerDocDePlan<T = unknown>(planId: string | number): T | null {
  const raw = loadFromStorage<T | string | null>(TRAZOS_PREFIX + String(planId), null);
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
