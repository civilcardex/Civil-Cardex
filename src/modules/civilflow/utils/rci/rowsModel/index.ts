/** Barril del modelo de filas RCI: re-exporta las 4 responsabilidades en que vive dividido
 *  (defaults/siembra, filas de tablas, navegación de verificaciones y resultados Kv).
 *  Ej: import { sembrarRci } from '…/utils/rci/rowsModel/index.ts'. */
export {
  SINO,
  AUTO_SI_NO,
  SISTEMAS,
  RIESGOS,
  CONSTR_OPCIONES,
  CLASES_SP,
  MATERIALES,
  DIAMETROS,
  ZONAS_SIS,
  sembrarRci,
} from './defaults.ts';
export {
  filasTipologias,
  resumenTipologias,
  filasRamales,
  desgloseDeTramo,
  filasTramos,
} from './rows.ts';
export type { FilaTipologia, FilaRamalRci, FilaTramoRci } from './rows.ts';
export { GRUPOS_CHECK, grupoDeCheck, filasVerificaciones } from './checksNavigation.ts';
export { kvRociadorDiseno, kvRociadorCobertura, kvSiamesa, kvBombaTanque } from './kvResults.ts';
export type { KvRci } from './kvResults.ts';
