/** Estilos CSS compartidos por las tablas de diseño (inputs SI/SD, encabezado TH y celda TD): una sola fuente de verdad para que todas las tablas se vean iguales. Ej: SI = input centrado mono; SD = el mismo input alineado a la izquierda. */

/** Celda-input centrada (texto cortos: cantidades, siglas) con fuente mono y borde fino. */
export const SI: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 3,
  background: 'var(--bg4)',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--txt)',
  width: '100%',
  boxSizing: 'border-box',
  textAlign: 'center',
  padding: '3px 5px',
};
/** Celda-input alineada a la izquierda con fuente de texto (nombres largos: descripciones). */
export const SD: React.CSSProperties = {
  ...SI,
  textAlign: 'left',
  fontFamily: 'var(--body)',
  cursor: 'pointer',
};
/** Encabezado de columna: mayúsculas, gris tenue y borde compartido. Ej: "DIÁMETRO (PULG)". */
export const TH: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--txt3)',
  fontFamily: 'var(--mono)',
  textAlign: 'center',
  padding: '5px 6px',
  borderBottom: '1px solid var(--line)',
  borderRight: '1px solid var(--line)',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  background: 'var(--bg3)',
  verticalAlign: 'middle',
};
/** Celda de solo lectura (valores calculados: caudal, velocidad), centrada y tenue. */
export const TD: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'var(--mono)',
  padding: '4px 6px',
  borderBottom: '1px solid var(--line)',
  borderRight: '1px solid var(--line)',
  color: 'var(--txt2)',
  textAlign: 'center',
  verticalAlign: 'middle',
};
