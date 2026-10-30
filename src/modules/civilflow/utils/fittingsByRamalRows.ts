import type { Tramo } from '../context/tramosReducer';
import { ACCESORIOS_HIDRO, pisoCorto } from '../constants';
import { dropAllZeroColumns, type MemoriaTable } from './exportReportFinal.ts';

const ACCESORIOS_COLS = ACCESORIOS_HIDRO.filter((a) => a.id !== 'llaveTerminal');

/**
 * Tabla de la memoria: cuántos accesorios hidráulicos lleva cada tramo (una fila por tramo).
 * Ej: tramo RAF1-P1 con 2 codos y 1 tee -> fila `RAF1-P1 | 2 | 1 | 0 ...`; quita columnas toda en cero.
 * @param tramos tramos del dibujo (los tributarios se excluyen).
 * @param title título de la tabla en la memoria.
 * @returns la tabla lista para exportar, o null si no hay tramos.
 */
export function computeAccesoriosPorRamalTable(
  tramos: Tramo[],
  title: string,
): MemoriaTable | null {
  const validTramos = tramos.filter((t) => t.tipo !== 'tributario');
  if (validTramos.length === 0) return null;
  const headers = ['Tramo', ...ACCESORIOS_COLS.map((a) => a.nombre)];
  const rows = validTramos.map((t) => {
    const base = t.label || t.id;
    const lbl = t.piso != null ? `${base}-${pisoCorto(t.piso)}` : base;
    return [lbl, ...ACCESORIOS_COLS.map((a) => t.accesorios?.[a.id] || 0)];
  });
  return dropAllZeroColumns({ title, headers, rows });
}
