/**
 * Tipos compartidos de geometría y de "fantasma" entre pisos. Viven en un archivo propio SIN
 * imports (solo tipos simples) para que PlanoState, associateBajanteAcrossFloors y
 * storageService no tengan que importarse entre sí — eso rompía los ciclos de import que se
 * formaban cuando CrossFloorGhost vivía en associateBajanteAcrossFloors y LabelBoxCorners en
 * PlanoState.
 */

/** Caja de un texto dibujado en el plano, con sus esquinas ya calculadas — la usa el motor para
 *  saber dónde está cada etiqueta (de ramal, bajante o fantasma) y detectar clics sobre ella. */
export interface LabelBoxCorners {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  corners: { x: number; y: number }[];
}

// Un "fantasma" es un marcador de posición: NO es un bajante real, no transporta agua y no
// aparece en ningún cálculo hidráulico ni en las tablas de conteo. Sirve solo para mostrar, en
// un piso, el punto por donde llega el bajante del piso de arriba (con su flecha de dirección).
// Guardarlo aparte de `bajantes`/`ramales` garantiza que jamás contamine un total ni ocupe un
// espacio de etiqueta (BAN2, BAN3...) por accidente.
export interface CrossFloorGhost {
  id: string;
  net: string;
  code: string;
  x: number;
  y: number;
  dNominal: string;
  direccion: 'sube' | 'baja';
  /**
   * Dirección del bajante PADRE (el del piso superior). El fantasma apunta al revés (representa
   * el punto donde el padre "aterriza" en este piso), pero la etiqueta que se dibuja sobre el
   * fantasma debe mostrar la dirección real del padre para que quien mire el plano sepa hacia
   * dónde va el flujo en el piso de arriba — no la dirección sintética del marcador.
   */
  parentDireccion?: 'sube' | 'baja';
  piso: string;
  sourcePlanId: string;
  sourceBajanteId: string;
  targetBajanteId?: string;
  // Caja de clic calculada en cada render (misma convención que _circ/_ghost de PlanoBajante) —
  // viaja en el JSON guardado como los demás campos, inofensivo.
  _hitCircle?: { x: number; y: number; r: number };
  _crossFloorLabelBox?: LabelBoxCorners;
}
