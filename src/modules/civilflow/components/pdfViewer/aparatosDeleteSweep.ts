// Limpieza de stores de aparatos/accesorios tras un borrado (extraída de PdfViewer
// onDeleteHandler): barre las claves del PISO cargado asociadas a los ids borrados sin
// tocar las de otros pisos ni las reutilizadas por el renumerado.
import {
  APARATOS_BY_TRAMO_KEY,
  GAS_ACC_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../../constants/storage-keys.ts';
import { loadFromStorage, saveToStorage } from '../../services/storageService.ts';
import { claveDeBorrado } from './persistStrokes.ts';
import { isPlanKeyFor } from '../../lib/PlanoEngine/networkRenumber.ts';
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';

/** Mínimo del motor que la limpieza necesita: colecciones vivas + piso cargado. */
export type EngineDeSweep = Pick<IPlanoEngineCore, 'ramales' | 'bajantes' | '_loadedPlanId'>;

/**
 * Borra de los 3 stores (aparatos, accesorios gas, hidro) las claves del piso cargado que
 * quedaron huérfanas tras borrar elementos. Solo claves de ESTE piso (isPlanKeyFor) y solo si
 * el id no fue reciclado por el renumerado (el nuevo RS1 conserva lo suyo).
 */
export function limpiarStoresDeBorrado(eng: EngineDeSweep | null, ids: string[]): void {
  const cleanStore = (key: string) => {
    const store = loadFromStorage(key, {}) as Record<string, unknown>;
    let changed = false;
    // Solo claves del piso cargado: borrar RS4 aquí no debe borrar `san_RS4_<otroPlano>`
    // (cada piso numera por su cuenta; sin este filtro, borrar en un piso vaciaba las
    // UDs del mismo id en los demás).
    const loadedPid = eng?._loadedPlanId ?? null;
    // Ids actuales tras el borrado+renumerado (el nuevo RS1 ya existe en engine)
    const currentIds = new Set([
      ...(eng?.ramales.map((r) => r.id) ?? []),
      ...(eng?.bajantes.map((b) => b.id) ?? []),
      ...(eng?.ramales.map((r) => r.label) ?? []),
    ]);
    for (const k of Object.keys(store)) {
      if (!isPlanKeyFor(k, loadedPid)) continue;
      // No borrar si el nuevo ramal renumerado ocupa ese mismo id (ej. RS2→RS1):
      // currentIds contiene el nuevo RS1, así que no se borra.
      if (claveDeBorrado(k, ids, currentIds)) {
        delete store[k];
        changed = true;
      }
    }
    if (changed) saveToStorage(key, store);
  };
  cleanStore(GAS_ACC_KEY);
  cleanStore(APARATOS_BY_TRAMO_KEY);
  cleanStore(HYDRO_DATA_STORAGE_KEY);
}
