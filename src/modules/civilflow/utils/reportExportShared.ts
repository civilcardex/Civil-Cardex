// Tipos y helpers compartidos de la memoria de cálculo (Excel/Docx/PDF).
// Extraídos verbatim de exportMemoryFinal (des-monolitización 2026-10-06).
import { sanitizeFileName } from './formatUtils.ts';

/** Grupo de encabezado de la memoria (fila de agrupación sobre las columnas de una tabla). */
export interface MemoriaHeaderGroup {
  label: string;
  span: number;
}

/** Una tabla de la memoria: título, encabezados y filas de strings (celda = texto listo). */
export interface MemoriaTable {
  title: string;
  headers: string[];
  // Fila de cabecera superior opcional que agrupa varios `headers` hoja bajo una etiqueta
  // compartida (p. ej. "Pérdidas por fricción" abarcando las sub-columnas "%" y "m"). Los
  // strings planos de este array representan una columna hoja sin agrupar (renderizada como una
  // celda sola que cruza ambas filas de cabecera); las entradas objeto abarcan `span` columnas
  // hoja consecutivas. Los spans deben sumar headers.length.
  headerGroups?: (string | MemoriaHeaderGroup)[];
  rows: (string | number)[][];
  // En qué hoja de red va esta tabla en la exportación Excel (ver REDES_ORDEN abajo) — lo fija
  // el caller al armar el array de tablas, no las funciones compute*Table individuales.
  red?: string;
  // Renderiza esta tabla lado a lado con la SIGUIENTE del array en la misma fila (usado para el
  // par angosto acometida parámetros/verificación en las exportaciones PDF y DOCX; el par
  // comparte una sección de página en DOCX y una fila en PDF). Ignorado por la exportación Excel.
  side?: boolean;
  // Diámetros (en pulgadas, como string) presentes en el dibujo para la red de esta tabla —
  // usado por la UI para derivar filas pseudo de bushing (un par mayor→menor por combinación de
  // diámetros). Solo lo llenan las redes de presión (af/ac/gas).
  diamsPresent?: string[];
  // Conteo REAL de bushing por par de diámetros (clave `${mayor}_${menor}`, pulgadas) — cuántas
  // conexiones menor→mayor hay de verdad en el dibujo (Bug 2). Solo af/ac/gas.
  bushingCounts?: Record<string, number>;
}

// Quita columnas que son todo-cero en todas las filas — usado para tablas de conteo de
// accesorios donde la mayoría de tipos de accesorio no aplican a un proyecto dado e imprimir
// una columna toda-cero es solo ruido. `labelCols`/`trailingCols` protegen las columnas de
// etiqueta iniciales y las columnas de totales calculados finales de quitarse aunque sean todo
// cero. Salta tablas con headerGroups (la matemática de spans habría que ajustarla también, y
// ninguna tabla de accesorios actual las usa).
/** Quita de la tabla las columnas cuyo valor es 0 en TODAS las filas (ruido de catálogo:
 *  accesorios que este proyecto no usa no deben salir en la memoria). */
export function dropAllZeroColumns(
  table: MemoriaTable,
  labelCols = 1,
  trailingCols = 0,
): MemoriaTable {
  if (table.headerGroups) return table;
  const lastProtected = table.headers.length - trailingCols;
  const keepIdx: number[] = [];
  for (let i = 0; i < table.headers.length; i++) {
    if (i < labelCols || i >= lastProtected || table.rows.some((r) => Number(r[i]) !== 0)) {
      keepIdx.push(i);
    }
  }
  if (keepIdx.length === table.headers.length) return table;
  return {
    ...table,
    headers: keepIdx.map((i) => table.headers[i]),
    rows: table.rows.map((r) => keepIdx.map((i) => r[i])),
  };
}

/** Todo lo que un export de memoria necesita: proyecto, grupos de tablas por red. */
export interface MemoriaData {
  proyNombre: string;
  rows: [string, string][];
  tables?: MemoriaTable[];
}

/** Base del nombre de archivo de export: nombre del proyecto saneado. Ej: 'Edif. A/3' → 'Edif A_3'. */
export function fileBase(proyNombre: string): string {
  return sanitizeFileName(`Memorias Finales ${proyNombre || 'Proyecto'}`);
}
/** Orden canónico de las redes en la memoria y sus rótulos (af antes de ac, san antes de ll…). */
export const REDES_ORDEN: { key: string; label: string }[] = [
  { key: 'san', label: 'Sanitaria' },
  { key: 'll', label: 'Aguas Lluvias' },
  { key: 'af', label: 'Agua Fría' },
  { key: 'aco', label: 'Acometida' },
  { key: 'ac', label: 'Agua Caliente' },
  { key: 'gas', label: 'Gas' },
  { key: 'bom', label: 'Bomba aguas residuales' },
  { key: 'ep', label: 'Equipo presión' },
];
