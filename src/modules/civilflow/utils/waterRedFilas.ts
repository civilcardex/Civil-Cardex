// Hub de compatibilidad del cálculo de redes de agua: re-exporta los sub-módulos para que los
// consumidores sigan importando desde aquí.
export type { BajanteRaw } from './waterRowsShared.ts';
export {
  isAf,
  isContador,
  isAC1,
  isAC2,
  APARATO_PMAX_BY_CODE,
  HEATER_LOSS_FACTOR,
} from './waterRowsShared.ts';
export type { WnRow } from './waterRowsCore.ts';
export { computeWaterNetworkRows, computeHeaterNetworkTotal } from './waterRowsCore.ts';
export type { AcometidaSummary } from './waterRowsAcometida.ts';
export { computeAcometidaSummary } from './waterRowsAcometida.ts';
