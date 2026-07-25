import { devError } from '../../../utils/devError';

const PREFIX = 'civilflow_';

/**
 * Reads and parses a JSON value from localStorage.
 * @param key - Storage key (prefixed with `civilflow_`).
 * @param fallback - Default value returned when key is missing or parse fails.
 * @returns Parsed value of type T, or fallback on error.
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
 * Serializes a value to JSON and writes it to localStorage.
 * @param key - Storage key (prefixed with `civilflow_`).
 * @param data - Any JSON-serializable value.
 */
export function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    devError('storageService save:', key, e);
  }
}

/**
 * Removes a key from localStorage.
 * @param key - Storage key (prefixed with `civilflow_`).
 */
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    devError('storageService remove:', key, e);
  }
}

import { supabase } from '../../../lib/supabase';
import { TRAZOS_PREFIX, ACTIVE_PROYECTO_ID_KEY } from '../constants/storage-keys';

function getActiveProyectoId(): string | null {
  return localStorage.getItem(ACTIVE_PROYECTO_ID_KEY);
}

export interface PlanTrazos {
  ts?: number;
  ramales?: unknown[];
  bajantes?: unknown[];
}

/**
 * Loads cached plan-trace data from localStorage for a given plan.
 * @param planId - Plan identifier (suffixed after the trazos prefix).
 * @returns Parsed PlanTrazos object or null if not found.
 */
export function loadPlanTrazos(planId: string): PlanTrazos | null {
  return loadFromStorage<PlanTrazos | null>(TRAZOS_PREFIX + planId, null);
}

/**
 * Persists plan-trace data to localStorage cache.
 * @param planId - Plan identifier (suffixed after the trazos prefix).
 * @param data - Traces payload to cache.
 */
export function savePlanTrazos(planId: string, data: unknown): void {
  saveToStorage(TRAZOS_PREFIX + planId, data);
}

/**
 * Upserts plan-trace data to the Supabase `plano_trazos` table scoped to the authenticated user and active project.
 * @param planoId - Plan identifier.
 * @param data - Traces payload to persist.
 */
export async function saveTrazosToDB(planoId: string, data: unknown): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const proyectoId = getActiveProyectoId();
    const dbPlanoId = user.id + '_' + (proyectoId || 'default') + '_' + planoId;
    const { error } = await supabase
      .from('plano_trazos')
      .upsert(
        {
          plano_id: dbPlanoId,
          data,
          user_id: user.id,
          proyecto_id: proyectoId ? Number(proyectoId) : null,
        },
        { onConflict: 'plano_id' },
      );
    if (error) {
      devError('storageService saveTrazosToDB:', error);
    }
  } catch (e) {
    devError('storageService saveTrazosToDB exception:', e);
  }
}

/**
 * Fetches plan-trace data from Supabase for the authenticated user and active project.
 * @param planoId - Plan identifier.
 * @returns Parsed PlanTrazos object or null if not found / unauthenticated.
 */
export async function loadTrazosFromDB(planoId: string): Promise<PlanTrazos | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const proyectoId = getActiveProyectoId();
    const dbPlanoId = user.id + '_' + (proyectoId || 'default') + '_' + planoId;
    const { data, error } = await supabase
      .from('plano_trazos')
      .select('data')
      .eq('plano_id', dbPlanoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      devError('storageService loadTrazosFromDB:', error);
      return null;
    }
    return (data?.data as PlanTrazos) || null;
  } catch (e) {
    devError('storageService loadTrazosFromDB exception:', e);
    return null;
  }
}
