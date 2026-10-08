// Tipos del sync de dibujo a BD/localStorage (elemento crudo, doc completo, input de plan).
// Extraídos verbatim de drawingSync (des-monolitización 2026-10-06).

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
  /** Flag de inversión de dirección para redes pts-driven (dos nombres según la vía de guardado). */
  _tribReversed?: boolean;
  trib_reversed?: boolean;
  [key: string]: unknown;
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

export interface TraceData {
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

export interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

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

export interface SyncDataResult {
  planes: Record<string, unknown>;
  aparatosByTramo?: Record<string, unknown>;
  hidroData?: Record<string, unknown>;
  updatedAt: number;
}
