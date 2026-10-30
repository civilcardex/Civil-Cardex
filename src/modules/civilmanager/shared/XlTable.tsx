import { memo, type CSSProperties, type ReactNode } from 'react';
import { ActionIcon } from './icons.tsx';
import { useEditable } from './EditLock.tsx';

/** Contenedor de tabla estilo hoja de Excel (borde y header sticky). Ej: envuelve toda la grilla de insumos. */
export function XlWrap({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="cm-xl-wrap" style={style}>
      {children}
    </div>
  );
}

/** Zona con scroll horizontal/vertical dentro de un XlWrap (la tabla no rompe el layout). */
export function XlScroll({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="cm-xl-scroll" style={style}>
      {children}
    </div>
  );
}

/** Celda de número de fila (columna #, como el gutter de Excel). */
export const XlRowNum = memo(function XlRowNum({ n }: { n: number }) {
  return <td className="cm-col-rn">{n}</td>;
});

interface XlActProps {
  onDelete: () => void;
}

/** Celda de acciones por fila (solo eliminar — editar es por tabla con EDITAR, pedido del
 *  cliente); deshabilitada fuera del modo edición de la pestaña. */
export const XlAct = memo(function XlAct({ onDelete }: XlActProps) {
  const editable = useEditable();
  return (
    <td className="cm-col-act">
      <button
        type="button"
        className="cm-btn-icon"
        onClick={onDelete}
        aria-label="Eliminar"
        disabled={!editable}
      >
        <ActionIcon name="delete" label="Eliminar" color="var(--err)" />
      </button>
    </td>
  );
});
