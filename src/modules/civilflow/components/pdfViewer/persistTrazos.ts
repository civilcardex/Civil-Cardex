/**
 * Persistencia del snapshot del engine (visor → caché local + BD). Núcleo compartido por el
 * autosave debounced (usePdfAutoSave.performSave) y el onDirty del engine — antes la secuencia
 * estaba duplicada en ambos lados y podía divergir (ts, LAST_TRAZOS_ID, sync a BD).
 */
import { saveToStorage, saveTrazosToDB } from '../../services/storageService';
import { markPlanTrazosFresh } from '../../utils/drawingSync';
import { TRAZOS_PREFIX, LAST_TRAZOS_ID_KEY } from '../../constants/storage-keys';

/** Guarda el trabajo del engine bajo `id` con ts fresco; a BD solo si el id es real (no 'work',
 *  el doc de trabajo sin plano). Sincronía total con el storage local. */
export interface TrazosSnapshot {
  ts?: number;
  scaleM?: number;
  dims?: unknown[];
}

export function persistTrazosSnapshot(
  eng: { saveWork(): TrazosSnapshot },
  id: string | number,
): void {
  const work = eng.saveWork();
  work.ts = Date.now();
  saveToStorage(TRAZOS_PREFIX + String(id), work);
  markPlanTrazosFresh(id);
  if (id !== 'work') {
    saveToStorage(LAST_TRAZOS_ID_KEY, id);
    saveTrazosToDB(String(id), work);
  }
}

/** ¿La clave de conteos `k` corresponde a un elemento borrado? Solo se tocan claves del piso
 *  cargado (isPlanKeyFor, filtro del caller): borrar RS4 en un piso no debe vaciar las UDs del
 *  mismo id en los demás. Tampoco se borra si un ramal renumerado ocupó ese id (RS2→RS1). */
export function claveDeBorrado(k: string, ids: string[], currentIds: Set<string>): boolean {
  const segs = k.split('_');
  let idInKey = segs[1] ?? '';
  // Claves de Ldesvio (san_LD_BAN2_17): el id real es compuesto (LD_BAN2) — con segs[1]='LD'
  // estas claves jamás se limpiaban en esta ruta (quedaban solo para la cascada del engine).
  if (idInKey === 'LD') idInKey = `LD_${segs[2] ?? ''}`;
  for (const id of ids) {
    const isExact = idInKey === id;
    const isTributaryOfDeleted = idInKey.startsWith('T') && idInKey.endsWith(id);
    if ((isExact || isTributaryOfDeleted) && !currentIds.has(idInKey)) return true;
  }
  return false;
}
