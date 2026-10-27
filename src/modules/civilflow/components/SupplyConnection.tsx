/**
 * Fachada de la tabla de acometida (des-monotilización 2026-10-19).
 *
 * El componente y sus sub-componentes viven en `supplyConnection/`; este archivo conserva la
 * API pública (el import por defecto y los tipos) que usa WaterNetworkDesign.
 */
export { default } from './supplyConnection/Acometida';
export { LazyNum } from './supplyConnection/LazyNum';
export type { FilaResult, AcometidaProps } from './supplyConnection/types.ts';
