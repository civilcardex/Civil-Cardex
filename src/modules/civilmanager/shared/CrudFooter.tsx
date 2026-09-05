import type { ReactNode } from 'react';
import { ActionIcon } from './icons';
import { useEditable } from './EditLock';

interface ExcelHandle {
  fileInputEl: ReactNode;
  triggerImport: () => void;
  exportExcel: () => void;
}

interface Props {
  onAdd?: () => void;
  addLabel?: string;
  onClearAll?: () => void;
  clearLabel?: string;
  excel?: ExcelHandle;
  exportLabel?: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  countLabel: string;
  count: number;
  children?: ReactNode;
}

export function CrudFooter({
  onAdd,
  addLabel,
  onClearAll,
  clearLabel,
  excel,
  exportLabel,
  search,
  countLabel,
  count,
  children,
}: Props) {
  const editable = useEditable();
  return (
    <div className="cm-xl-foot">
      {onAdd && editable && (
        <button type="button" className="cm-btn cm-btn-ok" onClick={onAdd}>
          <ActionIcon name="add" label="" /> {addLabel}
        </button>
      )}
      {onClearAll && editable && (
        <button type="button" className="cm-btn cm-btn-err" onClick={onClearAll}>
          <ActionIcon name="delete" label="" /> {clearLabel}
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
      {children}
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
