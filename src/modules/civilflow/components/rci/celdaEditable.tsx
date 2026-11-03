/** Celda de valor de las tablas editables RCI (Red Contra Incendio), patrón sanitario +
 *  edición en sitio: OFF muestra el valor centrado como texto plano y ON superpone el control
 *  (absolute) sobre la MISMA caja — mismo ancho (ancho×3 fijo, o 3× el texto con piso 12ch) y
 *  mismo alto (24px) en ambos estados, así EDITAR no mueve ni un pixel de la tabla. Ej:
 *  {celdaEditable(edit && !off, <input style={{ ...IN_CELDA, fontSize: 13 }} />, v, 70)}. */
import { cloneElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Estilo del control activo (tipo sanitario): mono con caja de 1px. El wrapper le fuerza
 *  width/height 100% — la geometría la manda la caja compartida, nunca el control. */
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

const ALTO = 24;

/** Caja compartida OFF/ON: inline-flex centrada, alto 24, ancho = ancho×3 fijo o 3× el texto
 *  (piso 12ch). Ej: caja(true, 70) para el control y caja(true) en el wrapper del overlay. */
function caja(ancho?: number, texto = ''): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    height: ALTO,
    ...(ancho ? { width: ancho * 3 } : { minWidth: `${Math.max(12, texto.length * 3)}ch` }),
  };
}

/** Contenido de una celda de valor: OFF → el texto centrado en la caja; ON → la caja con el
 *  control clonado ocupándola entera (inset 0). `ancho` fija el ancho (se triplica) cuando el
 *  control tiene uno propio; sin ancho, la caja mide 3× el texto natural. */
export function celdaEditable(
  on: boolean,
  control: ReactElement,
  valor: unknown,
  ancho?: number,
): ReactNode {
  const v = valor === null || valor === undefined ? '' : String(valor);
  const texto = v === '' ? '—' : v;
  if (!on) {
    return (
      <span style={{ ...caja(ancho, texto), ...(v === '' ? { color: 'var(--txt3)' } : null) }}>
        {texto}
      </span>
    );
  }
  return (
    <span style={{ ...caja(ancho, texto), position: 'relative' }}>
      <span style={{ position: 'absolute', inset: 0, display: 'flex' }}>
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
