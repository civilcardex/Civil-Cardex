/** Constantes normativas y soluciones de ventilación de la NTC (Norma Técnica Colombiana)
 *  3631 para dimensionar aberturas de recintos con aparatos a gas.
 *  Ej: recinto confinado → 2 aberturas, cada una de EXT_DIR (6 cm²/kW). */

/** Constantes NTC 3631 (cm/cm²/mm). Numerales en comentario. */
export const NTC3631 = {
  VOL_KW: 3.4, // m³ por kW: límite recinto suficiente/confinado (4.1.1)
  EXT_DIR: 6, // cm²/kW por abertura, directa o conducto vertical (4.2.1 a)
  EXT_HOR: 11, // cm²/kW por abertura, conducto horizontal (4.2.1 b)
  UNICA: 11, // cm²/kW, Método 2 una abertura, mayor de esto y Σ conectores (4.2.2)
  INT_MISMO: 22, // cm²/kW, interior mismo piso (4.1.2 a)
  INT_MISMO_MIN: 645, // cm², mínimo absoluto interior mismo piso (4.1.2 a)
  INT_OTRO: 44, // cm²/kW, interior otro piso (4.1.2 b)
  H_SUP: 180, // cm, borde inferior mínimo de la abertura superior (4.1.2, 4.2)
  H_INF: 30, // cm, borde superior máximo de la abertura inferior (4.1.2, 4.2.1)
  ZOCALO: 4, // cm, separación práctica de la rejilla inferior al piso
  MALLA: 6.3, // mm, luz mínima de malla de protección (5)
  MIN_LADO: 8, // cm, dimensión menor mínima de toda abertura (4.1.2, 4.2, 4.3)
  ALT_TOPE: 30, // cm, alternativa: abertura superior comenzando a ≤30 cm del techo
  ALT_HMAX: 60, // cm, altura máxima de la banda de ubicación alternativa
} as const;

/** Soluciones de ventilación (columna Tipo de Ventilación). Clave → config del cálculo. */
export const SOL: Record<
  string,
  {
    t: string;
    com: 'directa' | 'horizontal';
    met: '1' | '2';
    adj: boolean;
    piso?: 'mismo' | 'otro';
    comb?: boolean;
  }
> = {
  'ext-dir': { t: 'Exterior · directa/vertical', com: 'directa', met: '1', adj: false },
  'ext-hor': { t: 'Exterior · conducto horizontal', com: 'horizontal', met: '1', adj: false },
  'ext-m2': { t: 'Exterior · método 2 (una)', com: 'directa', met: '2', adj: false },
  'int-mismo': { t: 'Interior · mismo piso', com: 'directa', met: '1', adj: true, piso: 'mismo' },
  'int-otro': { t: 'Interior · otro piso', com: 'directa', met: '1', adj: true, piso: 'otro' },
  'comb-dir': {
    t: 'Combinación int.+ext. · directa',
    com: 'directa',
    met: '1',
    adj: false,
    comb: true,
  },
  'comb-hor': {
    t: 'Combinación int.+ext. · conducto horiz.',
    com: 'horizontal',
    met: '1',
    adj: false,
    comb: true,
  },
};
