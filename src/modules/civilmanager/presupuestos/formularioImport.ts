import { parseCantidad } from '../excelImport';

export interface ColumnMapping {
  col_item: number;
  col_descripcion: number;
  col_unidad: number;
  col_cantidad: number;
}

/** Heurística: fila probablemente sea encabezado de capítulo si cumple ≥2 de 3 criterios (sin cantidad, sin unidad, descripción en mayúsculas/numerada). */
export function detectarFilaCapitulo(fila: (string | number)[], mapeo: ColumnMapping): boolean {
  const cantidad = parseCantidad(fila[mapeo.col_cantidad]);
  const unidad = String(fila[mapeo.col_unidad] ?? '').trim();
  const desc = String(fila[mapeo.col_descripcion] ?? '').trim();
  const critCantidad = cantidad === 0;
  const critUnidad = unidad === '' || unidad === '-';
  let critDesc = false;
  if (desc.length > 0) {
    const may = (desc.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
    const let_ = (desc.match(/[a-zA-ZÁÉÍÓÚÑáéíóúñ]/g) || []).length;
    const esMay = let_ > 0 && may / let_ > 0.8;
    const patron = /^(cap[ií]tulo|cap\.?|t[ií]tulo|item|[IVX]+\.?\s|\d+\.\s)/i.test(desc);
    critDesc = esMay || patron;
  }
  return (critCantidad ? 1 : 0) + (critUnidad ? 1 : 0) + (critDesc ? 1 : 0) >= 2;
}

/** Busca la primera fila con ≥3 celdas no vacías seguida de otra similar (heurística de inicio de datos). */
export function autoDetectarFilaInicio(filas: (string | number)[][]): number {
  for (let i = 0; i < Math.min(15, filas.length - 1); i++) {
    const noVacias = filas[i].filter(c => String(c ?? '').trim() !== '').length;
    const sigNoVacias = filas[i + 1].filter(c => String(c ?? '').trim() !== '').length;
    if (noVacias >= 3 && sigNoVacias >= 3) return i + 1;
  }
  return 3;
}
