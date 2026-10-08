// buildSyncData + write/read de hidro y san (entrada/salida del blob de trazos).
// Extraído verbatim de drawingSync.
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { devError } from '../../../utils/devError';
import {
  HYDRO_SYNC_KEY,
  SAN_SYNC_KEY,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
} from '../constants/storage-keys';
import type { SyncPlanInput, SyncDataResult } from './drawingSyncTypes';
import { buildPrefixedSyncData, buildNonPrefixedSyncData } from './drawingSyncBuilders';
import { performGarbageCollection, reanclarClavesDesdeTrazosLocales } from './drawingSyncGc';
// buildSyncData + write/read de hidro y san (entrada/salida del blob de trazos).
// Extraído verbatim de drawingSync.

export function buildSyncData(
  plans: SyncPlanInput[],
  families: Set<string>,
  prefix: string,
  _storageKey: string,
): SyncDataResult {
  try {
    // Re-anclar primero: si el store perdió claves pero los trazos traen fixtures, se
    // restauran ANTES de evaluar huérfanos (si no, el GC las vería huérfanas... no las
    // borraría con caché vieja, pero tampoco volverían solas — orig. usuario piso 2).
    reanclarClavesDesdeTrazosLocales(plans);
    performGarbageCollection(plans);
  } catch (e) {
    devError('Garbage collection error:', e);
  }

  return prefix
    ? buildPrefixedSyncData(plans, families)
    : buildNonPrefixedSyncData(plans, families);
}

/**
 * Construye y persiste los datos de sync de dibujo hidráulico (af/ac) a partir de los datos de
 * trazo del plano. Corre la recolección de basura de claves aparato/hydro/gas huérfanas antes
 * de sincronizar.
 * @param plans - Array de descriptores de plano.
 * @returns El SyncDataResult construido o null ante error.
 */
export function writeHydroDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, HYDRO_FAMILIES, 'h', HYDRO_SYNC_KEY);
    saveToStorage(HYDRO_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    devError('writeHydroDrawingSync error:', e);
    return null;
  }
}

/**
 * Lee los datos de sync de dibujo hidráulico (af/ac) persistidos de localStorage.
 * @returns Datos de sync con planes, aparatosByTramo, hidroData, updatedAt.
 */
export function readHydroDrawingSync() {
  return loadFromStorage(HYDRO_SYNC_KEY, {
    planes: {},
    aparatosByTramo: {},
    hidroData: {},
    updatedAt: 0,
  }) as {
    planes: Record<string, unknown>;
    aparatosByTramo: Record<string, unknown>;
    hidroData: Record<string, unknown>;
    updatedAt: number;
  };
}

/**
 * Construye y persiste los datos de sync de dibujo sanitario (san/ll/vent) a partir de los datos
 * de trazo del plano. Corre la recolección de basura de claves aparato/hydro/gas huérfanas antes
 * de sincronizar.
 * @param plans - Array de descriptores de plano.
 * @returns El SyncDataResult construido o null ante error.
 */
export function writeSanDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, SAN_FAMILIES, '', SAN_SYNC_KEY);
    saveToStorage(SAN_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    devError('writeSanDrawingSync error:', e);
    return null;
  }
}

/**
 * Lee los datos de sync de dibujo sanitario (san/ll/vent) persistidos de localStorage.
 * @returns Datos de sync con planes, aparatosByTramo, updatedAt.
 */
export function readSanDrawingSync() {
  return loadFromStorage(SAN_SYNC_KEY, { planes: {}, aparatosByTramo: {}, updatedAt: 0 }) as {
    planes: Record<string, unknown>;
    aparatosByTramo: Record<string, unknown>;
    updatedAt: number;
  };
}
