import { loadFromStorage } from '../services/storageService.ts';
import { PLANS_META_KEY } from '../constants/storage-keys.ts';

/** Entrada de 'plans_meta': la calibración de un plano (orígen, escala, si es global). */
export interface PlanMeta {
  id: number | string;
  /** Orígen de calibración (pixel del plano). */
  origen?: { x_px: number; y_px: number } | null;
  /** Escala del doc (metros por pixel). */
  scale: number;
  /** La escala viene de la calibración global (no de una manual). */
  calGlobal?: boolean | null;
  [k: string]: unknown;
}

/**
 * Lee el 'plans_meta' (calibraciones) del storage.
 *
 * La lectura cruda de la clave estaba copiada en 4 sitios (el visor, el cargador de trazos y
 * los espejos de aparatos) con parseos distintos: una sola fuente.
 */
export function leerPlansMeta(): PlanMeta[] {
  const raw = loadFromStorage<PlanMeta[] | string | null>(PLANS_META_KEY, null);
  if (!raw) return [];
  if (typeof raw !== 'string') return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlanMeta[]) : [];
  } catch {
    return [];
  }
}

/**
 * \u00bfEste plano está calibrado (tiene origen)? Lo usan el visor y el cargador de trazos.
 * @param meta - el `plans_meta` ya leído.
 * @param planId - el plano a preguntar.
 */
export function planCalibrado(meta: PlanMeta[], planId: string | number): boolean {
  return !!meta.find((m) => String(m.id) === String(planId) && m.origen);
}
