/** Tipos compartidos del borrado (deleteSelected): el contexto del borrado EN CONJUNTO y la
 *  firma pública de deleteSelected. Ej: borrar un canal en conjunto añade sus ramales a
 *  ctx.toDelete y el mismo recorrido los procesa con el pipeline completo de ramal. */
import type { IPlanoEngineCore } from '../PlanoState.ts';

/** Opciones del borrado: `noMerge` = borrado quirúrgico del borrador (NO re-une las mitades
 *  de una división — el tronco de la yee doble debe quedar intacto). */
export type OptsBorrado = { noMerge?: boolean };

/** Firma pública de deleteSelected (la misma de PlanoState). La recibe el borrado INDIVIDUAL
 *  de ramal para re-dispararse con el lote expandido de la división — se pasa como parámetro
 *  para que los módulos por tipo no importen al pipeline (sin dependencia circular). */
export type DeleteSelectedFn = (
  engine: IPlanoEngineCore,
  ids?: string[],
  opts?: OptsBorrado,
) => void;

/** Acumuladores del borrado EN CONJUNTO (ruta de ids): cada rama por tipo (ramal/bajante/
 *  fantasma) añade a estos conjuntos mientras recorre, y el pipeline hace los barridos finales
 *  UNA sola vez al terminar (fantasmas batch, purga de estado, renumeración). Los conjuntos y
 *  arreglos se mutan por referencia; las banderas viven en `flags` porque una función
 *  extraída no puede reasignar el booleano local del llamador. */
export interface CtxBorradoConjunto {
  engine: IPlanoEngineCore;
  opts?: OptsBorrado;
  /** Ids pendientes de borrar: el bucle lo recorre mientras CRECE (Set en iteración: un canal
   *  borrado añade sus ramales y caen en la misma pasada). */
  toDelete: Set<string>;
  /** Ids de ramal borrados (y Ldesvios arrastrados): se purgan del storage de UDs/conteos. */
  deletedRamalIds: Set<string>;
  /** Fuentes de fantasmas entre pisos a barrer en UN solo batch al final del recorrido. */
  ghostSourcesABorrar: Set<string>;
  /** Puntos de los ramales borrados: los brazos restantes que queden tocándose se funden. */
  deletedPts: number[][];
  /** Redes de ramales a renumerar (RS/T por red af/ac/…). */
  netsToRenumber: Set<string>;
  /** Redes de bajantes a renumerar (o 'montante'/'red_publica'/'contador' con regla propia). */
  bajNetsToRenumber: Set<string>;
  flags: { renumberAreas: boolean; renumberCanalesNeeded: boolean };
}
