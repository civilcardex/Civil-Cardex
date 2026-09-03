// Hub de compatibilidad del cálculo de redes de agua: re-exporta los sub-módulos para que los
// consumidores sigan importando desde aquí.
export type { BajanteRaw } from './waterRowsShared';
export {
  isAf,
  isContador,
  isAC1,
  isAC2,
  APARATO_PMAX_BY_CODE,
  HEATER_LOSS_FACTOR,
} from './waterRowsShared';
export type { WnRow } from './waterRowsCore';
export { computeWaterNetworkRows, computeHeaterNetworkTotal } from './waterRowsCore';
export type { AcometidaSummary } from './waterRowsAcometida';
export { computeAcometidaSummary } from './waterRowsAcometida';
