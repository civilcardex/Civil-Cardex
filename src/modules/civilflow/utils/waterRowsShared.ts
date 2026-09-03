import type { Tramo } from '../context/tramosReducer';
import type { RawElement } from './drawingSync';
import { APARATOS_DEF } from '../constants';

/** Bajante crudo leído del storage, con posición en planta. */
export interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
}

/** ¿La red es agua fría (af)? */
export const isAf = (t: string) => t === 'af';
/** ¿El código corresponde a un contador (CNT/cntAF)? */
export const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

/**
 * Clasifica si un tramo es AC tipo 1 (ramal que alimenta contador o viene de RP).
 * @param t - Tramo con `ini`/`fin` (códigos de origen/destino).
 * @returns true si es AC1.
 */
export const isAC1 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
  if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B'))
    return true;
  return false;
};

/**
 * Clasifica si un tramo es AC tipo 2 (ramal que sale de contador o descarga en montante/bajante).
 * Complemento de `isAC1` para separar redes AC en tablas.
 * @param t - Tramo con `ini`/`fin`.
 * @returns true si es AC2.
 */
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
/** Presión máxima por sigla de aparato (misma transformación de sigla que aplica el motor al dibujar). */
export const APARATO_PMAX_BY_CODE: Record<string, number> = Object.fromEntries(
  APARATOS_DEF.map((a) => [a.sigla.replace(':', '').trim().toUpperCase(), a.pmax]),
);
/** Factor de pérdida de presión atribuible al calentador (0.9). */
export const HEATER_LOSS_FACTOR = 0.9;
