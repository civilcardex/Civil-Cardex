import { useMemo } from 'react';
import { useCivilManager } from '../context';
import { genCodeFor } from '../codeGen';
import { fmt } from '../calc';
import { fmtDate, isCotOld } from '../excelImport';
import { CrudFooter } from '../shared/CrudFooter';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal';
import { NumInput } from '../shared/NumInput';
import { useCrudTable } from '../shared/useCrudTable';
import { useReferentialDelete } from '../shared/useReferentialDelete';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Equipo } from '../types';

export function EquiposTab() {
  const { state, patch } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) => state.apus.reduce((n, a) => n + a.recursos_eq.filter(r => r.equipo_id === id).length + a.recursos_transporte.filter(r => r.equipo_id === id).length, 0);
  }, [state.apus]);
  const tryDelete = useReferentialDelete(countUsage, 'APU(s)');

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, handleKeyDown, excel } = useCrudTable<Equipo>({
    items: state.equipos,
    onChange: equipos => patch({ equipos }),
    prefix: 'EQ',
    defaultItem: () => ({ id: crypto.randomUUID(), codigo: genCodeFor(state.equipos, 'EQ'), nombre: 'Nuevo equipo', tipo: state.config_listas.tipos_equipo[0]?.nombre ?? '', unidad: 'hr', costo_hora: 0, fecha_cotizacion: '', proveedor_id: '' }),
    searchKeys: ['codigo', 'nombre', 'tipo'],
    confirmDel: '¿Eliminar este equipo?',
    excelConfig: {
      title: 'Equipos',
      sheetName: 'Equipos',
      filename: 'equipos_civilmanager.xlsx',
      headers: ['Código', 'Nombre', 'Tipo', 'Costo/Hora', 'Fecha Cotización'],
      colWidths: [{ wch: 12 }, { wch: 32 }, { wch: 20 }, { wch: 14 }, { wch: 16 }],
      mapRow: e => [e.codigo, e.nombre, e.tipo, e.costo_hora, e.fecha_cotizacion],
      parseRow: row => row,
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

  function del(i: number) {
    const item = filtered[i];
    const realIdx = state.equipos.findIndex(e => e.id === item.id);
    tryDelete(item.id, () => patch({ equipos: state.equipos.filter((_, j) => j !== realIdx) }), '¿Eliminar este equipo?');
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
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Costo/Hora</th>
                <th>Cotizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="cm-empty-row">Sin equipos</td></tr>}
              {filtered.map((e, i) => {
                const editing = editIdx === i;
                const old = isCotOld(e.fecha_cotizacion);
                return (
                  <tr key={e.id}>
                    <XlRowNum n={i + 1} />
                    <td>{e.codigo}</td>
                    <td>
                      {editing ? (
                        <input className="cm-ni" aria-label="Nombre" value={e.nombre} onChange={ev => upd(i, 'nombre', ev.target.value)} onKeyDown={ev => handleKeyDown(i, ev)} />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{e.nombre}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <select className="cm-sel" aria-label="Tipo" value={e.tipo} onChange={ev => upd(i, 'tipo', ev.target.value)}>
                          {state.config_listas.tipos_equipo.map(t => <option key={t.codigo} value={t.nombre}>{t.nombre}</option>)}
                        </select>
                      ) : e.tipo}
                    </td>
                    <td>
                      {editing ? (
                        <NumInput value={e.costo_hora} format onChange={v => upd(i, 'costo_hora', v)} />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{fmt(e.costo_hora)}</span>
                      )}
                    </td>
                    <td style={{ color: old ? 'var(--warn)' : undefined }}>{fmtDate(e.fecha_cotizacion)}</td>
                    <XlAct onEdit={() => setEditIdx(editing ? null : i)} onDelete={() => del(i)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </XlScroll>
        <CrudFooter
          onAdd={add}
          addLabel="Nuevo Equipo"
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
