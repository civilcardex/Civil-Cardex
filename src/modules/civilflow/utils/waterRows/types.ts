/** Tipos compartidos de las filas de diseño de redes af (Agua Fria)/ac (Agua Caliente). Ej: WnRow es la fila que pinta la tabla de diseño y llevan las memorias. */

/** Fila de diseño (UC (Unidades de Consumo) propia/total, Q (Caudal), diámetros, pérdidas y presiones). */
export interface WnRow {
  id: string;
  ini: string;
  fin: string;
  piso: number;
  udPropia: number;
  udTotal: number;
  nDesc: number;
  K: number;
  Qprob: number;
  diamEst: number;
  diamDis: string;
  dInt: number;
  cHW: number;
  Vmms: number;
  Lh: number;
  Lv: number;
  Le: number;
  Lt: number;
  hfPct: number;
  hfM: number;
  Pin: number;
  Pfin: number;
}

/** Opción de diámetro comercial (tabla que pasa el llamador) con el label ya normalizado al nominal. */
export interface DiamOpt {
  pulg: number;
  nominal: string;
  label: string;
  dInt: number;
}

/** Aparato con su UC (Unidades de Consumo) para la red activa: base del cálculo de carga. */
// (type alias, no interface: calcUCparcial recibe UCBase[] con índice por string — los alias de
// objeto literal obtienen índice implícito, las interfaces no.)
export type AparatoUc = {
  id: string;
  uc: number;
};
