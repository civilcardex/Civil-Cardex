import { loadFromStorage } from '../services/storageService.ts';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';

/**
 * Lee el dibujo (doc) de un plano del storage local.
 *
 * Antes esta lectura estaba COPIADA en 6 sitios (tabla de bajantes, canales de lluvias,
 * bajantes de lluvia, contexto de lluvias, filas de bajante-vent y filas de acometida): cada
 * copia con su propio parseo y sus propios defaults. Una sola fuente para evitar que dos
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
