/** Tipos de geometría y fantasma entrepisos (XFG (fantasma entrepisos)) sin imports: rompe ciclos entre módulos. */

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
  /** Dirección del bajante padre (piso superior): la etiqueta del fantasma muestra la real, no la sintética. */
  parentDireccion?: 'sube' | 'baja';
  piso: string;
  sourcePlanId: string;
  sourceBajanteId: string;
  targetBajanteId?: string;
  /** Carga que viaja por el enlace (aparatos heredados del piso de arriba): el fantasma
   *  NO participa en ningún cálculo (sigue siendo un marcador), pero SÍ muestra y guarda
   *  cuántos UC bajan por él. */
  aparatos?: Record<string, number>;
  /** Total de UC heredados (mismo dato, como número, para la isometría). */
  ucAcum?: number;
  // Marca de versión del layout de asociación: 2 = fantasma-marcador en el piso superior
  // (layout nuevo). La migración salta los ghosts que ya la traen.
  layout?: number;
  // Caja de clic calculada en cada render (misma convención que _circ/_ghost de PlanoBajante) —
  // viaja en el JSON guardado como los demás campos, inofensivo.
  _hitCircle?: { x: number; y: number; r: number };
  _crossFloorLabelBox?: LabelBoxCorners;
}
