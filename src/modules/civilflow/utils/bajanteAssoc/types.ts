// Tipos compartidos de la asociación ENTRE PISOS de bajantes/montantes: las formas con que el
// doc guardado, los extremos de enlace y el pool de ramales entran a apply/clear/heal/espejos.
// Ej: InheritPoolRamal describe RAF1 tal como llega del motor vivo o del storage.

/** Bajante tal como vive en el doc guardado, recortado a lo que este módulo parchea: el anillo
 *  de desplazamientos por nivel y la posición/etiqueta del fantasma. Ej: BAN1 con
 *  desplazamientos['P2'] = {dx:14, dy:-22, Ldesvio:'LD_BAN1'}. */
export interface StoredBajanteDesp {
  id: string;
  desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
  ghostData?: Record<string, { direccion?: string; labelX?: number; labelY?: number }>;
}

/** Un extremo (bajante o montante) de una asociación entre pisos: con estos datos se reconstruye
 *  el enlace completo (punteros, fantasma XFG (fantasma entrepisos) y desvío LD_ (ramal desvio
 *  entrepisos)) desde cualquiera de los dos pisos. Ej: BAN1 del piso 1 con nivelN 0 y su npt. */
export interface AssocEndpoint {
  planId: string;
  id: string;
  x: number;
  y: number;
  net: string;
  dNominal: string;
  code: string;
  /** plan.nivel: el número ordinal del piso (0 = suelo, 1 = primer piso…), usado para las etiquetas y para saber qué piso queda arriba de cuál. */
  nivelN: number;
  npt: number;
  /** Tipo del elemento (los montantes siempre apuntan 'sube'; los bajantes no calculan dirección). */
  tipo?: string;
}

/** Ramal tal como entra al cómputo de herencia (del motor vivo o del storage): basta su
 *  red/geometría y sus aparatos (`fixtures`) para sumar sus UC (Unidades de Consumo) al grupo
 *  que baja. Ej: RAF1 con fixtures {lav:2} aporta 2 lavamanos al cierre de su bajante. */
export interface InheritPoolRamal {
  id: string;
  net?: string;
  tipo?: string;
  padre?: string | null;
  pts?: number[][];
  _tribReversed?: boolean;
  mergesFrom?: [string, string] | string[];
  fixtures?: Record<string, number>;
  /** Código del elemento del que ARRANCA el ramal (si el ramal nace en él, es su salida). */
  ini?: string;
  [k: string]: unknown;
}

/** Bajante/montante tal como entra al cómputo de herencia (vivo o storage): sus listas de
 *  ramales, sus punteros entre pisos y su libro `ucAplicado` deciden qué carga hereda el piso
 *  de abajo. Ej: MAC1 con origenId marcado y ucAplicado con el grupo {tin:2, lvm:2, duc:1}. */
export interface InheritPoolBajante {
  id: string;
  tipo?: string;
  dNominal?: string;
  /** Código visible del bajante (el que guardan los ramales en `ini`). */
  code?: string;
  /** Ramales asociados a mano (checkbox): el bajante les ENTREGA su carga (no le traen). */
  asocManual?: string[];
  recibeDeIds?: string[];
  alimentaIds?: string[];
  x?: number;
  y?: number;
  /** Puntero de asociación entre pisos (apunta ARRIBA): marca al portador como RECEPTOR. */
  origenId?: string | null;
  /** Puntero a bomba: también receptor (herencia invertida). */
  bombaEnId?: string | null;
  /** Libro de herencia: lo que el piso de arriba dejó aplicado en este bajante (asociación
   *  entre pisos). Es la carga HEREDADA — el árbol local puede no traerla (el Ldesvio queda
   *  fuera del árbol por diseño) y sin ella una cadena de tres pisos pierde la carga. */
  ucAplicado?: Record<string, Record<string, number>>;
}

/** Resultado del agregado de herencia de collectSourceAgg: `agg` (aparato → UC del grupo),
 *  `hydroAgg` (accesorios hidráulicos del grupo, null si no hay) y `ramalIds` (los ramales que
 *  entraron al cierre — la traza usa para nombrar de dónde salió cada pieza). */
export interface CollectedAgg {
  agg: Record<string, number>;
  hydroAgg: Record<string, number> | null;
  ramalIds: string[];
}
