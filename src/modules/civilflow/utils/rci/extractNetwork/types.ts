// Tipos del extractor de UNA red RCI (Red Contra Incendio): el aviso para la UI, un punto px,
// un accesorio dibujado, el trazo ya medido, el tronco posicionado, la pieza entre nudos y el
// resultado por piso. Ej: RedDePiso.red.raiz = 'C' (la letra de la derivación del montante).
import type { Red } from '../../../lib/rci/types.ts';
import type { RawElement } from '../../drawingSyncTypes.ts';

/** Un aviso de extracción para la UI: el dibujo quedó a medias y conviene contárselo al usuario. */
export interface AvisoRci {
  /** Piso donde ocurrió (label). */
  piso: string;
  /** Mensaje en español para el usuario. */
  msg: string;
}

export interface Punto {
  x: number;
  y: number;
}

/** Un accesorio dibujado: su tipo (texto del catálogo del motor) y el vértice donde vive. */
export interface AccDib {
  tipo: string;
  /** Índice del vértice en pts (0 = inicio, pts.length-1 = fin). */
  idx: number;
}

/** Un trazo RCI ya medido: sus extremos, sus accesorios y su orden en el dibujo. */
export interface TrazoDib {
  el: RawElement;
  /** Id estable del trazo (`planId|idTrazo`). */
  id: string;
  a: Punto;
  b: Punto;
  /** Longitud dibujada en m (totalL del motor de dibujo). */
  L: number;
  /** Rociadores dibujados sobre el trazo. */
  roci: number;
  acc: AccDib[];
  mat: string;
  dn: string;
  /** Orden en el doc del piso (desempate del orden de dibujo). */
  orden: number;
}

/** Tronco posicionado: offset (m desde el extremo remoto) y orientación del trazo en la cadena. */
export interface TramoTronco {
  t: TrazoDib;
  /** Posición (m) del extremo REMOTO del trazo a lo largo del tronco. */
  o: number;
  /** Posición (m) del extremo de DERIVACIÓN del trazo. */
  fin: number;
  /** true si el extremo remoto del trazo es su pts[0] (el flujo corre pts[0]→último). */
  remotoEsA: boolean;
}

/** Pieza de tronco entre dos nudos: una fila T del estado (la primera puede absorber el tramo
 *  superior si el extremo remoto del tronco no tiene ramales). */
export interface PiezaTronco {
  id: string;
  /** Posición a lo largo del tronco (m desde el extremo remoto). */
  posIni: number;
  posFin: number;
  /** Letra del nudo de inicio (null = extremo remoto del tronco sin nudo: se fusiona). */
  de: string | null;
  a: string;
  c45: number;
  c90: number;
  /** Tees dibujadas dentro de la pieza (ya cuentan; la auto solo suma donde falta). */
  teeDib: number;
  /** Trazo y vértice donde TERMINA la pieza (para el codo de la bajada y la tee del nudo). */
  trazoFin: TrazoDib | null;
  idxFin: number;
}

/** Resultado de la extracción de UN piso: su red (o null si no se pudo) y su montante de derivación. */
export interface RedDePiso {
  red: Red | null;
  idMont: string;
  nombreMont: string;
  matMont: string;
  dnMont: string;
  /** altDeriv del montante de derivación (null si el dibujo no la trae). */
  altDeriv: number | null;
  /** Gabinetes GABn dibujados en este piso (código + NPT base), del elemento del motor
   *  tipo 'gabinete'. Alimenta st.gabinetes (ruta de montantes/gabinetes). */
  gabinetes: { code: string; npt: number }[];
}
