import { useMemo } from 'react';
import { useCivilManager } from '../context.tsx';
import { genCodeFor } from '../codeGen.ts';
import { fmt, fmtMoneda } from '../calc.ts';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal.tsx';
import { NumInput } from '../shared/NumInput.tsx';
import { useCrudTable } from '../shared/useCrudTable.ts';
import { CrudTable, type CrudColumn } from '../shared/CrudTable.tsx';
import { EditableCell } from '../shared/EditableCell.tsx';
import { EditableSection } from '../shared/EditLock.tsx';
import { useReferentialDelete } from '../shared/useReferentialDelete.ts';
import type { Cargo } from '../types.ts';

/** Tab de cargos (colaboradores): plaza en salarios base y sus costos día/hora derivados. Ej: 'Contra maestro' 2.5 sb -> básico $3.500.000/mes. Bordea si el cargo es usado por alguna cuadrilla. */
export function ColaboradoresTab() {
  const { state, patch, cargosCalc } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) => {
      const enCuadrillas = state.cuadrillas.reduce(
        (n, c) => n + c.integrantes.filter((i) => i.cargo_id === id).length,
        0,
      );
      const enApus = state.apus.reduce(
        (n, a) => n + a.recursos_mo.filter((r) => r.cargo_id === id).length,
        0,
      );
      return enCuadrillas + enApus;
    };
  }, [state.cuadrillas, state.apus]);
  const tryDelete = useReferentialDelete(countUsage, 'referencia(s) en cuadrillas/APU');

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, del, handleKeyDown, excel } =
    useCrudTable<Cargo>({
      items: state.cargos,
      onChange: (cargos) => patch({ cargos }),
      prefix: 'MO',
      defaultItem: () => ({
        id: crypto.randomUUID(),
        codigo: genCodeFor(state.cargos, 'MO'),
        descripcion: 'Nuevo cargo',
        num_salarios_base: 1,
      }),
      searchKeys: ['codigo', 'descripcion'],
      confirmDel: '¿Eliminar este colaborador?',
      tryDelete,
      excelConfig: {
        title: 'Colaboradores',
        sheetName: 'Colaboradores',
        filename: 'colaboradores_civilmanager.xlsx',
        headers: ['Código', 'Descripción', 'N° Salarios Base'],
        colWidths: [{ wch: 12 }, { wch: 36 }, { wch: 16 }],
        mapRow: (c) => [c.codigo, c.descripcion, c.num_salarios_base],
        parseRow: (row) => row,
        buildItem: (row, idx, existing, nextCode) => ({
          id: idx >= 0 ? existing[idx].id : crypto.randomUUID(),
          codigo: String(row[0] || nextCode()),
          descripcion: String(row[1] || ''),
          num_salarios_base: Number(row[2]) || 1,
        }),
      },
    });

  const calcMap = useMemo(() => new Map(cargosCalc.map((c) => [c.id, c])), [cargosCalc]);

  /** Columnas de la grilla: Código y los costos derivados son informativos; el resto abre edición con doble clic. */
  const columns: CrudColumn<Cargo>[] = [
    {
      label: 'Código',
      title: 'Código único del cargo (MO-xxx), generado automáticamente.',
      render: (c) => c.codigo,
    },
    {
      label: 'Descripción',
      title: 'Nombre del cargo (ayudante, oficial, maestro…).',
      render: (c, edit, ctx) => (
        <EditableCell
          editing={edit}
          value={c.descripcion}
          onCommit={(v) => ctx.upd(c.id, 'descripcion', v)}
          onOpenEdit={ctx.editRow}
          onKeyDown={ctx.handleKeyDown}
          title="Descripción"
        />
      ),
    },
    {
      label: 'N° Salarios Base',
      title: 'Cuántos salarios mínimos gana este cargo.',
      // Escape hatch: NumInput con decimals=2, combo que EditableCell no cubre con 'numero'.
      render: (c, edit, ctx) =>
        edit ? (
          <NumInput
            value={c.num_salarios_base}
            decimals={2}
            onChange={(v) => ctx.upd(c.id, 'num_salarios_base', v)}
            onKeyDown={ctx.handleKeyDown}
            aria-label="N° Salarios Base"
            title="N° Salarios Base"
          />
        ) : (
          <span onDoubleClick={ctx.editRow} title="N° Salarios Base">
            {fmt(c.num_salarios_base)}
          </span>
        ),
    },
    {
      label: 'Valor Básico',
      title: 'Jornal del cargo = salarios base × salario del país activo.',
      render: (c) => fmtMoneda(calcMap.get(c.id)?.valorBasico ?? 0),
    },
    {
      label: 'Costo Total Día',
      title: 'Jornal + prestaciones y seguridad social (costo empresa por día).',
      render: (c) => fmtMoneda(calcMap.get(c.id)?.costo_total_dia ?? 0),
    },
    {
      label: 'Costo Total Hora',
      title: 'Costo día ÷ horas laboradas por día según el país activo.',
      render: (c) => fmtMoneda(calcMap.get(c.id)?.costo_total_hora ?? 0),
    },
  ];

  return (
    <EditableSection dim={false}>
      <CrudTable
        title="Colaboradores"
        icon="colaboradores_tabla"
        columns={columns}
        items={filtered}
        editIdx={editIdx}
        setEditIdx={setEditIdx}
        del={del}
        upd={upd}
        handleKeyDown={handleKeyDown}
        onAdd={add}
        addLabel="Nuevo Colaborador"
        search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }}
        excel={excel}
        exportLabel="Exportar"
        emptyLabel="Sin colaboradores"
      />
      <ExcelPreviewModal excel={excel} />
    </EditableSection>
  );
}
