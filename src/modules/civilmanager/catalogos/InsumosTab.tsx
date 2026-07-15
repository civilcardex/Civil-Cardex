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
import type { Insumo } from '../types';

export function InsumosTab() {
  const { state, patch, apusBasicoCalc } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) => state.apus.reduce((n, a) => n + a.recursos_ins.filter(r => r.insumo_id === id).length, 0);
  }, [state.apus]);
  const tryDelete = useReferentialDelete(countUsage, 'APU(s)');

  const apusBasico = useMemo(() => state.apus.filter(a => a.es_basico), [state.apus]);
  const apusBasicoCalcMap = useMemo(() => new Map(apusBasicoCalc.map(a => [a.id, a])), [apusBasicoCalc]);

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, handleKeyDown, excel } = useCrudTable<Insumo>({
    items: state.insumos,
    onChange: insumos => patch({ insumos }),
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
    excelConfig: {
      title: 'Insumos',
      sheetName: 'Insumos',
      filename: 'insumos_civilmanager.xlsx',
      headers: ['Código', 'Nombre', 'Unidad', 'Categoría', 'Costo Unitario', 'Fecha Cotización'],
      colWidths: [{ wch: 12 }, { wch: 32 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }],
      mapRow: x => [x.codigo, x.nombre, x.unidad, x.categoria, x.costo_unitario, x.fecha_cotizacion],
      parseRow: row => row,
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

  function del(i: number) {
    const item = filtered[i];
    const realIdx = state.insumos.findIndex(x => x.id === item.id);
    tryDelete(item.id, () => patch({ insumos: state.insumos.filter((_, j) => j !== realIdx) }), '¿Eliminar este insumo?');
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
                <th>Unidad</th>
                <th>Origen</th>
                <th>Costo Unitario</th>
                <th>Cotizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="cm-empty-row">Sin insumos</td></tr>}
              {filtered.map((x, i) => {
                const editing = editIdx === i;
                const preparado = x.origen === 'Preparado en obra';
                const costoDerivado = preparado ? apusBasicoCalcMap.get(x.apu_basico_id)?.costo_unitario ?? 0 : x.costo_unitario;
                const old = isCotOld(x.fecha_cotizacion);
                return (
                  <tr key={x.id}>
                    <XlRowNum n={i + 1} />
                    <td>{x.codigo}</td>
                    <td>
                      {editing ? (
                        <input className="cm-ni" value={x.nombre} onChange={e => upd(i, 'nombre', e.target.value)} onKeyDown={e => handleKeyDown(i, e)} />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{x.nombre}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <select className="cm-sel" value={x.unidad} onChange={e => upd(i, 'unidad', e.target.value)}>
                          {state.config_listas.unidades.map(u => <option key={u.abreviatura} value={u.abreviatura}>{u.abreviatura}</option>)}
                        </select>
                      ) : x.unidad}
                    </td>
                    <td>
                      {editing ? (
                        <select className="cm-sel" value={x.origen} onChange={e => upd(i, 'origen', e.target.value)}>
                          {state.config_listas.origenes.map(o => <option key={o.codigo} value={o.nombre}>{o.nombre}</option>)}
                        </select>
                      ) : x.origen}
                    </td>
                    <td>
                      {preparado ? (
                        editing ? (
                          <select className="cm-sel" value={x.apu_basico_id} onChange={e => upd(i, 'apu_basico_id', e.target.value)}>
                            <option value="">— seleccionar APU básico —</option>
                            {apusBasico.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                          </select>
                        ) : (
                          fmt(costoDerivado)
                        )
                      ) : editing ? (
                        <NumInput value={x.costo_unitario} format onChange={v => upd(i, 'costo_unitario', v)} />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{fmt(x.costo_unitario)}</span>
                      )}
                    </td>
                    <td style={{ color: old ? 'var(--warn)' : undefined }}>{fmtDate(x.fecha_cotizacion)}</td>
                    <XlAct onEdit={() => setEditIdx(editing ? null : i)} onDelete={() => del(i)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </XlScroll>
        <CrudFooter
          onAdd={add}
          addLabel="Nuevo Insumo"
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
