import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { genCodeFor } from '../codeGen.ts';
import { fmtMoneda } from '../calc.ts';
import { fmtDate, isCotOld } from '../excelImport.tsx';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal.tsx';
import { useCrudTable } from '../shared/useCrudTable.ts';
import { CrudTable, type CrudColumn } from '../shared/CrudTable.tsx';
import { EditableCell } from '../shared/EditableCell.tsx';
import { EditableSection } from '../shared/EditLock.tsx';
import { useReferentialDelete } from '../shared/useReferentialDelete.ts';
import type { Insumo } from '../types.ts';

/** Tab de insumos (materiales del catálogo): costo unitario, categoría y origen; los 'Preparado en obra' eligen su APU (Análisis de Precios Unitarios) básico como fuente de precio. */
export function InsumosTab() {
  const { state, patch, apusBasicoCalc } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) =>
      state.apus.reduce((n, a) => n + a.recursos_ins.filter((r) => r.insumo_id === id).length, 0);
  }, [state.apus]);
  const tryDelete = useReferentialDelete(countUsage, 'APU(s)');

  const apusBasico = useMemo(() => state.apus.filter((a) => a.es_basico), [state.apus]);
  const apusBasicoCalcMap = useMemo(
    () => new Map(apusBasicoCalc.map((a) => [a.id, a])),
    [apusBasicoCalc],
  );

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, del, handleKeyDown, excel } =
    useCrudTable<Insumo>({
      items: state.insumos,
      onChange: (insumos) => patch({ insumos }),
      prefix: 'IN',
      defaultItem: () => ({
        id: crypto.randomUUID(),
        codigo: genCodeFor(state.insumos, 'IN'),
        nombre: 'Nuevo insumo',
        unidad: 'un',
        origen: state.config_listas.origenes[0]?.nombre ?? 'Local',
        categoria: state.config_listas.categorias_insumo[0]?.nombre ?? '',
        subcategoria: '',
        marca_referencia: '',
        costo_unitario: 0,
        fecha_cotizacion: '',
        apu_basico_id: '',
        proveedor_id: '',
      }),
      searchKeys: ['codigo', 'nombre', 'categoria'],
      confirmDel: '¿Eliminar este insumo?',
      tryDelete,
      excelConfig: {
        title: 'Insumos',
        sheetName: 'Insumos',
        filename: 'insumos_civilmanager.xlsx',
        headers: ['Código', 'Nombre', 'Unidad', 'Categoría', 'Costo Unitario', 'Fecha Cotización'],
        colWidths: [{ wch: 12 }, { wch: 32 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }],
        mapRow: (x) => [
          x.codigo,
          x.nombre,
          x.unidad,
          x.categoria,
          x.costo_unitario,
          x.fecha_cotizacion,
        ],
        parseRow: (row) => row,
        buildItem: (row, idx, existing, nextCode) => ({
          id: idx >= 0 ? existing[idx].id : crypto.randomUUID(),
          codigo: String(row[0] || nextCode()),
          nombre: String(row[1] || ''),
          unidad: String(row[2] || 'un'),
          origen: idx >= 0 ? existing[idx].origen : 'Local',
          categoria: String(row[3] || ''),
          subcategoria: idx >= 0 ? existing[idx].subcategoria : '',
          marca_referencia: idx >= 0 ? existing[idx].marca_referencia : '',
          costo_unitario: Number(row[4]) || 0,
          fecha_cotizacion: String(row[5] || ''),
          apu_basico_id: idx >= 0 ? existing[idx].apu_basico_id : '',
          proveedor_id: idx >= 0 ? existing[idx].proveedor_id : '',
        }),
      },
    });

  /** Columnas de la grilla: Código y Cotizado son informativos; el resto abre edición con doble clic. */
  const columns: CrudColumn<Insumo>[] = [
    {
      label: 'Código',
      title: 'Código único del insumo (IN-xxx), generado automáticamente.',
      render: (x) => x.codigo,
    },
    {
      label: 'Nombre',
      title: 'Nombre comercial o descripción del material.',
      render: (x, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={x.nombre}
          onCommit={(v) => ctx.upd(x.id, 'nombre', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Nombre"
        />
      ),
    },
    {
      label: 'Unidad',
      title: 'Unidad de medida del insumo (lista editable en Configuración).',
      render: (x, edit, ctx) => (
        <EditableCell
          editing={edit}
          tipo="select"
          value={x.unidad}
          opciones={state.config_listas.unidades.map((u) => ({
            value: u.abreviatura,
            label: u.abreviatura,
          }))}
          onCommit={(v) => ctx.upd(x.id, 'unidad', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Unidad"
        />
      ),
    },
    {
      label: 'Origen',
      title: 'Local, Nacional o Preparado en obra; si es preparado, el costo viene del APU básico.',
      render: (x, edit, ctx) => (
        <EditableCell
          editing={edit}
          tipo="select"
          value={x.origen}
          opciones={state.config_listas.origenes.map((o) => {
            const nombre = o.nombre ?? '';
            return { value: nombre, label: nombre };
          })}
          onCommit={(v) => ctx.upd(x.id, 'origen', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Origen"
        />
      ),
    },
    {
      label: 'Costo Unitario',
      title: 'Precio de compra del insumo; se reparte según el consumo en el APU.',
      // Escape hatch: si es 'Preparado en obra' el costo es derivado del APU básico (se muestra
      // en solo lectura y la edición real es el select del APU); si no, es moneda editable.
      render: (x, edit, ctx) => {
        if (x.origen === 'Preparado en obra') {
          if (edit) {
            return (
              <EditableCell
                editing
                tipo="select"
                value={x.apu_basico_id}
                opciones={[
                  { value: '', label: '— seleccionar APU básico —' },
                  ...apusBasico.map((a) => ({ value: a.id, label: a.nombre })),
                ]}
                onCommit={(v) => ctx.upd(x.id, 'apu_basico_id', v)}
                onKeyDown={ctx.handleKeyDown}
                title="APU básico"
              />
            );
          }
          const costoDerivado = apusBasicoCalcMap.get(x.apu_basico_id)?.costo_unitario ?? 0;
          return (
            <span onDoubleClick={ctx.editRow} title="APU básico">
              {fmtMoneda(costoDerivado)}
            </span>
          );
        }
        return (
          <EditableCell
            editing={edit}
            tipo="moneda"
            value={String(x.costo_unitario)}
            onCommit={(v) => ctx.upd(x.id, 'costo_unitario', Number(v) || 0)}
            onOpenEdit={ctx.editRow}
            onKeyDown={ctx.handleKeyDown}
            title="Costo Unitario"
          />
        );
      },
    },
    {
      label: 'Cotizado',
      title: 'Fecha de la última cotización; se resalta cuando está desactualizada.',
      // Solo lectura (la fecha no se edita aquí); el color de alerta lo lleva el span exterior
      // porque el input no hereda color.
      render: (x, edit, ctx) => (
        <span style={{ color: isCotOld(x.fecha_cotizacion) ? 'var(--warn)' : undefined }}>
          <EditableCell
            editing={edit}
            value={fmtDate(x.fecha_cotizacion)}
            onCommit={() => {}}
            readOnly
            onOpenEdit={ctx.editRow}
            onKeyDown={ctx.handleKeyDown}
            title="Cotizado"
          />
        </span>
      ),
    },
  ];

  return (
    <EditableSection dim={false}>
      <CrudTable
        title="Insumos"
        icon="insumos_tabla"
        columns={columns}
        items={filtered}
        editIdx={editIdx}
        setEditIdx={setEditIdx}
        del={del}
        upd={upd}
        handleKeyDown={handleKeyDown}
        onAdd={add}
        addLabel="Nuevo Insumo"
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }}
        excel={excel}
        exportLabel="Exportar"
        emptyLabel="Sin insumos"
      />
      <ExcelPreviewModal excel={excel} />
    </EditableSection>
  );
}
