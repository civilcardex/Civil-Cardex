import type { Dispatch, SetStateAction } from 'react';

/** Resultado físico de una fila de acometida: diámetro interno, velocidad, longitudes, pérdidas y presión final. */
export interface FilaResult {
  dInt: number;
  V: number;
  Lt: number;
  hfPct: number;
  hfM: number;
  Pfin: number;
}

/** Longitudes de un tramo de acometida: horizontal, vertical y equivalente de accesorios. */
export interface LData {
  h: number;
  v: number;
  le: number;
}

export interface ContadorSel {
  dn?: string;
  q?: number;
}

export interface DiamOpt {
  pulg: number;
  label: string;
  dInt: number;
  nominal?: string;
}

export interface AcometidaProps {
  Qaco: number;
  /** Edición por sección (pedido del cliente): cada bloque tiene su propio botón EDITAR/LISTO. */
  edit1: boolean;
  setEdit1: Dispatch<SetStateAction<boolean>>;
  edit2: boolean;
  setEdit2: Dispatch<SetStateAction<boolean>>;
  edit3: boolean;
  setEdit3: Dispatch<SetStateAction<boolean>>;
  contadorSel: ContadorSel;
  acoContIx: number;
  setAcoContIx: (ix: number) => void;
  acoMonName: string;
  setAcoMonName: (name: string) => void;
  acoRedContDiam: string;
  acoContMonDiam: string;
  acoL1: LData;
  setAcoL1: (fn: (s: LData) => LData) => void;
  acoL2: LData;
  setAcoL2: (fn: (s: LData) => LData) => void;
  acoPini: number;
  setAcoPini: (p: number) => void;
  acoHfMax: number;
  setAcoHfMax: (v: number) => void;
  /** Presión mínima que debe quedar al final de la acometida, en mca (metros de columna de agua). */
  acoPResMin: number;
  setAcoPResMin: (v: number) => void;
  acoLeMed: number;
  setAcoLeMed: (le: number) => void;
  cHW1: number;
  cHW2: number;
  f1: FilaResult;
  f2: FilaResult;
  hfContador: number;
  pResidual: number;
  okPresion: boolean;
  AF_DIAM_OPTS: DiamOpt[];
  isTr1Drawn?: boolean;
  /** Escribe el diámetro propuesto del tramo AC (Agua Caliente)-01 del dibujo (mismo camino que la tabla). */
  onTr1DiamChange?: (nominal: string) => void;
  /** Igual para el tramo AC (Agua Caliente)-02 (va del contador al montante). */
  onTr2DiamChange?: (nominal: string) => void;
  isTr2Drawn?: boolean;
  onContDiamChange?: (val: string) => void;
}
