const PREFIX = 'civilflow_';

const _cache = new Map<string, any>();
export function cacheClear(key?: string) {
  if (key) _cache.delete(PREFIX + key);
  else _cache.clear();
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  const fullKey = PREFIX + key;
  if (_cache.has(fullKey)) return _cache.get(fullKey) as T;
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw === null) return fallback;
    const result = JSON.parse(raw) as T;
    _cache.set(fullKey, result);
    return result;
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService load:', key, e);
    return fallback;
  }
}

export function saveToStorage(key: string, data: unknown): void {
  const fullKey = PREFIX + key;
  _cache.delete(fullKey);
  try {
    localStorage.setItem(fullKey, JSON.stringify(data));
  } catch (e) {
    if (import.meta.env.DEV) console.error('storageService save:', key, e);
  }
}

export function removeFromStorage(key: string): void {
  const fullKey = PREFIX + key;
  _cache.delete(fullKey);
  try {
    localStorage.removeItem(fullKey);
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
