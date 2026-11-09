/** Bus de fixtures (nombres + emit/subscribe DOM; el swap futuro se hace solo aquí). */
// ponytail: el transporte sigue siendo DOM a propósito — EV_STORAGE es nativo del navegador y
// rejillasGasodSync depende del timing/detail de EV_APARATOS_CLEAR; cambiar el transporte
// cambiaría comportamiento. Este módulo centraliza los nombres para que el swap sea de 1 archivo.
/** Aparatos de un tramo se borraron → las tablas recalculan sus conteos. */
export const EV_APARATOS_CLEAR = 'aparatos-clear';
/** Un write de red san aterrizó en storage → las tablas san se refrescan. */
export const EV_SAN_SYNC = 'civilflow_san_sync_changed';
/** Un write de datos hidráulicos aterrizó → tablas de af/ac se refrescan. */
export const EV_HIDRO_SYNC = 'civilflow_hidro_sync_changed';
/** El piso terminó de cargar (motor + trazos) → quien conta ramales recalcula. */
export const EV_PLAN_LOADED = 'civilflow_plan_loaded';
/** El autosave del visor acabó de escribir el doc de trazos de un piso: el módulo RCI lo
 *  escucha para re-leer la geometría fresca (muros, gabinetes) sin recargar el piso. */
export const EV_TRAZOS_SAVED = 'civilflow_trazos_saved';
/** El módulo RCI acaba de escribir su espejo local (RCI_ESTADO_VIVO_KEY): el visor lo
 *  escucha para re-inyectar Dmuro al motor (mismo patrón que EV_TRAZOS_SAVED). */
export const EV_RCI_VIVO_SAVED = 'civilflow_rci_vivo_saved';
/** Evento nativo del navegador (se dispara con CUALQUIER localStorage.setItem). */
export const EV_STORAGE = 'storage';

function emit(name: string, detail?: unknown): void {
  window.dispatchEvent(detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));
}

/** Dispara EV_APARATOS_CLEAR (borraron aparatos de un tramo). */
export function emitAparatosClear(detail?: unknown): void {
  emit(EV_APARATOS_CLEAR, detail);
}
/** Dispara EV_SAN_SYNC (aterrizó un write de red san). */
export function emitSanSync(detail?: unknown): void {
  emit(EV_SAN_SYNC, detail);
}
/** Dispara EV_HIDRO_SYNC (aterrizó un write de datos hidráulicos af/ac). */
export function emitHidroSync(detail?: unknown): void {
  emit(EV_HIDRO_SYNC, detail);
}
/** Dispara EV_PLAN_LOADED (el piso terminó de cargar). */
export function emitPlanLoaded(): void {
  emit(EV_PLAN_LOADED);
}
/** Dispara EV_TRAZOS_SAVED (el autosave escribió el doc de trazos). */
export function emitTrazosSaved(): void {
  emit(EV_TRAZOS_SAVED);
}
/** Dispara EV_RCI_VIVO_SAVED (RCI escribió su espejo local). */
export function emitRciVivoSaved(): void {
  emit(EV_RCI_VIVO_SAVED);
}
