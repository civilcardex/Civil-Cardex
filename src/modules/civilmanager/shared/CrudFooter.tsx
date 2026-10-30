import type { ReactNode } from 'react';
import { ActionIcon } from './icons.tsx';
// ponytail: onClearAll/clearLabel/children salieron — 0 callers en 8 sitios verificados.
import { useEditable } from './EditLock.tsx';

interface ExcelHandle {
  fileInputEl: ReactNode;
  triggerImport: () => void;
  exportExcel: () => void;
}

interface Props {
  onAdd?: () => void;
  addLabel?: string;
  excel?: ExcelHandle;
  exportLabel?: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  countLabel: string;
  count: number;
}

/** Pie de tabla CRUD (crear/editar/borrar): botón Agregar, import/export Excel, buscador y contador de registros — todo se oculta fuera del modo edición salvo el contador. */
export function CrudFooter({
  onAdd,
  addLabel,
  excel,
  exportLabel,
  search,
  countLabel,
  count,
}: Props) {
  const editable = useEditable();
  return (
    <div className="cm-xl-foot">
      {onAdd && editable && (
        <button type="button" className="cm-btn cm-btn-ok" onClick={onAdd}>
          <ActionIcon name="add" label="" /> {addLabel}
        </button>
      )}
      {excel && editable && excel.fileInputEl}
      {excel && editable && (
        <button type="button" className="cm-btn cm-btn-ac" onClick={excel.triggerImport}>
          <ActionIcon name="upload" label="" /> Importar
        </button>
      )}
      {excel && (
        <button type="button" className="cm-btn cm-btn-warn" onClick={excel.exportExcel}>
          <ActionIcon name="download" label="" /> {exportLabel ?? 'Exportar'}
        </button>
      )}
      {search && (
        <input
          className="cm-ni cm-search"
          placeholder={search.placeholder}
          aria-label={search.placeholder}
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
        />
      )}
      <span className="cm-flex-1" />
      <span style={{ fontSize: 11 }}>
        {countLabel} <b>{count}</b>
      </span>
    </div>
  );
}
