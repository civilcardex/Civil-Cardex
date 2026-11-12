import type { KeyboardEvent, ReactNode } from 'react';
import { CrudFooter } from './CrudFooter.tsx';
import { DimEnLectura, TableHeader } from './EditLock.tsx';
import { XlAct, XlRowNum, XlScroll, XlWrap } from './XlTable.tsx';

/** Pieza de contexto que CrudTable pasa a cada render de columna: upd por id, abrir la fila en edición y el Enter/Escape de navegación ya enlazado al índice de fila visible. */
export interface CrudCellCtx<T extends { id: string }> {
  /** Escribe un campo por id (el upd de useCrudTable). Ej: (v) => ctx.upd(p.id, 'nombre', v). */
  upd: (id: string, k: keyof T, v: T[keyof T]) => void;
  /** Abre la edición de ESTA fila (setEditIdx(i)); alimente con él el onOpenEdit de EditableCell. */
  editRow: () => void;
  /** Enter (siguiente campo o cerrar la fila) y Escape (cerrar) ya enlazados a la fila visible; páselo al onKeyDown de EditableCell. */
  handleKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

/** Definición de una columna: encabezado (label + tooltip) y render del contenido de cada fila. */
export interface CrudColumn<T extends { id: string }> {
  /** Texto del encabezado. */
  label: string;
  /** Tooltip del encabezado (el mismo que hoy llevan los <th title>). */
  title?: string;
  width?: number | string;
  /** Alineación del encabezado y del td (los spans de EditableCell la heredan). */
  align?: 'left' | 'center' | 'right';
  /** Contenido de la celda. Ej: (p, edit, ctx) => <EditableCell editing={edit} value={p.nombre} onCommit={(v) => ctx.upd(p.id, 'nombre', v)} onOpenEdit={ctx.editRow} />. */
  render: (fila: T, editing: boolean, ctx: CrudCellCtx<T>) => ReactNode;
}

/** Handle de import/export Excel que devuelve useCrudTable (misma forma que espera CrudFooter). */
interface ExcelHandle {
  fileInputEl: ReactNode;
  triggerImport: () => void;
  exportExcel: () => void;
}

interface CrudTableProps<T extends { id: string }> {
  columns: CrudColumn<T>[];
  /** Filas ya filtradas (el `filtered` de useCrudTable); el índice de cada una es el de fila visible. */
  items: T[];
  /** Índice de fila visible en edición (null = ninguna). */
  editIdx: number | null;
  setEditIdx: (i: number | null) => void;
  /** Borra por índice de fila VISIBLE (el del de useCrudTable, con confirmación o chequeo de referencias). */
  del: (i: number) => void;
  /** El upd de useCrudTable; llega al ctx de las columnas. */
  upd: (id: string, k: keyof T, v: T[keyof T]) => void;
  /** El handleKeyDown de useCrudTable: Enter salta al siguiente campo de la fila, Escape la cierra. */
  handleKeyDown: (i: number, e: KeyboardEvent<HTMLElement>) => void;
  onAdd?: () => void;
  addLabel?: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  excel?: ExcelHandle;
  exportLabel?: string;
  /** Etiqueta del contador del pie. */
  countLabel?: string;
  /** Texto de la fila vacía (cm-empty-row). */
  emptyLabel?: string;
  /** Si viene, dibuja el TableHeader con el botón EDITAR/LISTO de la pestaña. */
  title?: string;
  /** Icono del header (nombre del webp en iconos_civilmanager, sin extensión). */
  icon?: string;
}

/** Tabla CRUD (crear, leer, actualizar y borrar) declarativa de civilmanager: arma la grilla completa (XlWrap > header opcional > zona con scroll > tabla con #, columnas y acciones) a partir de `columns`, más fila vacía y pie opcional con Agregar, buscador e import/export Excel (CrudFooter). Las celdas editables se pintan con EditableCell dentro del render de cada columna. Ej:
 *  <CrudTable
 *    title="Proveedores" icon="proveedores_tabla"
 *    columns={[{ label: 'Nombre', title: 'Razón social.', render: (p, edit, ctx) => (
 *      <EditableCell editing={edit} value={p.nombre} onCommit={(v) => ctx.upd(p.id, 'nombre', v)} onOpenEdit={ctx.editRow} onKeyDown={ctx.handleKeyDown} title="Nombre" />
 *    )} ]}
 *    items={filtered} editIdx={editIdx} setEditIdx={setEditIdx} del={del} upd={upd} handleKeyDown={handleKeyDown}
 *    onAdd={add} addLabel="Nuevo Proveedor" search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }}
 *    excel={excel} emptyLabel="Sin proveedores" />. */
export function CrudTable<T extends { id: string }>({
  columns,
  items,
  editIdx,
  setEditIdx,
  del,
  upd,
  handleKeyDown,
  onAdd,
  addLabel,
  search,
  excel,
  exportLabel,
  countLabel = 'Total:',
  emptyLabel = 'Sin registros',
  title,
  icon,
}: CrudTableProps<T>) {
  // + número de fila y acciones, como los colSpan fijos de las tabs actuales.
  const colSpan = columns.length + 2;
  const hasFooter = Boolean(onAdd || search || excel);

  return (
    <XlWrap>
      {title && <TableHeader title={title} icon={icon} />}
      <DimEnLectura>
        <XlScroll>
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                {columns.map((c) => (
                  <th
                    key={c.label}
                    scope="col"
                    title={c.title}
                    style={{ width: c.width, textAlign: c.align }}
                  >
                    {c.label}
                  </th>
                ))}
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="cm-empty-row">
                    {emptyLabel}
                  </td>
                </tr>
              )}
              {items.map((fila, i) => {
                const editing = editIdx === i;
                const ctx: CrudCellCtx<T> = {
                  upd,
                  editRow: () => setEditIdx(i),
                  handleKeyDown: (e) => handleKeyDown(i, e),
                };
                return (
                  <tr key={fila.id}>
                    <XlRowNum n={i + 1} />
                    {columns.map((c) => (
                      <td key={c.label} style={{ textAlign: c.align }}>
                        {c.render(fila, editing, ctx)}
                      </td>
                    ))}
                    <XlAct onDelete={() => del(i)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </XlScroll>
        {hasFooter && (
          <CrudFooter
            onAdd={onAdd}
            addLabel={addLabel}
            excel={excel}
            exportLabel={exportLabel}
            search={search}
            countLabel={countLabel}
            count={items.length}
          />
        )}
      </DimEnLectura>
    </XlWrap>
  );
}
