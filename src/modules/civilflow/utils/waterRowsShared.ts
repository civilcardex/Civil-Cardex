import type { Tramo } from '../context/tramosReducer';
import { APARATOS_DEF } from '../constants';

/** Helpers compartidos de las tablas de agua (af (Agua Fria)/ac (Agua Caliente)): clasificación de tramos y presión por aparato. */

export type { BajanteRaw } from './drawingSyncTypes.ts';

export const isAf = (t: string) => t === 'af';
export const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

/** Tramo de ac (Agua Caliente) "lado frío": va de la red pública al contador (y de ahí no pasa todavía por el calentador).
 *  @param t - tramo con `ini`/`fin`.
 *  @returns true si es AC1. */
export const isAC1 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
  if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B'))
    return true;
  return false;
};

/** Tramo de ac (Agua Caliente) "lado caliente": sale del contador hacia el montante/bajante (ya lleva agua calentada).
 *  @param t - tramo con `ini`/`fin`.
 *  @returns true si es AC2. */
export const isAC2 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
  if (isContador(ini)) return true;
  if (isContador(fin) && (ini.startsWith('M') || ini.startsWith('B'))) return true;
  return false;
};

// Misma transformación sigla → código que aplica PlanoEngineNetwork.ts al escribir la
// abreviatura de un fixture en el ini/fin de un ramal: "Duc:" -> "DUC".
/** Presión máxima (m.c.a.) que soporta cada aparato, indexada por su sigla ("LAV" → lavamanos); usa la misma sigla que dibuja el motor. */
export const APARATO_PMAX_BY_CODE: Record<string, number> = Object.fromEntries(
  APARATOS_DEF.map((a) => [a.sigla.replace(':', '').trim().toUpperCase(), a.pmax]),
);
/** Presión mínima (m.c.a.) que necesita cada aparato para funcionar bien, por sigla. */
const APARATO_PMIN_BY_CODE: Record<string, number> = Object.fromEntries(
  APARATOS_DEF.map((a) => [a.sigla.replace(':', '').trim().toUpperCase(), a.pmin]),
);
// Alias legacy: dibujos guardados antes de renombrar 'Hor:' → 'HorG:' conservan ini='HOR'.
if (APARATO_PMAX_BY_CODE.HORG != null) APARATO_PMAX_BY_CODE.HOR = APARATO_PMAX_BY_CODE.HORG;
if (APARATO_PMIN_BY_CODE.HORG != null) APARATO_PMIN_BY_CODE.HOR = APARATO_PMIN_BY_CODE.HORG;

/** ¿La presión en el aparato está dentro del rango pmin–pmax del catálogo NTC (Norma Tecnica Colombiana) 1500? Chequea el extremo fin (con Pfin) y luego el ini (con Pin). Devuelve '' si no hay aparato o presión. Ej: fin 'LAV' con pFin 2.0 → 'O.K.'; con 0.8 → 'NO'. */
export function chequeoPresionAparato(
  ini: Tramo['ini'],
  fin: Tramo['fin'],
  Pin: number,
  Pfin: number,
): 'O.K.' | 'NO' | '' {
  const chequeoEn = (code: string, p: number): 'O.K.' | 'NO' | '' => {
    const pmin = APARATO_PMIN_BY_CODE[code];
    const pmax = APARATO_PMAX_BY_CODE[code];
    if (pmin == null || pmax == null || !(p > 0)) return '';
    return p >= pmin && p <= pmax ? 'O.K.' : 'NO';
  };
  if (typeof fin === 'string' && fin) {
    const r = chequeoEn(fin.trim().toUpperCase(), Pfin);
    if (r) return r;
  }
  if (typeof ini === 'string' && ini) {
    const r = chequeoEn(ini.trim().toUpperCase(), Pin);
    if (r) return r;
  }
  return '';
}
/** Cuánta presión se "come" el calentador cuando la red de ac (Agua Caliente) lo usa (0.9 = se pierde el 10 %). */
export const HEATER_LOSS_FACTOR = 0.9;
