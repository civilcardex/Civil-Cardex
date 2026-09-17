/** Tipos del visor 3D del Equipo de Presión Constante. */

export interface ComponenteEpc {
  id: number;
  name: string;
  modelKey: string;
  color: string;
}

export interface EtiquetaEpc {
  /** Posición 3D de la punta de la flecha (metros, espacio del modelo). */
  pos: [number, number, number];
  scale: number;
  /** 0 = círculo a la derecha, 1 = a la izquierda. */
  dir: number;
  /** Inclinación del segmento con flecha en grados (0 = vertical). */
  ang: number;
  L1: number;
  L2: number;
  /** Componente principal al que pertenece (sub-etiquetas 2b/2c… → 2). */
  ref?: number;
}
