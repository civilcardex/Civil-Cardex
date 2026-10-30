// Estilos y helpers de formato de las tablas de Diseño de Grupo de Presión (Bomba AR) —
// extraídos de PumpARDesign. Mismos estilos que las tablas de Equipo de Presión
// (EPVerificationPage) — orig. usuario.

/** Celda de valor con 3 decimales (mono); '—' gris si vacío. */
export const Fmt3 = (v: string | number, u = '') => {
  if (v === '' || v === null || v === undefined)
    return <span style={{ color: 'var(--txt3)', fontSize: 13 }}>—</span>;
  const val = typeof v === 'number' ? v.toFixed(3) : v;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
      {val}
      {u ? ` ${u}` : ''}
    </span>
  );
};

/** Celda de valor con 2 decimales (mono); '—' gris si vacío. */
export const Fmt2 = (v: string | number, u = '') => {
  if (v === '' || v === null || v === undefined)
    return <span style={{ color: 'var(--txt3)', fontSize: 13 }}>—</span>;
  const val = typeof v === 'number' ? v.toFixed(2) : v;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>
      {val}
      {u ? ` ${u}` : ''}
    </span>
  );
};

/** Celda de encabezado de las tablas de Bomba AR. */
export const TH_R = { fontSize: 12.5, padding: '3px 4px' };
/** Celda de valor de las tablas de Bomba AR. */
export const TD_R = { fontSize: 12.5, padding: '2px 4px' };
/** Columna Parámetro/Componente compacta: sin el ancho grande por defecto de Tbl. */
export const TDL_R = { minWidth: 0, fontSize: 13.5, fontWeight: 600 };
/** Columna de notas (Equivalencia/Fuente): el texto sí puede partir en varias líneas. */
const NOTE_COL = { whiteSpace: 'normal' as const, minWidth: 130, fontSize: 12 };
/** Borde EXTERIOR izquierdo en la 1ª celda (orig. usuario: al ras del contenido — el borde de <table> quedaba separado de la grilla por el reparto de columnas). */
const EDGE_L = { borderLeft: '1px solid var(--line)' };
/** Borde EXTERIOR derecho en la última celda (misma razón; además hereda el estilo de notas). */
const EDGE_R = { ...NOTE_COL, borderRight: '1px solid var(--line)' };
/** Encabezados de la tabla de ENTRADA (6 columnas). */
export const COLS_IN = [
  'Parámetro',
  'Símbolo',
  'Valor',
  'Unidad',
  'Equivalencia',
  'Fuente / norma',
];
/** Encabezados de la tabla de SALIDA (6 columnas). */
export const COLS_OUT = ['Componente', 'Símbolo', 'Valor', 'Unidad', 'Equivalencia', 'Observación'];
/** Tooltips columna a columna de la tabla de entrada. */
export const TIPS_IN = [
  'Nombre del parámetro de entrada.',
  'Símbolo con el que se representa el parámetro.',
  'Valor ingresado o calculado.',
  'Unidad del valor.',
  'Equivalencia del valor en otra unidad.',
  'Fuente o norma de la que proviene el dato.',
];
/** Tooltips columna a columna de la tabla de salida. */
export const TIPS_OUT = [
  'Componente o variable del cálculo.',
  'Símbolo con el que se representa.',
  'Valor calculado.',
  'Unidad del valor.',
  'Equivalencia del valor en otra unidad.',
  'Observación sobre el resultado.',
];
/** Estilo por columna (índice): borde exterior + notas en 1ª y última. */
export const COL_STYLES = [EDGE_L, undefined, undefined, undefined, NOTE_COL, EDGE_R];

/** Valor equivalente REAL (orig. usuario): muestra `valor × factor + unidad` de la propia
 *  celda — p.ej. Qd 12 lps → "190.20 GPM". Sin valor → "—". */
export const Eq = (raw: string | number | undefined, f: number, u: string) => {
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'));
  if (!v || !isFinite(v)) return '—';
  return `${(v * f).toFixed(2)} ${u}`;
};
