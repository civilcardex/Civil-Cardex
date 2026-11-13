import { useCallback, useMemo } from 'react';
import { genCodeFor } from '../codeGen.ts';
import { askConfirm } from '../shared/ConfirmDialog.tsx';
import { showToast } from '../shared/Toast.tsx';
import { useCrudTable } from '../shared/useCrudTable.ts';
import { CrudTable, type CrudColumn } from '../shared/CrudTable.tsx';
import { EditableCell } from '../shared/EditableCell.tsx';
import type { ListaItem } from '../types.ts';

interface Props {
  title: string;
  /** Icono (sin extensión) de /iconos_civilmanager/ junto al título. */
  icon?: string;
  items: ListaItem[];
  onChange: (items: ListaItem[]) => void;
  prefix: string;
  labelField: 'nombre' | 'categoria';
  labelHeader: string;
  /** Recibe el valor de `labelField` (no el código) — las referencias cruzadas en este modelo usan el nombre. */
  countUsage?: (label: string) => number;
  usageLabel?: string;
}

/** Fila con id derivado del código (único por genCodeFor y nunca editable en la grilla). */
type ListaRow = ListaItem & { id: string };

/** Panel genérico para las listas de configuración con forma {codigo, nombre|categoria, desc}: alta/baja, conteo de uso y borrado bloqueado si el item se usa. Ej: OrigenesPanel = este panel con prefix 'OR'. */
export function ListaItemPanel({
  title,
  icon,
  items,
  onChange,
  prefix,
  labelField,
  labelHeader,
  countUsage,
  usageLabel,
}: Props) {
  // id = codigo: derivación determinista, así el write-back lo quita y el jsonb guardado no cambia de forma.
  const rows = useMemo<ListaRow[]>(() => items.map((it) => ({ ...it, id: it.codigo })), [items]);

  // Chequeo de uso propio (el formato del mensaje difiere del de useReferentialDelete).
  const tryDelete = useCallback(
    (id: string, doDelete: () => void) => {
      const it = rows.find((r) => r.id === id);
      if (!it) return;
      void (async () => {
        if (countUsage) {
          const count = countUsage(it[labelField] ?? '');
          if (count > 0) {
            showToast(`No se puede eliminar: usado en ${count} ${usageLabel ?? 'registro(s)'}`, {
              type: 'err',
            });
            return;
          }
        }
        if (!(await askConfirm(`¿Eliminar "${it[labelField]}"?`))) return;
        doDelete();
      })();
    },
    [rows, countUsage, usageLabel, labelField],
  );

  const { filtered, editIdx, setEditIdx, upd, add, del, handleKeyDown } = useCrudTable<ListaRow>({
    items: rows,
    onChange: (next) => onChange(next.map(({ id: _id, ...it }) => it)),
    prefix,
    defaultItem: () =>
      ({
        id: crypto.randomUUID(),
        codigo: genCodeFor(items, prefix),
        desc: '',
        [labelField]: 'Nuevo',
      }) as ListaRow,
    searchKeys: ['codigo', labelField, 'desc'],
    confirmDel: '¿Eliminar este ítem?',
    tryDelete,
  });

  /** Columnas de la grilla: Código informativo; nombre y descripción abren edición con doble clic. */
  const columns: CrudColumn<ListaRow>[] = [
    {
      label: 'Código',
      title: 'Código único del ítem de la lista, generado automáticamente.',
      render: (it) => it.codigo,
    },
    {
      label: labelHeader,
      render: (it, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={it[labelField] ?? ''}
          onCommit={(v) => ctx.upd(it.id, labelField, v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title={labelHeader}
        />
      ),
    },
    {
      label: 'Descripción',
      title: 'Detalle del ítem; la columna anterior es su nombre.',
      // El color tenue lo lleva el span exterior porque el input no hereda color.
      render: (it, edit, ctx) => (
        <span className="cm-txt2">
          <EditableCell
            editing={edit}
            value={it.desc}
            onCommit={(v) => ctx.upd(it.id, 'desc', v)}
            onOpenEdit={ctx.editRow}
            onKeyDown={ctx.handleKeyDown}
            title="Descripción"
          />
        </span>
      ),
    },
  ];

  return (
    <CrudTable
      title={title}
      icon={icon}
      columns={columns}
      items={filtered}
      editIdx={editIdx}
      setEditIdx={setEditIdx}
      del={del}
      upd={upd}
      handleKeyDown={handleKeyDown}
      onAdd={add}
      addLabel="Agregar"
      countLabel="Total:"
      emptyLabel="Sin registros"
    />
  );
}
