import type { MemoriaTable } from './reportExportShared.ts';

/**
 * Convierte un valor de celda en algo imprimible: nunca NaN, Infinity, undefined ni null —
 * la memoria de cálculo es un ENTREGABLE FIRMABLE y un "NaN" en una columna de cálculo es un
 * defecto legal del documento entregado. Ej: bajLong NaN → '—'; radio 0 (Infinity en vent) → '—'.
 * @param v valor crudo de la celda.
 * @returns el valor si es utilizable, o '—' (guion largo) si no.
 */
export function sanaCelda(v: unknown): string | number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : '—';
  if (v == null) return '—';
  if (typeof v === 'string') {
    return /\bNaN\b|\bInfinity\b|\bundefined\b/.test(v) ? '—' : v;
  }
  return v as string | number;
}

/**
 * Sanea todas las celdas de una tabla de memoria antes de exportarla.
 *
 * @param t tabla de memoria con cabeceras y filas.
 * @returns la misma tabla con las celdas saneadas.
 */
export function sanaTabla(t: MemoriaTable): MemoriaTable {
  return { ...t, rows: t.rows.map((r) => r.map(sanaCelda)) };
}

/**
 * Sanea TODAS las tablas de una memoria de cálculo.
 *
 * @param tablas tablas de la memoria.
 * @returns las tablas con las celdas saneadas.
 */
export function sanaTablas(tablas: MemoriaTable[] | undefined): MemoriaTable[] | undefined {
  return tablas?.map(sanaTabla);
}
