/**
 * Tipos de la copia de dibujo entre pisos: qué se copia (selección por red + tipos), con qué
 * alineación de láminas y qué devuelve el lote. Ej: tipos {ramal, bajante} con netId 'af' trae
 * la red af del piso origen al destino.
 */
import type { IPlanoEngineCore } from '../../lib/PlanoEngine/PlanoState.ts';

/** Selección de copia: una red (af/san/gas…) y los tipos de elemento que viajan de esa red. */
export interface CopySourceSelection {
  netId: string;
  tipos: Set<string>;
}

/** Alineación de láminas (origen de calibración por plano: mismo punto físico del AutoCAD). */
export interface CopyAlineacion {
  origenSrc?: { x_px: number; y_px: number } | null;
  origenDst?: { x_px: number; y_px: number } | null;
}

/** Resultado del lote: cuántos elementos quedaron en el destino y qué redes se saltaron. */
export interface CopyResult {
  copied: number;
  skippedNets: string[];
}

/** Copia elementos entre pisos (renumera ids; fantasmas = bajantes desplazados x+dx, y+dy del anillo). */
export interface CopyOpciones {
  fantasmas?: 'fantasmas' | 'originales' | 'ambos';
}

/** El motor del plano abierto, extendido con saveWork (el doc listo para persistir). */
export interface ExtendedEngine extends IPlanoEngineCore {
  saveWork(): unknown;
}

/** Elemento crudo leído del JSON del plano origen (ramal, bajante o global como red pública/contador/calentador). */
export interface CopyElement {
  id: string;
  net: string;
  tipo: string;
  pts?: number[][];
  recibeDeIds?: string[];
  alimentaIds?: string[];
  descargaEnId?: string | null;
  code?: string;
  ini?: string;
  fin?: string;
  padre?: string | null;
  label?: string;
  totalL?: number;
  direccion?: string;
  nptBase?: number;
  labelX?: number;
  labelY?: number;
  copiaPiso?: boolean;
  bloqueado?: boolean;
  _labelBox?: unknown;
  _circ?: unknown;
  _ghost?: unknown;
  _ghostLabelBox?: unknown;
  _net?: unknown;
  isFantasma?: unknown;
  desplazamientos?: unknown;
  pisoBase?: unknown;
  ghostData?: unknown;
}
