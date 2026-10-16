import { loadFromStorage } from '../../services/storageService';
import { leerFoldTribPresion, leerHeredadosPresion, udPropiaDe } from '../aparatosPresion';

/** Σ de un aparato contando propia triple (clave − heredado − plegado) sobre filas dadas.
 *  Ej: ducha en RAC1 con herencia en RAC2 suma 1 aunque ambas claves la muestren. */
export function sigma(filas: string[], ap: string): number {
  const disk =
    loadFromStorage<Record<string, Record<string, number>>>('aparatos_by_tramo_v2', {}) || {};
  return filas.reduce((s, k) => {
    const propia = udPropiaDe(disk[k] || {}, leerHeredadosPresion(k), leerFoldTribPresion(k));
    return s + (propia[ap] || 0);
  }, 0);
}
