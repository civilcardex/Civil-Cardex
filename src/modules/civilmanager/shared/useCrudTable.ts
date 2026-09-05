import { useCallback, useMemo, useState } from 'react';
import { askConfirm } from './ConfirmDialog';
import { useEditable } from './EditLock';
import { useExcelImportExport, type UseExcelImportExportOptions } from '../excelImport';

// Combining diacritical marks block (U+0300-U+036F), built from char codes to avoid embedding raw combining characters in source.
const DIACRITICS_RE = new RegExp(
  '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']',
  'g',
);

function norm(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();
}

export function handleTabKeyDown(setEditIdx: (i: number | null) => void) {
  return (_i: number, e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tr = (e.target as HTMLElement).closest('tr');
      const inputs = Array.from(
        tr?.querySelectorAll<HTMLElement>('input.cm-ni,select.cm-sel') ?? [],
      );
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
export function useCrudTable<T extends { id: string; codigo?: string }>({
  items,
  onChange,
  prefix,
  defaultItem,
  searchKeys,
  confirmDel,
  excelConfig,
}: UseCrudTableOptions<T>) {
  const [editIdxState, setEditIdxState] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const editable = useEditable();

  // Fuera del modo edición de la pestaña no se puede entrar a editar una fila.
  const setEditIdx = useCallback(
    (i: number | null) => setEditIdxState(editable ? i : null),
    [editable],
  );
  // Al salir del modo edición ninguna fila queda abierta (no resucita al reentrar).
  // Ajuste en render (patrón React "adjust state when a prop changes") en vez de effect:
  // el reset es parte del resultado del render, no un efecto secundario.
  const [prevEditable, setPrevEditable] = useState(editable);
  if (prevEditable !== editable) {
    setPrevEditable(editable);
    if (!editable) setEditIdxState(null);
  }
  // Derivado: mientras esté en modo solo lectura, ninguna fila se muestra en edición.
  const editIdx = editable ? editIdxState : null;

  // Resuelve por id: los call sites iteran `filtered`, cuyo índice no coincide con el de `items` cuando hay búsqueda activa.
  const upd = useCallback(
    (id: string, k: keyof T, v: T[keyof T]) => {
      onChange(items.map((it) => (it.id === id ? { ...it, [k]: v } : it)));
    },
    [items, onChange],
  );

  const add = useCallback(() => {
    const d = defaultItem();
    const n = [...items, d];
    onChange(n);
    setEditIdx(n.length - 1);
  }, [items, onChange, defaultItem, setEditIdx]);

  const del = useCallback(
    async (i: number) => {
      if (!(await askConfirm(confirmDel))) return;
      setEditIdxState((cur) => (cur === i ? null : cur));
      onChange(items.filter((_, j) => j !== i));
    },
    [items, onChange, confirmDel],
  );

  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter((item) =>
      searchKeys.some((k) => norm(String(item[k] ?? '')).includes(norm(search))),
    );
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
    parseRow: excelConfig?.parseRow ?? ((row) => row),
    buildItem: excelConfig?.buildItem ?? (() => defaultItem()),
    matchKey: excelConfig?.matchKey,
  });

  return {
    items,
    editIdx,
    setEditIdx,
    search,
    setSearch,
    upd,
    add,
    del,
    filtered,
    handleKeyDown,
    excel,
  };
}
