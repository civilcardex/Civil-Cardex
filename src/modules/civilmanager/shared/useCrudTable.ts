import { useCallback, useMemo, useState } from 'react';
import { askConfirm } from './ConfirmDialog.tsx';
import { useEditable } from './EditLock.tsx';
import { useExcelImportExport, type UseExcelImportExportOptions } from '../excelImport.tsx';
import { sinAcentos } from '../../civilflow/constants/helpers.ts';

function norm(s: string): string {
  return sinAcentos(s).toLowerCase();
}

/** Enter (salta al siguiente campo de la fila visible o cierra la edición) y Escape (cierra). Exportado para las tablas que editan por índice fuera del hook (ej: maestro-detalle con estado propio). */
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

/** Configuración de un catálogo: lista y escritor, item nuevo por defecto, claves donde busca y textos del borrado. */
interface UseCrudTableOptions<T extends { id: string; codigo?: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  prefix: string;
  defaultItem: () => T;
  searchKeys: (keyof T)[];
  confirmDel: string;
  /** Borrado con chequeo de referencias (useReferentialDelete): si viene, del() delega en él
   *  (resuelve el índice filtrado → id); si falta, pide confirmación y borra directo. */
  tryDelete?: (id: string, doDelete: () => void, msg: string) => void;
  excelConfig?: Omit<UseExcelImportExportOptions<T>, 'items' | 'onImport' | 'prefix'>;
}

/**
 * CRUD (crear, editar, borrar y listar) genérico para catálogos: edición inline (Enter salta al
 * siguiente campo), búsqueda sin acentos, borrado con confirmación e import/export opcional.
 * Ej: SuppliersTab solo define headers/buildItem — todo el comportamiento de la tabla es este hook.
 */
export function useCrudTable<T extends { id: string; codigo?: string }>({
  items,
  onChange,
  prefix,
  defaultItem,
  searchKeys,
  confirmDel,
  tryDelete,
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

  // del recibe el índice de la FILA VISIBLE (filtered): resuelve el id y borra por id —
  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter((item) =>
      searchKeys.some((k) => norm(String(item[k] ?? '')).includes(norm(search))),
    );
  }, [items, search, searchKeys]);

  // del recibe el índice de la FILA VISIBLE (filtered): resuelve el id y borra por id —
  // con tryDelete (chequeo de referencias) o con confirmación plana.
  const del = useCallback(
    (i: number) => {
      const item = filtered[i];
      if (!item) return;
      const doDelete = () => onChange(items.filter((x) => x.id !== item.id));
      if (tryDelete) {
        tryDelete(item.id, doDelete, confirmDel);
        return;
      }
      void (async () => {
        if (!(await askConfirm(confirmDel))) return;
        setEditIdxState((cur) => (cur === i ? null : cur));
        doDelete();
      })();
    },
    [filtered, items, onChange, confirmDel, tryDelete],
  );

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
