/** Formateadores compartidos de las tablas del módulo ep (Equipo de Presión). Los cálculos
 *  viven en epEngine.ts; aquí solo queda la presentación de los resultados. Ej: fmtMca(14.06) -> '14.06' m.c.a.; fmtBar(0) -> '—'. */
// Todos los resultados a 2 decimales; '—' cuando el valor no existe (0 o negativo = celda sin dato, no un resultado).
export const fmtMm = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtMs = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtHp = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtBar = (v: number) => (v !== 0 ? v.toFixed(2) : '—');
export const fmtLps = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtM3h = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtGpm = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtMca = (v: number) => (v !== 0 ? v.toFixed(2) : '—');
export const fmtL = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtW = (v: number) => (v > 0 ? v.toFixed(2) : '—');
