/** Barrel del modelo del Informe: un módulo por red (cumplimiento + tablas) y los chequeos
 *  compartidos. La fachada useReportTables.ts ensambla todo con la misma firma de siempre. */
export { filaEnRangoSanLl, noTrib, filaFalla, etiq, fallosDeTabla } from './complianceShared.ts';
export { useSanCumple } from './sanCompliance.ts';
export { useLlCumple } from './llCompliance.ts';
export { usePresionAfAc } from './pressureAfAc.ts';
export { useGasInforme } from './gasTable.ts';
export { useEquiposInforme } from './equipmentTables.ts';
