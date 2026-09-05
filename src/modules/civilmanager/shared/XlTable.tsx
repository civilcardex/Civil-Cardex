import { memo, type ReactNode } from 'react';
import { ActionIcon } from './icons';
import { useEditable } from './EditLock';

export function XlWrap({ children }: { children: ReactNode }) {
  return <div className="cm-xl-wrap">{children}</div>;
}

export function XlScroll({ children }: { children: ReactNode }) {
  return <div className="cm-xl-scroll">{children}</div>;
}

export const XlRowNum = memo(function XlRowNum({ n }: { n: number }) {
  return <td className="cm-col-rn">{n}</td>;
});

interface XlActProps {
  onEdit: () => void;
  onDelete: () => void;
}

/** Celda de acciones por fila; deshabilitada fuera del modo edición de la pestaña. */
export const XlAct = memo(function XlAct({ onEdit, onDelete }: XlActProps) {
  const editable = useEditable();
  return (
    <td className="cm-col-act">
      <button
        type="button"
        className="cm-btn-icon"
        onClick={onEdit}
        aria-label="Editar"
        disabled={!editable}
      >
        <ActionIcon name="edit" label="Editar" />
      </button>
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
