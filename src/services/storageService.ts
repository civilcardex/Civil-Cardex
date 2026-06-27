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

export async function saveTrazosToDB(planoId: string, data: any): Promise<void> {
  try {
    const { error } = await supabase
      .from('plano_trazos')
      .upsert({ plano_id: planoId, data }, { onConflict: 'plano_id' });
    if (error) {
      if (import.meta.env.DEV) console.error('storageService saveTrazosToDB:', error);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService saveTrazosToDB exception:', e);
  }
}

export async function loadTrazosFromDB(planoId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('plano_trazos')
      .select('data')
      .eq('plano_id', planoId)
      .single();
      
    if (error) {
      // PGRST116 means zero rows, which is normal for a new plan
      if (error.code !== 'PGRST116') {
        if (import.meta.env.DEV) console.error('storageService loadTrazosFromDB:', error);
      }
      return null;
    }
    return data?.data || null;
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService loadTrazosFromDB exception:', e);
    return null;
  }
}
