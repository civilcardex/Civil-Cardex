import { useCallback, useMemo, useState } from 'react';
import { askConfirm } from './ConfirmDialog';
import { useExcelImportExport, type UseExcelImportExportOptions } from '../excelImport';

// Combining diacritical marks block (U+0300-U+036F), built from char codes to avoid embedding raw combining characters in source.
const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function norm(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();
}

export function handleTabKeyDown(setEditIdx: (i: number | null) => void) {
  return (_i: number, e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tr = (e.target as HTMLElement).closest('tr');
      const inputs = Array.from(tr?.querySelectorAll<HTMLElement>('input.cm-ni,select.cm-sel') ?? []);
      const idx = inputs.indexOf(e.target as HTMLElement);
      if (idx >= 0 && idx < inputs.length - 1) inputs[idx + 1].focus();
      else setEditIdx(null);
    } else if (e.key === 'Escape') {
      setEditIdx(null);
    }
  };
}

interface UseCrudTableOptions<T extends { id: string; codigo?: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  prefix: string;
  defaultItem: () => T;
  searchKeys: (keyof T)[];
  confirmDel: string;
  excelConfig?: Omit<UseExcelImportExportOptions<T>, 'items' | 'onImport' | 'prefix'>;
}

/** CRUD genérico para catálogos: edición inline, búsqueda, borrado con confirmación, import/export opcional. */
export function useCrudTable<T extends { id: string; codigo?: string }>({ items, onChange, prefix, defaultItem, searchKeys, confirmDel, excelConfig }: UseCrudTableOptions<T>) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const upd = useCallback(
    (i: number, k: keyof T, v: T[keyof T]) => {
      const n = [...items];
      n[i] = { ...n[i], [k]: v };
      onChange(n);
    },
    [items, onChange]
  );

  const add = useCallback(() => {
    const d = defaultItem();
    const n = [...items, d];
    onChange(n);
    setEditIdx(n.length - 1);
  }, [items, onChange, defaultItem]);

  const del = useCallback(
    async (i: number) => {
      if (!(await askConfirm(confirmDel))) return;
      if (editIdx === i) setEditIdx(null);
      onChange(items.filter((_, j) => j !== i));
    },
    [items, onChange, editIdx, confirmDel]
  );

  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter(item => searchKeys.some(k => norm(String(item[k] ?? '')).includes(norm(search))));
  }, [items, search, searchKeys]);

  const handleKeyDown = handleTabKeyDown(setEditIdx);

  const excel = useExcelImportExport<T>({
    items,
    onImport: onChange,
    prefix,
    title: excelConfig?.title ?? '',
    sheetName: excelConfig?.sheetName ?? 'Datos',
    filename: excelConfig?.filename ?? 'export.xlsx',
    headers: excelConfig?.headers ?? [],
    colWidths: excelConfig?.colWidths,
    mapRow: excelConfig?.mapRow ?? (() => []),
    parseRow: excelConfig?.parseRow ?? (row => row),
    buildItem: excelConfig?.buildItem ?? (() => defaultItem()),
    matchKey: excelConfig?.matchKey,
  });

  return { items, editIdx, setEditIdx, search, setSearch, upd, add, del, filtered, handleKeyDown, excel };
}
