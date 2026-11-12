import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { genCodeFor } from '../codeGen.ts';
import { fmtDate, isCotOld } from '../excelImport.tsx';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal.tsx';
import { useCrudTable } from '../shared/useCrudTable.ts';
import { CrudTable, type CrudColumn } from '../shared/CrudTable.tsx';
import { EditableCell } from '../shared/EditableCell.tsx';
import { EditableSection } from '../shared/EditLock.tsx';
import { useReferentialDelete } from '../shared/useReferentialDelete.ts';
import type { Equipo } from '../types.ts';

/** Tab de equipos (máquinas con costo_hora): edita precio y proveedor, y marca en rojo la fecha de cotización con más de 180 días (isCotOld). */
export function EquiposTab() {
  const { state, patch } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) =>
      state.apus.reduce(
        (n, a) =>
          n +
          a.recursos_eq.filter((r) => r.equipo_id === id).length +
          a.recursos_transporte.filter((r) => r.equipo_id === id).length,
        0,
      );
  }, [state.apus]);
  const tryDelete = useReferentialDelete(countUsage, 'APU(s)');

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, del, handleKeyDown, excel } =
    useCrudTable<Equipo>({
      items: state.equipos,
      onChange: (equipos) => patch({ equipos }),
      prefix: 'EQ',
      defaultItem: () => ({
        id: crypto.randomUUID(),
        codigo: genCodeFor(state.equipos, 'EQ'),
        nombre: 'Nuevo equipo',
        tipo: state.config_listas.tipos_equipo[0]?.nombre ?? '',
        unidad: 'hr',
        costo_hora: 0,
        fecha_cotizacion: '',
        proveedor_id: '',
      }),
      searchKeys: ['codigo', 'nombre', 'tipo'],
      confirmDel: '¿Eliminar este equipo?',
      tryDelete,
      excelConfig: {
        title: 'Equipos',
        sheetName: 'Equipos',
        filename: 'equipos_civilmanager.xlsx',
        headers: ['Código', 'Nombre', 'Tipo', 'Costo/Hora', 'Fecha Cotización'],
        colWidths: [{ wch: 12 }, { wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 16 }],
        mapRow: (e) => [e.codigo, e.nombre, e.tipo, e.costo_hora, e.fecha_cotizacion],
        parseRow: (row) => row,
        buildItem: (row, idx, existing, nextCode) => ({
          id: idx >= 0 ? existing[idx].id : crypto.randomUUID(),
          codigo: String(row[0] || nextCode()),
          nombre: String(row[1] || ''),
          tipo: String(row[2] || ''),
          unidad: 'hr',
          costo_hora: Number(row[3]) || 0,
          fecha_cotizacion: String(row[4] || ''),
          proveedor_id: idx >= 0 ? existing[idx].proveedor_id : '',
        }),
      },
    });

  /** Columnas de la grilla: Código informativo; el resto abre edición con doble clic. */
  const columns: CrudColumn<Equipo>[] = [
    {
      label: 'Código',
      title: 'Código único del equipo (EQ-xxx), generado automáticamente.',
      render: (e) => e.codigo,
    },
    {
      label: 'Nombre',
      title: 'Nombre descriptivo del equipo.',
      render: (e, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={e.nombre}
          onCommit={(v) => ctx.upd(e.id, 'nombre', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Nombre"
        />
      ),
    },
    {
      label: 'Tipo',
      title:
        'Clasificación: maquinaria pesada, equipo menor, transporte… (lista editable en Configuración).',
      render: (e, edit, ctx) => (
        <EditableCell
          editing={edit}
          tipo="select"
          value={e.tipo}
          opciones={state.config_listas.tipos_equipo.map((t) => {
            const nombre = t.nombre ?? '';
            return { value: nombre, label: nombre };
          })}
          onCommit={(v) => ctx.upd(e.id, 'tipo', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Tipo"
        />
      ),
    },
    {
      label: 'Costo/Hora',
      title: 'Tarifa por hora que el APU multiplica por el rendimiento del equipo.',
      render: (e, edit, ctx) => (
        <EditableCell
          editing={edit}
          tipo="moneda"
          value={String(e.costo_hora)}
          onCommit={(v) => ctx.upd(e.id, 'costo_hora', Number(v) || 0)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Costo/Hora"
        />
      ),
    },
    {
      label: 'Cotizado',
      title: 'Fecha de la última cotización; se resalta cuando está desactualizada.',
      // Columna informativa (el color de alerta no lo puede llevar el td de CrudTable).
      render: (e) => (
        <span style={{ color: isCotOld(e.fecha_cotizacion) ? 'var(--warn)' : undefined }}>
          {fmtDate(e.fecha_cotizacion)}
        </span>
      ),
    },
  ];

  return (
    <EditableSection dim={false}>
      <CrudTable
        title="Equipos"
        icon="equipos_tabla"
        columns={columns}
        items={filtered}
        editIdx={editIdx}
        setEditIdx={setEditIdx}
        del={del}
        upd={upd}
        handleKeyDown={handleKeyDown}
        onAdd={add}
        addLabel="Nuevo Equipo"
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }}
        excel={excel}
        exportLabel="Exportar"
        emptyLabel="Sin equipos"
      />
      <ExcelPreviewModal excel={excel} />
    </EditableSection>
  );
}
