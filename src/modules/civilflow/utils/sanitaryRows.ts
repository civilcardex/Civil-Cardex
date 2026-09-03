// Hub de compatibilidad del cálculo sanitario: re-exporta los sub-módulos para que los
// consumidores sigan importando desde aquí.
export type { BajanteRaw, MergedApBase, SanConnectivity } from './sanConnectivity';
export { buildSanConnectivity } from './sanConnectivity';
export type { SanRow } from './sanRows';
export { computeSanRows } from './sanRows';
export { computeUdTable } from './sanUdTable';
