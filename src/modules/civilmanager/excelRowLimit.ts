/**
 * Límite de filas de las hojas Excel importadas (H-05): con `sheetRows: FILAS_TOPE + 1`
 * SheetJS deja de leer y el rango `!ref` revela si la hoja TRAÍA más filas de las leídas —
 * una hoja truncada en silencio importaría un presupuesto/catrálogo incompleto como si
 * fuera completo. Ej: 'A1:J5001' → truncada (5001 > 5000).
 */
export const FILAS_TOPE_XLSX = 5000;

/** ¿El rango `!ref` de la hoja cubre más filas que el tope? Ej: 'A1:J5000' → false (justo
 *  en el límite), 'A1:J5001' → true (la hoja traía más de lo leído). */
export function hojaTruncada(ref: string): boolean {
  const partes = ref.split(':');
  const primera = Number(/(\d+)$/.exec(partes[0] ?? '')?.[1] ?? 1);
  const ultima = Number(/(\d+)$/.exec(partes[1] ?? '')?.[1] ?? 1);
  return ultima - primera + 1 > FILAS_TOPE_XLSX;
}
