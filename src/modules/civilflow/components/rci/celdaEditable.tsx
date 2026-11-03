/** Celda de valor de las tablas editables RCI (Red Contra Incendio), patrón sanitario +
 *  edición en sitio: la columna SIEMPRE mide lo del texto — OFF muestra el valor plano y ON
 *  superpone el control (absolute) sobre un span invisible que conserva la geometría, así
 *  activar EDITAR jamás ensancha la columna. Ej:
 *  {celdaEditable(edit && !off, <input style={{ ...IN_CELDA, fontSize: 13 }} />, v, 70)}. */
import { cloneElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Estilo del control activo (tipo sanitario): mono con caja de 1px. El wrapper le fuerza
 *  width/height 100% — el ancho de columna lo manda el span, nunca el control. */
export const IN_CELDA: CSSProperties = {
  fontFamily: 'var(--mono)',
  padding: '0 2px',
  border: '1px solid var(--line)',
  borderRadius: 2,
  background: 'var(--bg2)',
  color: 'var(--txt)',
  cursor: 'pointer',
  margin: 0,
};

/** Ancho del control de una celda editable, en `ch` (ancho de dígito en la mono de la tabla):
 *  el del valor que muestra +2 de aire, piso 6 y techo 28. Ej: '50' → '6ch'. */
export function anchoValor(v: unknown): string {
  return `${Math.min(28, Math.max(6, String(v ?? '').length + 2))}ch`;
}

/** Contenido de una celda de valor: OFF → span plano con el valor ('—' gris si vacío);
 *  ON → el MISMO span (invisible, manda el ancho de columna) con el control clonado encima
 *  ocupando su caja exacta. `ancho` fija el ancho del span cuando el control tiene uno propio
 *  (misma cifra que el control); sin ancho, el span mide su texto natural. */
export function celdaEditable(
  on: boolean,
  control: ReactElement,
  valor: unknown,
  ancho?: number,
): ReactNode {
  const v = valor === null || valor === undefined ? '' : String(valor);
  const texto = v === '' ? '—' : v;
  /* Triple ancho en AMBOS estados: mínimo 12ch (o 3× el texto) para celdas aireadas pero
   * idénticas entre OFF y ON. */
  const anchoBase = ancho ? ancho * 3 : undefined;
  const minCh = `${Math.max(12, texto.length * 3)}ch`;
  const ALTO = 24; /* alto compartido OFF/ON: la fila no cambia de alto al editar. */
  const estiloSpan: CSSProperties = {
    display: 'inline-block',
    height: ALTO,
    lineHeight: 24,
    verticalAlign: 'middle',
    minWidth: minCh,
    ...(v === '' && !on ? { color: 'var(--txt3)' } : null),
    ...(anchoBase
      ? { width: anchoBase, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
      : null),
  };
  if (!on) return <span style={estiloSpan}>{texto}</span>;
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        verticalAlign: 'middle',
        height: ALTO,
        ...(anchoBase ? { width: anchoBase } : { minWidth: minCh }),
      }}
    >
      {/* Geometría: este span (invisible) define el ancho de columna de la celda. */}
      <span style={{ visibility: 'hidden' }}>{texto}</span>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {cloneElement(control as ReactElement<{ style?: CSSProperties }>, {
          style: {
            ...(control.props as { style?: CSSProperties }).style,
            width: '100%',
            height: '100%',
            margin: 0,
            boxSizing: 'border-box',
          },
        })}
      </span>
    </span>
  );
}
