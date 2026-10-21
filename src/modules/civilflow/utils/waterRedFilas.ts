// Hub de compatibilidad del cálculo de redes de agua: re-exporta los sub-módulos para que los
// consumidores sigan importando desde aquí.
export type { BajanteRaw } from './waterFilasCompartido.ts';
export {
  isAf,
  isContador,
  isAC1,
  isAC2,
  APARATO_PMAX_BY_CODE,
  HEATER_LOSS_FACTOR,
} from './waterFilasCompartido.ts';
export type { WnRow } from './waterFilasNucleo.ts';
export { computeWaterNetworkRows, computeHeaterNetworkTotal } from './waterFilasNucleo.ts';
export type { AcometidaSummary } from './waterFilasAcometida.ts';
export { computeAcometidaSummary } from './waterFilasAcometida.ts';
