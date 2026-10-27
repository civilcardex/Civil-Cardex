// Tipos del sync de dibujo a BD/localStorage (elemento crudo, doc completo, input de plan).
// Extraídos verbatim de drawingSync (des-monolitización 2026-10-06).

/** Elemento crudo del dibujo tal como vive en el doc de trazos (id, red, tipo y geometría mínima): la unidad del sync caché↔BD. */
export interface RawElement {
  id: string;
  net: string;
  tipo: string;
  padre?: string | null;
  totalL?: number;
  ini?: string;
  fin?: string;
  diametro?: string;
  pendiente?: number;
  material?: string;
  dz?: string;
  lvert?: string;
  piso?: string;
  pts?: number[][];
  nSalidas?: number;
  descargaEnId?: string | null;
  code?: string;
  dNominal?: string;
  hVert?: number;
  recibeDeIds?: string[];
  mergesFrom?: [string, string];
  alimentaIds?: string[];
  area_m2?: number;
  pisoBase?: string;
  pisoCima?: string;
  nptBase?: number;
  nptCima?: number;
  bajR?: number;
  bajDprop?: unknown;
  ventDprop?: unknown;
  bajLong?: unknown;
  bajFDarcy?: unknown;
  label?: string;
  acoDiam?: string;
  accesorioInicio?: string;
  accesorioFin?: string;
  aparatoInicio?: string;
  aparatoFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  accMed?: Record<string, string>;
  caudal?: number;
  /** Ramal de canal: id del canal del que nace (extremo inicial dentro de su rect). */
  esCanalId?: string | null;
  labelX?: number;
  labelY?: number;
  /** Inversión de flujo (_tribReversed (flag de flujo invertido en tributario), doble nombre por vía de guardado). */
  _tribReversed?: boolean;
  trib_reversed?: boolean;
  [key: string]: unknown;
}

/** Bajante cruda leída del storage, con posición en planta (única definición — antes
 *  había 6 copias: 2 exportadas idénticas + 4 privadas). */
export interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
  desplazamientos?: Record<string, { dx?: number; dy?: number }>;
}

/** Estructura de datos de dibujo sincronizado guardada en las claves sync de localStorage. */
export interface DrawingData {
  planes?: Record<string, unknown>;
  aparatosByTramo?: Record<string, unknown>;
  hidroData?: Record<string, unknown>;
  updatedAt?: number;
  id?: string | number;
  nivel?: string | number | null;
  name?: string;
  npt?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

/** Descriptor de plano de entrada para operaciones de sync. */
export interface SyncPlanInput {
  id: string | number;
  name?: string;
  nivel?: string | number | null;
  npt?: number;
  status?: string;
}

/** Doc completo de trazos de un piso: ramales + bajantes (+ resto de colecciones libres). Es lo que save/load traga. */
export interface TraceData {
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

/** Fila hidráulica de un tramo: conteo de accesorios, longitud horizontal (Lh, m) y número de salidas — alimenta las tablas de af/ac. */
export interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

/** Ramal listo para BD: geometría, diámetros, punteros entre pisos (descargaEnId) y claves internas (_aparatosKey). */
export interface RamalSyncObj {
  id: string;
  label: string;
  tipo: string;
  padre: string | null;
  totalL: number;
  ini: string;
  fin: string;
  diametro: string;
  diamPulg: number;
  pendiente: number;
  material: string;
  maning: number | null;
  piso: string;
  _aparatosKey: string;
  _net: string;
  nSalidas: number;
  descargaEnId: string | null;
  aparatoInicio: string;
  aparatoFin: string;
  caudal?: number;
  accMed?: Record<string, string>;
  yeeDobleAt?: number[][];
}

/** Snapshot global del proyecto para sync: docs por plano + conteos de aparatos + datos hidráulicos, con marca de tiempo (el mayor-ts arbitra). */
export interface SyncDataResult {
  planes: Record<string, unknown>;
  aparatosByTramo?: Record<string, unknown>;
  hidroData?: Record<string, unknown>;
  updatedAt: number;
}
