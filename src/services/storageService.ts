const PREFIX = 'civilflow_';

export function loadFromStorage<T>(key: string, fallback: T): T {
  const fullKey = PREFIX + key;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService load:', key, e);
    return fallback;
  }
}

export function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService save:', key, e);
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService remove:', key, e);
  }
}

import { supabase } from '../lib/supabase';
import { TRAZOS_PREFIX } from '../constants/storage-keys';

export interface PlanTrazos {
  ts?: number;
  ramales?: unknown[];
  bajantes?: unknown[];
}

export function loadPlanTrazos(planId: string): PlanTrazos | null {
  return loadFromStorage<PlanTrazos | null>(TRAZOS_PREFIX + planId, null);
}

export function savePlanTrazos(planId: string, data: unknown): void {
  saveToStorage(TRAZOS_PREFIX + planId, data);
}

export async function saveTrazosToDB(planoId: string, data: unknown): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('plano_trazos')
      .upsert({ plano_id: planoId, data }, { onConflict: 'plano_id' })
      .eq('user_id', user.id);
    if (error) {
      if (import.meta.env.DEV) console.error('storageService saveTrazosToDB:', error);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService saveTrazosToDB exception:', e);
  }
}

export async function loadTrazosFromDB(planoId: string): Promise<PlanTrazos | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('plano_trazos')
      .select('data')
      .eq('plano_id', planoId)
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (error) {
      if (import.meta.env.DEV) console.error('storageService loadTrazosFromDB:', error);
      return null;
    }
    return (data?.data as PlanTrazos) || null;
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService loadTrazosFromDB exception:', e);
    return null;
  }
}
