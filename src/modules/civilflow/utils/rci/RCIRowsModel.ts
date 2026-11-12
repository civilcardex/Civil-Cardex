/**
 * Modelo de filas de la UI de diseño RCI (Red Contra Incendio): convierte el estado del motor
 * (RciState) y su resultado (RciResult) en las filas planas que pintan las tablas — tipologías,
 * ramales, tramos, verificaciones agrupadas y pares etiqueta/valor de resultados — más las
 * semillas amarillas del "proyecto nuevo" del HTML de referencia. Puro: sin React ni storage.
 * Ej: filasRamales(red, rd)[1].Q = 50.75 (el ramal R1 del ejemplo cierra con 50.75 gpm).
 * Fachada: el contenido vive dividido por responsabilidad en rowsModel/ (defaults + siembra,
 * filas de tablas, navegación de verificaciones y resultados Kv) — este archivo re-exporta
 * TODO con los mismos nombres para que los consumidores no cambien.
 */

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
  filasTipologias,
  resumenTipologias,
  filasRamales,
  desgloseDeTramo,
  filasTramos,
  GRUPOS_CHECK,
  grupoDeCheck,
  filasVerificaciones,
  kvRociadorDiseno,
  kvRociadorCobertura,
  kvSiamesa,
  kvBombaTanque,
} from './rowsModel/index.ts';
export type { FilaTipologia, FilaRamalRci, FilaTramoRci, KvRci } from './rowsModel/index.ts';
