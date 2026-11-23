import { memo, type ReactNode } from 'react';
import { ActionIcon } from './icons.tsx';
import { useEditable } from './EditLock.tsx';

/** Contenedor de tabla estilo hoja de Excel (borde y header sticky). Ej: envuelve toda la grilla de insumos. */
export function XlWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`cm-xl-wrap ${className}`.trim()}>{children}</div>;
}

/** Zona con scroll horizontal/vertical dentro de un XlWrap (la tabla no rompe el layout). */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- las tablas se desplazan con teclado */
export function XlScroll({
  children,
  className = '',
  label = 'Tabla desplazable',
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`cm-xl-scroll ${className}`.trim()}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
/* eslint-enable jsx-a11y/no-noninteractive-tabindex */

/** Celda de número de fila (columna #, como el gutter de Excel). */
export const XlRowNum = memo(function XlRowNum({ n }: { n: number }) {
  return <td className="cm-col-rn">{n}</td>;
});

interface XlActProps {
  onDelete: () => void;
  onEdit?: () => void;
}

/** Celda de acciones por fila (solo eliminar — editar es por tabla con EDITAR, pedido del
 *  cliente); deshabilitada fuera del modo edición de la pestaña. */
export const XlAct = memo(function XlAct({ onDelete, onEdit }: XlActProps) {
  const editable = useEditable();
  return (
    <td className="cm-col-act">
      {onEdit && editable && (
        <button
          type="button"
          className="cm-btn-icon cm-touch-edit"
          onClick={onEdit}
          aria-label="Editar fila"
        >
          ✎
        </button>
      )}
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
