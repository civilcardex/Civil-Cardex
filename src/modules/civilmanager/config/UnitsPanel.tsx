import { useCallback, useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { askConfirm } from '../shared/ConfirmDialog.tsx';
import { showToast } from '../shared/Toast.tsx';
import { TIPOS_UNIDAD_PRE } from '../seedData.ts';
import { useCrudTable } from '../shared/useCrudTable.ts';
import { CrudTable, type CrudColumn } from '../shared/CrudTable.tsx';
import { EditableCell } from '../shared/EditableCell.tsx';
import type { UnidadMedida } from '../types.ts';

/** Fila con id materializado: UnidadMedida no lo trae en BD y useCrudTable borra/edita por id. */
type UnidadRow = UnidadMedida & { id: string };

/** Panel de unidades de medida del catálogo (m, m³, gl, und…) con su tipo predefinido para agrupar (longitud, volumen, unidad…). */
export function UnidadesPanel() {
  const { state, patch } = useCivilManager();
  const items = state.config_listas.unidades;

  // Materializa el id una vez por lote de datos y lo persiste con la primera escritura (el id
  // extra viaja en el jsonb sin molestar: el passthrough de config_listas no filtra claves).
  const rows = useMemo<UnidadRow[]>(
    () =>
      items.map((u) =>
        'id' in u && typeof u.id === 'string'
          ? (u as UnidadRow)
          : { ...u, id: crypto.randomUUID() },
      ),
    [items],
  );

  function setItems(next: UnidadRow[]) {
    patch({ config_listas: { ...state.config_listas, unidades: next } });
  }

  // Chequeo "en uso" propio (textos originales): useReferentialDelete formatea otro mensaje.
  const tryDelete = useCallback(
    (id: string, doDelete: () => void) => {
      const u = rows.find((r) => r.id === id);
      if (!u) return;
      void (async () => {
        const enUso =
          state.insumos.some((x) => x.unidad === u.abreviatura) ||
          state.apus.some((a) => a.unidad === u.abreviatura);
        if (enUso) {
          showToast('No se puede eliminar: unidad en uso por insumos o APU', { type: 'err' });
          return;
        }
        if (!(await askConfirm(`¿Eliminar la unidad "${u.abreviatura}"?`))) return;
        doDelete();
      })();
    },
    [rows, state.insumos, state.apus],
  );

  const { filtered, editIdx, setEditIdx, upd, add, del, handleKeyDown } = useCrudTable<UnidadRow>({
    items: rows,
    onChange: setItems,
    prefix: 'UN',
    defaultItem: () => ({
      id: crypto.randomUUID(),
      abreviatura: 'un',
      descripcion: 'Nueva unidad',
      tipo: 'General',
    }),
    searchKeys: ['abreviatura', 'descripcion', 'tipo'],
    confirmDel: '¿Eliminar esta unidad?',
    tryDelete,
  });

  /** Columnas de la grilla: las tres abren edición con doble clic (la pestaña no lleva buscador ni Excel). */
  const columns: CrudColumn<UnidadRow>[] = [
    {
      label: 'Abreviatura',
      title: 'Símbolo corto de la unidad (m2, kg, und…).',
      render: (u, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={u.abreviatura}
          onCommit={(v) => ctx.upd(u.id, 'abreviatura', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Abreviatura"
        />
      ),
    },
    {
      label: 'Descripción',
      title: 'Nombre completo de la unidad de medida.',
      render: (u, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={u.descripcion}
          onCommit={(v) => ctx.upd(u.id, 'descripcion', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Descripción"
        />
      ),
    },
    {
      label: 'Tipo',
      title: 'Clase de unidad (longitud, área, volumen…).',
      render: (u, edit, ctx) => (
        <EditableCell
          editing={edit}
          tipo="select"
          value={u.tipo}
          opciones={TIPOS_UNIDAD_PRE.map((t) => ({ value: t, label: t }))}
          onCommit={(v) => ctx.upd(u.id, 'tipo', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Tipo"
        />
      ),
    },
  ];

  return (
    <CrudTable
      title="Unidades de medida"
      icon="unidades_de_medida"
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
      emptyLabel="Sin unidades"
    />
  );
}
