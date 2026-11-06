/** Celda de valor de las tablas editables RCI (Red Contra Incendio) — patrón «Diseño de red
 *  sanitaria»: el control (input/select) SIEMPRE está montado con el mismo ancho, así activar
 *  EDITAR no desplaza ni agranda nada — solo cambia fondo y borde:
 *  ON → caja visible (borde var(--line) + fondo bg2); OFF → borde/fondo transparentes y el
 *  dato se lee como celda normal (selects gris por disabled). Los params valor/ancho quedan
 *  por compatibilidad con los ~40 call sites (no se usan). Ej:
 *  {celdaEditable(edit && !off, <input style={{ ...IN_CELDA, fontSize: 13, width: 64 }} />)}. */
import { cloneElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { TD } from '../../styles/sharedTableStyles.ts';

/** Estilo base del control: mono centrado, sin spinners ni flecha nativa (la flecha del select
 *  la añade celdaEditable como background cuando está ON). */
export const IN_CELDA: CSSProperties = {
  fontFamily: 'var(--mono)',
  padding: '0 2px',
  borderRadius: 2,
  color: 'var(--txt)',
  textAlign: 'center',
  textAlignLast: 'center',
  appearance: 'none',
  boxSizing: 'border-box',
  margin: 0,
};

/** Celda de SOLO LECTURA de las tablas de Hidráulica (Ramales/Tramos): 14 px compacta.
 *  Ej: <td style={TDC}>128,54</td>. */
export const TDC = { ...TD, fontSize: 14, padding: '1px 3px' } as const;

/** Celda EDITABLE de las tablas de Hidráulica: control centrado que no ensancha al activar
 *  EDITAR (el width lo pone cada celda sobre esta base). Ej: {...CELDA, width: 56}. */
export const CELDA: CSSProperties = {
  ...IN_CELDA,
  fontSize: 14,
  boxSizing: 'border-box',
  textAlign: 'center',
};

/** Control activo de las celdas de la tabla de PISOS (12 px): la variante compacta de
 *  CELDA. Ej: {...CELDA12, width: 120}. */
export const CELDA12: CSSProperties = {
  ...IN_CELDA,
  fontSize: 12,
  boxSizing: 'border-box',
  textAlign: 'center',
};

/** Ancho del control de una celda editable, en `ch` (ancho de dígito en la mono de la tabla):
 *  el del valor que muestra +2 de aire, piso 6 y techo 28. Ej: '50' → '6ch'. */
export function anchoValor(v: unknown): string {
  return `${Math.min(28, Math.max(6, String(v ?? '').length + 2))}ch`;
}

/** Contenido de una celda de valor: SIEMPRE el control (mismo ancho en ON y OFF), con
 *  readOnly/disabled gateado por `on` y el estilo cambiando solo fondo+borde. Los selects en
 *  OFF van disabled (grises, como las otras redes) y en ON con flecha SVG propia (Chromium no
 *  centra el valor mostrado con la flecha nativa). Ej:
 *  {celdaEditable(edit && !off, <input style={{ ...IN_CELDA, fontSize: 13, width: 64 }} />)}. */
export function celdaEditable(on: boolean, control: ReactElement): ReactNode {
  const isSelect = control.type === 'select';
  const props = control.props as { style?: CSSProperties; disabled?: boolean; readOnly?: boolean };
  return cloneElement(
    control as ReactElement<{ style?: CSSProperties; disabled?: boolean; readOnly?: boolean }>,
    {
      ...(isSelect
        ? { disabled: (props.disabled ?? false) || !on }
        : {
            readOnly: (props.readOnly ?? false) || !on,
            className: ((props as { className?: string }).className ?? '') + ' no-spin',
          }),
      style: {
        textAlign: 'center',
        textAlignLast: 'center',
        ...props.style,
        ...(isSelect
          ? {
              backgroundImage:
                'linear-gradient(45deg, transparent 50%, #8a9496 50%), linear-gradient(135deg, #8a9496 50%, transparent 50%)',
              backgroundPosition:
                'calc(100% - 9px) calc(50% - 1px), calc(100% - 5px) calc(50% - 1px)',
              backgroundSize: '4px 4px, 4px 4px',
              backgroundRepeat: 'no-repeat, no-repeat',
              padding: '0 14px',
            }
          : null),
        ...(on
          ? {
              border: '1px solid var(--line)',
              backgroundColor: 'var(--bg2)',
              cursor: isSelect ? 'pointer' : 'text',
            }
          : {
              border: '1px solid transparent',
              backgroundColor: 'transparent',
              cursor: isSelect ? 'default' : 'text',
            }),
      },
    },
  );
}
