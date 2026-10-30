// buildSyncData + write/read de hidro y san (entrada/salida del blob de trazos).
// Extraído verbatim de drawingSync.
import { loadFromStorage, saveToStorage } from '../services/storageService.ts';
import { devError } from '../../../utils/devError.ts';
import {
  HYDRO_SYNC_KEY,
  SAN_SYNC_KEY,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
} from '../constants/storage-keys.ts';
import type { SyncPlanInput, SyncDataResult } from './drawingSyncTypes.ts';
import { buildPrefixedSyncData, buildNonPrefixedSyncData } from './drawingSyncBuilders.ts';
import { performGarbageCollection, reanclarClavesDesdeTrazosLocales } from './drawingSyncGc.ts';
import { emitSanSync, emitHidroSync } from './fixtureEvents.ts';
// buildSyncData + write/read de hidro y san (entrada/salida del blob de trazos).
// Extraído verbatim de drawingSync.

/** Arma el SyncDataResult de una familia de redes: primero re-ancla claves y hace GC (best-effort), luego delega en el builder prefijado o legacy. */
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

/** Sync hidro af (Agua Fria)/ac (Agua Caliente) a storage (con GC de huérfanas antes). */
export function writeHydroDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, HYDRO_FAMILIES, 'h', HYDRO_SYNC_KEY);
    saveToStorage(HYDRO_SYNC_KEY, data);
    emitHidroSync(data);
    return data;
  } catch (e) {
    devError('writeHydroDrawingSync error:', e);
    return null;
  }
}

/** Lee el sync hidro af (Agua Fria)/ac (Agua Caliente) persistido. */
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

/** Sync sanitario san (Sanitaria)/ll (Lluvias)/vent (Ventilacion) a storage (con GC antes). */
export function writeSanDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, SAN_FAMILIES, '', SAN_SYNC_KEY);
    saveToStorage(SAN_SYNC_KEY, data);
    emitSanSync(data);
    return data;
  } catch (e) {
    devError('writeSanDrawingSync error:', e);
    return null;
  }
}

/** Lee el sync sanitario san (Sanitaria)/ll (Lluvias)/vent (Ventilacion) persistido. */
export function readSanDrawingSync() {
  return loadFromStorage(SAN_SYNC_KEY, { planes: {}, aparatosByTramo: {}, updatedAt: 0 }) as {
    planes: Record<string, unknown>;
    aparatosByTramo: Record<string, unknown>;
    updatedAt: number;
  };
}
