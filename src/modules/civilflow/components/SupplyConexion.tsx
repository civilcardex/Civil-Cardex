/**
 * Fachada de la tabla de acometida (des-monotilización 2026-10-19).
 *
 * El componente y sus sub-componentes viven en `supplyConnection/`; este archivo conserva la
 * API pública (el import por defecto y los tipos) que usa WaterNetworkDesign.
 */
export { default } from './supplyConnection/Acometida';
export { LazyNum } from './supplyConnection/LazyNum';
export type {
  FilaResult,
  LData,
  ContadorSel,
  DiamOpt,
  AcometidaProps,
} from './supplyConnection/tipos.ts';
export {
  SupplyConnection_S1,
  SupplyConnection_S2,
  SECTION_COL,
  SECTION_HDR,
  SECTION_H4,
  TH_CENTER,
  TD_PARAM_LABEL,
  TD_PARAM_VALUE,
  TD_PARAM_UNIT,
  SCROLL_INNER,
} from './supplyConnection/estilos.ts';
