import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { genCodeFor } from '../codeGen.ts';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal.tsx';
import { useCrudTable } from '../shared/useCrudTable.ts';
import { CrudTable, type CrudColumn } from '../shared/CrudTable.tsx';
import { EditableCell } from '../shared/EditableCell.tsx';
import { EditableSection } from '../shared/EditLock.tsx';
import { useReferentialDelete } from '../shared/useReferentialDelete.ts';
import type { Proveedor } from '../types.ts';

/** Tab de proveedores: contacto/nit/teléfonos y los tipos de suministro que manejan. Se borra solo si ningún equipo o insumo los referencia. */
export function ProveedoresTab() {
  const { state, patch } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) =>
      state.equipos.filter((e) => e.proveedor_id === id).length +
      state.insumos.filter((x) => x.proveedor_id === id).length;
  }, [state.equipos, state.insumos]);
  const tryDelete = useReferentialDelete(countUsage, 'equipo(s)/insumo(s)');

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, del, handleKeyDown, excel } =
    useCrudTable<Proveedor>({
      items: state.proveedores,
      onChange: (proveedores) => patch({ proveedores }),
      prefix: 'PR',
      defaultItem: () => ({
        id: crypto.randomUUID(),
        codigo: genCodeFor(state.proveedores, 'PR'),
        nombre: 'Nuevo proveedor',
        nit: '',
        contacto: '',
        tel1: '',
        tel2: '',
        email: '',
        direccion: '',
        ciudad: '',
        departamento: '',
        tipo: [],
        notas: '',
        activo: true,
      }),
      searchKeys: ['codigo', 'nombre', 'nit', 'ciudad'],
      confirmDel: '¿Eliminar este proveedor?',
      tryDelete,
      excelConfig: {
        title: 'Proveedores',
        sheetName: 'Proveedores',
        filename: 'proveedores_civilmanager.xlsx',
        headers: ['Código', 'Nombre', 'NIT', 'Contacto', 'Teléfono', 'Ciudad'],
        colWidths: [{ wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 16 }],
        mapRow: (p) => [p.codigo, p.nombre, p.nit, p.contacto, p.tel1, p.ciudad],
        parseRow: (row) => row,
        buildItem: (row, idx, existing, nextCode) => ({
          id: idx >= 0 ? existing[idx].id : crypto.randomUUID(),
          codigo: String(row[0] || nextCode()),
          nombre: String(row[1] || ''),
          nit: String(row[2] || ''),
          contacto: String(row[3] || ''),
          tel1: String(row[4] || ''),
          tel2: idx >= 0 ? existing[idx].tel2 : '',
          email: idx >= 0 ? existing[idx].email : '',
          direccion: idx >= 0 ? existing[idx].direccion : '',
          ciudad: String(row[5] || ''),
          departamento: idx >= 0 ? existing[idx].departamento : '',
          tipo: idx >= 0 ? existing[idx].tipo : [],
          notas: idx >= 0 ? existing[idx].notas : '',
          activo: true,
        }),
      },
    });

  /** Columnas de la grilla: Código es informativo (lo genera el sistema); el resto abre edición con doble clic. */
  const columns: CrudColumn<Proveedor>[] = [
    {
      label: 'Código',
      title: 'Código único del proveedor (PR-xxx), generado automáticamente.',
      render: (p) => p.codigo,
    },
    {
      label: 'Nombre',
      title: 'Razón social o nombre comercial.',
      render: (p, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={p.nombre}
          onCommit={(v) => ctx.upd(p.id, 'nombre', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Nombre"
        />
      ),
    },
    {
      label: 'NIT',
      title: 'Número de identificación tributaria.',
      render: (p, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={p.nit}
          onCommit={(v) => ctx.upd(p.id, 'nit', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="NIT"
        />
      ),
    },
    {
      label: 'Contacto',
      title: 'Persona de contacto del proveedor.',
      render: (p, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={p.contacto}
          onCommit={(v) => ctx.upd(p.id, 'contacto', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Contacto"
        />
      ),
    },
    {
      label: 'Teléfono',
      title: 'Teléfono principal de contacto.',
      render: (p, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={p.tel1}
          onCommit={(v) => ctx.upd(p.id, 'tel1', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Teléfono"
        />
      ),
    },
    {
      label: 'Ciudad',
      title: 'Ciudad de origen; afecta tiempos y costos de transporte.',
      render: (p, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={p.ciudad}
          onCommit={(v) => ctx.upd(p.id, 'ciudad', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Ciudad"
        />
      ),
    },
  ];

  return (
    <EditableSection dim={false}>
      <CrudTable
        title="Proveedores"
        icon="proveedores_tabla"
        columns={columns}
        items={filtered}
        editIdx={editIdx}
        setEditIdx={setEditIdx}
        del={del}
        upd={upd}
        handleKeyDown={handleKeyDown}
        onAdd={add}
        addLabel="Nuevo Proveedor"
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }}
        excel={excel}
        exportLabel="Exportar"
        emptyLabel="Sin proveedores"
      />
      <ExcelPreviewModal excel={excel} />
    </EditableSection>
  );
}
