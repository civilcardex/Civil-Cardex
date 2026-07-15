import { useState } from 'react';
import { genCodeFor } from '../codeGen';
import { askConfirm } from '../shared/ConfirmDialog';
import { showToast } from '../shared/Toast';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { ListaItem } from '../types';

interface Props {
  title: string;
  items: ListaItem[];
  onChange: (items: ListaItem[]) => void;
  prefix: string;
  labelField: 'nombre' | 'categoria';
  labelHeader: string;
  /** Recibe el valor de `labelField` (no el código) — las referencias cruzadas en este modelo usan el nombre. */
  countUsage?: (label: string) => number;
  usageLabel?: string;
}

/** Panel genérico para las listas de configuración con forma {codigo, nombre|categoria, desc}. */
export function ListaItemPanel({ title, items, onChange, prefix, labelField, labelHeader, countUsage, usageLabel }: Props) {
  const [editIdx, setEditIdx] = useState<number | null>(null);

  function add() {
    const nuevo: ListaItem = { codigo: genCodeFor(items, prefix), desc: '', [labelField]: 'Nuevo' } as ListaItem;
    onChange([...items, nuevo]);
    setEditIdx(items.length);
  }

  function upd(i: number, k: keyof ListaItem, v: string) {
    const n = [...items];
    n[i] = { ...n[i], [k]: v };
    onChange(n);
  }

  async function del(i: number) {
    const item = items[i];
    if (countUsage) {
      const count = countUsage(item[labelField] ?? '');
      if (count > 0) {
        showToast(`No se puede eliminar: usado en ${count} ${usageLabel ?? 'registro(s)'}`, { type: 'err' });
        return;
      }
    }
    if (!(await askConfirm(`¿Eliminar "${item[labelField]}"?`))) return;
    if (editIdx === i) setEditIdx(null);
    onChange(items.filter((_, j) => j !== i));
  }

  return (
    <XlWrap>
      <div className="cm-modal-head">{title}</div>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Código</th>
              <th>{labelHeader}</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={5} className="cm-empty-row">Sin registros</td></tr>}
            {items.map((it, i) => {
              const editing = editIdx === i;
              return (
                <tr key={it.codigo}>
                  <XlRowNum n={i + 1} />
                  <td>{it.codigo}</td>
                  <td>
                    {editing ? (
                      <input className="cm-ni" value={it[labelField] ?? ''} onChange={e => upd(i, labelField, e.target.value)} />
                    ) : (
                      <span onDoubleClick={() => setEditIdx(i)}>{it[labelField]}</span>
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <input className="cm-ni" value={it.desc} onChange={e => upd(i, 'desc', e.target.value)} />
                    ) : (
                      <span onDoubleClick={() => setEditIdx(i)} style={{ color: 'var(--txt2)' }}>{it.desc}</span>
                    )}
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
