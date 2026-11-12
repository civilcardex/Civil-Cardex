/** Tipos compartidos del catálogo de rejillas NTC (Norma Técnica Colombiana) 3631:
 *  grupos de artefactos a gas y la forma de una rejilla comercial. */

/** Grupos de gasodomésticos de la tabla (columnas Estufa/Calent./Otros). */
export type GrupoGasod = 'estufa' | 'calent' | 'otros';
/** Tipo de artefacto NTC 3631 por defecto de cada grupo (A suma, B suma con ducto, C estanco). */
export const TIPO_DEFAULT: Record<GrupoGasod, 'A' | 'B' | 'C'> = {
  estufa: 'A',
  calent: 'B',
  otros: 'A',
};
/** Referencia comercial de rejilla. aef = área efectiva libre (cm², ficha del fabricante);
 *  w×h = abertura útil en cm. aef 0/undefined = sin dato → no se sugiere (num. 5). */
export interface RejRef {
  marca: string;
  ref: string;
  tipo: string;
  ext: string;
  w: number;
  h: number;
  aef: number;
  uso: 'ambos' | 'ext' | 'int';
  origen: 'nacional' | 'importado';
}
