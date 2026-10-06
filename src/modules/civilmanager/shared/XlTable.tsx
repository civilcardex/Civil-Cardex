import { memo, type CSSProperties, type ReactNode } from 'react';
import { ActionIcon } from './icons';
import { useEditable } from './EditLock';

export function XlWrap({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="cm-xl-wrap" style={style}>
      {children}
    </div>
  );
}

export function XlScroll({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="cm-xl-scroll" style={style}>
      {children}
    </div>
  );
}

export const XlRowNum = memo(function XlRowNum({ n }: { n: number }) {
  return <td className="cm-col-rn">{n}</td>;
});

interface XlActProps {
  onDelete: () => void;
}

/** Celda de acciones por fila (solo eliminar — editar es por tabla con EDITAR, orig.
 *  usuario); deshabilitada fuera del modo edición de la pestaña. */
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
