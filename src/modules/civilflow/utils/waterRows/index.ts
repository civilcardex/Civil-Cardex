// Barrel del cálculo de filas de diseño af (Agua Fria)/ac (Agua Caliente): la fachada waterRowsCore.ts
// re-exporta desde aquí SOLO la superficie pública (mismos nombres que el monolito original) —
// los módulos internos (connectivity/loads/acometida/pressures/rows) no son API.
export type { WnRow } from './types.ts';
export { computeWaterNetworkRows, computeHeaterNetworkTotal } from './compute.ts';
