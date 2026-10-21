import {
  loadFromStorage,
  saveToStorage,
  saveTrazosLocales,
  saveTrazosToDB,
} from '../services/storageService.ts';
import { TRAZOS_PREFIX } from '../constants/storage-keys.ts';

/**
 * Aplica un cambio al documento de un plano y lo persiste sin pisar lo que el usuario acaba de dibujar.
 * Ej: asociar un Ldesvio (ramal en L entre pisos) muta el motor vivo si el plano está abierto; si está cerrado, lee y guarda el storage.
 */

export interface MotorDoc {
  _loadedPlanId?: string | number | null;
  bajantes?: unknown[];
  ramales?: unknown[];
  saveWork?: () => object;
}

/** El doc de un plano, con sus piezas (bajantes/montantes y ramales). */
export interface DocPlano {
  bajantes?: unknown[];
  ramales?: unknown[];
  [k: string]: unknown;
}

/** Mutación + guardado del doc: el motor vivo manda si el plano está abierto. Ej: plano cerrado -> leer storage, mutar y guardar. */
export function aplicarEnDocDePlan(
  eng: MotorDoc | null | undefined,
  planId: string | number,
  mutador: (doc: DocPlano) => void,
): void {
  const idPlan = String(planId);
  const abierto = !!eng && String(eng._loadedPlanId ?? '') === idPlan;
  if (abierto && eng) {
    // El motor es la verdad: se muta su estado vivo y se persiste desde ahí.
    mutador({ bajantes: eng.bajantes ?? [], ramales: eng.ramales ?? [] });
    const work = eng.saveWork ? (eng.saveWork() as object) : null;
    if (!work) return;
    // ts FRESCO: el doc cambia (asociación aplicada) y debe quedar como el más nuevo —
    // sin ts, la caché local parecía vieja y el árbitro de carga dejaba ganar a la BD
    // (que aún no tenía el cambio) → la asociación se perdía al recargar.
    (work as { ts?: number }).ts = Date.now();
    // saveTrazosLocales (no saveToStorage): conserva la marca de asociación entre pisos.
    saveTrazosLocales(idPlan, work as Record<string, unknown>);
    void saveTrazosToDB(idPlan, work as never);
    return;
  }
  // Plano cerrado: se lee del storage y se guarda (no hay estado vivo que perder).
  const key = TRAZOS_PREFIX + idPlan;
  const raw = loadFromStorage<DocPlano | null>(key, null);
  if (!raw) return;
  mutador(raw);
  (raw as { ts?: number }).ts = Date.now();
  saveToStorage(key, raw);
  void saveTrazosToDB(idPlan, raw as never);
}
