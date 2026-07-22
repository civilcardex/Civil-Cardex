import { useMemo } from 'react';
import { useCivilManager } from '../context';
import { genCodeFor } from '../codeGen';
import { CrudFooter } from '../shared/CrudFooter';
import { ExcelPreviewModal } from '../shared/ExcelPreviewModal';
import { useCrudTable } from '../shared/useCrudTable';
import { useReferentialDelete } from '../shared/useReferentialDelete';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Proveedor } from '../types';

export function ProveedoresTab() {
  const { state, patch } = useCivilManager();

  const countUsage = useMemo(() => {
    return (id: string) => state.equipos.filter(e => e.proveedor_id === id).length + state.insumos.filter(x => x.proveedor_id === id).length;
  }, [state.equipos, state.insumos]);
  const tryDelete = useReferentialDelete(countUsage, 'equipo(s)/insumo(s)');

  const { filtered, editIdx, setEditIdx, search, setSearch, upd, add, handleKeyDown, excel } = useCrudTable<Proveedor>({
    items: state.proveedores,
    onChange: proveedores => patch({ proveedores }),
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
    excelConfig: {
      title: 'Proveedores',
      sheetName: 'Proveedores',
      filename: 'proveedores_civilmanager.xlsx',
      headers: ['Código', 'Nombre', 'NIT', 'Contacto', 'Teléfono', 'Ciudad'],
      colWidths: [{ wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 16 }],
      mapRow: p => [p.codigo, p.nombre, p.nit, p.contacto, p.tel1, p.ciudad],
      parseRow: row => row,
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

  function del(i: number) {
    const item = filtered[i];
    const realIdx = state.proveedores.findIndex(p => p.id === item.id);
    tryDelete(item.id, () => patch({ proveedores: state.proveedores.filter((_, j) => j !== realIdx) }), '¿Eliminar este proveedor?');
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
                <th>NIT</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="cm-empty-row">Sin proveedores</td></tr>}
              {filtered.map((p, i) => {
                const editing = editIdx === i;
                return (
                  <tr key={p.id}>
                    <XlRowNum n={i + 1} />
                    <td>{p.codigo}</td>
                    <td>
                      {editing ? (
                        <input className="cm-ni" aria-label="Nombre" value={p.nombre} onChange={e => upd(i, 'nombre', e.target.value)} onKeyDown={e => handleKeyDown(i, e)} />
                      ) : (
                        <span onDoubleClick={() => setEditIdx(i)}>{p.nombre}</span>
                      )}
                    </td>
                    <td>
                      {editing ? <input className="cm-ni" aria-label="NIT" value={p.nit} onChange={e => upd(i, 'nit', e.target.value)} /> : p.nit}
                    </td>
                    <td>
                      {editing ? <input className="cm-ni" aria-label="Contacto" value={p.contacto} onChange={e => upd(i, 'contacto', e.target.value)} /> : p.contacto}
                    </td>
                    <td>
                      {editing ? <input className="cm-ni" aria-label="Teléfono" value={p.tel1} onChange={e => upd(i, 'tel1', e.target.value)} /> : p.tel1}
                    </td>
                    <td>
                      {editing ? <input className="cm-ni" aria-label="Ciudad" value={p.ciudad} onChange={e => upd(i, 'ciudad', e.target.value)} /> : p.ciudad}
                    </td>
                    <XlAct onEdit={() => setEditIdx(editing ? null : i)} onDelete={() => del(i)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </XlScroll>
        <CrudFooter
          onAdd={add}
          addLabel="Nuevo Proveedor"
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
