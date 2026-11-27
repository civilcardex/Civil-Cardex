/** Estilos de las tablas de entradas de la red contra incendio, por ejemplo las celdas de accesorios. */
import type { CSSProperties } from 'react';
import type { RciCtx } from './RCIUI.tsx';
import { IN_CELDA } from './RCIEditableCell.tsx';
import { TD, TH } from '../../styles/sharedTableStyles.ts';
/* ---------------- Estilos locales ---------------- */
/** Nota al pie de tabla (12 px, gris): la línea de aclaración bajo la tabla. Ej: la usan RciClassesModal y RciRoomTable. */
const NOTA: CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--txt3)' };
/** Cabecera de tabla a 12 px (TH global reducido). Ej: las cabeceras de RciRoomTable y RciClassesModal. */
/** Celda de tabla a 14 px: el look estándar de las tablas del motor RCI. Ej: las filas de clase de riesgo en RciClassesModal. */
const TDCB: CSSProperties = { ...TD, fontSize: 14, padding: '1px 4px' };
/** Celda compacta (13 px) para tablas apretadas. Ej: las columnas NFPA de esta tabla C-mat y las celdas de RciRoomTable. */
const TDC12: CSSProperties = { ...TDCB, fontSize: 13, padding: '1px 2px' };
/** Control activo de las celdas: caja tipo sanitario a 13 px (las tablas compactas); C-mat sube a 14 inline. */
const IN: CSSProperties = { ...IN_CELDA, fontSize: 14 };
// Tipografía ampliada para Tubería y mangueras, con el padding compacto de las filas.
const TH_TUBERIA: CSSProperties = { ...TH, fontSize: 13 };
const TDCC: CSSProperties = { ...TD, fontSize: 14, padding: '1px 2px' };
const INC: CSSProperties = { ...IN_CELDA, fontSize: 14 };
const NOTAC: CSSProperties = { ...NOTA, fontSize: 13 };
/** Botón pequeño de modal (11 px) que comparten las tablas hermanas. Ej: el botón de añadir fila en RciSpecialAccTable. */
const BTN: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg3)',
  color: 'var(--txt2)',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

export type EditarRci = RciCtx['editar'];

export { NOTA, TDCB, TDC12, IN, TH_TUBERIA, TDCC, INC, NOTAC, BTN };
