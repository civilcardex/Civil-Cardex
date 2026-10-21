// Hub de compatibilidad del cálculo sanitario: re-exporta los sub-módulos para que los
// consumidores sigan importando desde aquí.
export type { BajanteRaw, MergedApBase, SanConnectivity } from './sanConnectivity';
export { buildSanConnectivity } from './sanConnectivity';
export type { SanRow } from './sanFilas.ts';
export { computeSanRows } from './sanFilas.ts';
export { computeUdTable } from './sanUdTabla.ts';
