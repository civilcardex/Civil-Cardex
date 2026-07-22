import { useMemo } from 'react';
import { useCivilManager } from '../context';
import { genCodeFor } from '../codeGen';
import { fmt } from '../calc';
import { CrudFooter } from '../shared/CrudFooter';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal';
import { NumInput } from '../shared/NumInput';
import { useCrudTable } from '../shared/useCrudTable';
import { useReferentialDelete } from '../shared/useReferentialDelete';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Cargo } from '../types';

export function ColaboradoresTab() {
  const { state, patch, cargosCalc } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) => {
      const enCuadrillas = state.cuadrillas.reduce((n, c) => n + c.integrantes.filter(i => i.cargo_id === id).length, 0);
      const enApus = state.apus.reduce((n, a) => n + a.recursos_mo.filter(r => r.cargo_id === id).length, 0);
      return enCuadrillas + enApus;
    };
  }, [state.cuadrillas, state.apus]);
  const tryDelete = useReferentialDelete(countUsage, 'referencia(s) en cuadrillas/APU');

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, handleKeyDown, excel } = useCrudTable<Cargo>({
    items: state.cargos,
    onChange: cargos => patch({ cargos }),
    prefix: 'MO',
    defaultItem: () => ({ id: crypto.randomUUID(), codigo: genCodeFor(state.cargos, 'MO'), descripcion: 'Nuevo cargo', num_salarios_base: 1 }),
    searchKeys: ['codigo', 'descripcion'],
    confirmDel: '¿Eliminar este colaborador?',
    excelConfig: {
      title: 'Colaboradores',
      sheetName: 'Colaboradores',
      filename: 'colaboradores_civilmanager.xlsx',
      headers: ['Código', 'Descripción', 'N° Salarios Base'],
      colWidths: [{ wch: 12 }, { wch: 36 }, { wch: 16 }],
      mapRow: c => [c.codigo, c.descripcion, c.num_salarios_base],
      parseRow: row => row,
      buildItem: (row, idx, existing, nextCode) => ({
        id: idx >= 0 ? existing[idx].id : crypto.randomUUID(),
        codigo: String(row[0] || nextCode()),
        descripcion: String(row[1] || ''),
        num_salarios_base: Number(row[2]) || 1,
      }),
    },
  });

  const calcMap = useMemo(() => new Map(cargosCalc.map(c => [c.id, c])), [cargosCalc]);

  function del(i: number) {
    const item = filtered[i];
    const realIdx = state.cargos.findIndex(c => c.id === item.id);
    tryDelete(item.id, () => patch({ cargos: state.cargos.filter((_, j) => j !== realIdx) }), '¿Eliminar este colaborador?');
  }

  return (
    <div>
      <XlWrap>
        <XlScroll>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>N° Salarios Base</th>
                <th>Valor Básico</th>
                <th>Costo Total Día</th>
                <th>Costo Total Hora</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="cm-empty-row">Sin colaboradores</td></tr>
              )}
              {filtered.map((c, i) => {
                const calc = calcMap.get(c.id);
                const editing = editIdx === i;
                return (
                  <tr key={c.id}>
                    <XlRowNum n={i + 1} />
                    <td>{c.codigo}</td>
                    <td>
                      {editing ? (
                        <input className="cm-ni" aria-label="Descripción" value={c.descripcion} onChange={e => upd(i, 'descripcion', e.target.value)} onKeyDown={e => handleKeyDown(i, e)} />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{c.descripcion}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <NumInput value={c.num_salarios_base} decimals={2} onChange={v => upd(i, 'num_salarios_base', v)} />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{fmt(c.num_salarios_base)}</span>
                      )}
                    </td>
                    <td>{fmt(calc?.valorBasico ?? 0)}</td>
                    <td>{fmt(calc?.costo_total_dia ?? 0)}</td>
                    <td>{fmt(calc?.costo_total_hora ?? 0)}</td>
                    <XlAct onEdit={() => setEditIdx(editing ? null : i)} onDelete={() => del(i)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </XlScroll>
        <CrudFooter
          onAdd={add}
          addLabel="Nuevo Colaborador"
          excel={excel}
          exportLabel="Exportar"
          search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }}
          countLabel="Total:"
          count={filtered.length}
        />
      </XlWrap>
      <ExcelPreviewModal excel={excel} />
    </div>
  );
}
