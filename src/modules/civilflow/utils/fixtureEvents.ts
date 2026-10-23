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
/** Evento nativo del navegador (se dispara con CUALQUIER localStorage.setItem). */
export const EV_STORAGE = 'storage';

function emit(name: string, detail?: unknown): void {
  window.dispatchEvent(detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));
}

export function emitAparatosClear(detail?: unknown): void {
  emit(EV_APARATOS_CLEAR, detail);
}
export function emitSanSync(detail?: unknown): void {
  emit(EV_SAN_SYNC, detail);
}
export function emitHidroSync(detail?: unknown): void {
  emit(EV_HIDRO_SYNC, detail);
}
export function emitPlanLoaded(): void {
  emit(EV_PLAN_LOADED);
}
