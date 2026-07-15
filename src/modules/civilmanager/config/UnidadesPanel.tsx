import { useState } from 'react';
import { useCivilManager } from '../context';
import { askConfirm } from '../shared/ConfirmDialog';
import { showToast } from '../shared/Toast';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import { TIPOS_UNIDAD_PRE } from '../seedData';
import type { UnidadMedida } from '../types';

export function UnidadesPanel() {
  const { state, patch } = useCivilManager();
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const items = state.config_listas.unidades;

  function setItems(next: UnidadMedida[]) {
    patch({ config_listas: { ...state.config_listas, unidades: next } });
  }

  function add() {
    setItems([...items, { abreviatura: 'un', descripcion: 'Nueva unidad', tipo: 'General' }]);
    setEditIdx(items.length);
  }

  function upd(i: number, k: keyof UnidadMedida, v: string) {
    const n = [...items];
    n[i] = { ...n[i], [k]: v };
    setItems(n);
  }

  async function del(i: number) {
    const u = items[i];
    const enUso = state.insumos.some(x => x.unidad === u.abreviatura) || state.apus.some(a => a.unidad === u.abreviatura);
    if (enUso) {
      showToast('No se puede eliminar: unidad en uso por insumos o APU', { type: 'err' });
      return;
    }
    if (!(await askConfirm(`¿Eliminar la unidad "${u.abreviatura}"?`))) return;
    if (editIdx === i) setEditIdx(null);
    setItems(items.filter((_, j) => j !== i));
  }

  return (
    <XlWrap>
      <div className="cm-modal-head">Unidades de Medida</div>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Abreviatura</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="cm-empty-row">Sin unidades</td></tr>}
            {items.map((u, i) => {
              const editing = editIdx === i;
              return (
                <tr key={u.abreviatura + i}>
                  <XlRowNum n={i + 1} />
                  <td>{editing ? <input className="cm-ni" value={u.abreviatura} onChange={e => upd(i, 'abreviatura', e.target.value)} /> : u.abreviatura}</td>
                  <td>
                    {editing ? (
                      <input className="cm-ni" value={u.descripcion} onChange={e => upd(i, 'descripcion', e.target.value)} />
                    ) : (
                      <span onDoubleClick={() => setEditIdx(i)}>{u.descripcion}</span>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <select className="cm-sel" value={u.tipo} onChange={e => upd(i, 'tipo', e.target.value)}>
                        {TIPOS_UNIDAD_PRE.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : u.tipo}
                  </td>
                  <XlAct onEdit={() => setEditIdx(editing ? null : i)} onDelete={() => del(i)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </XlScroll>
      <div className="cm-xl-foot">
        <button type="button" className="cm-btn cm-btn-ok" onClick={add}>Agregar</button>
        <span className="cm-flex-1" />
        <span style={{ fontSize: 11 }}>Total: <b>{items.length}</b></span>
      </div>
    </XlWrap>
  );
}
