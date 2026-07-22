import { useState } from 'react';
import { useCivilManager } from '../context';
import { genCodeFor } from '../codeGen';
import { askConfirm } from '../shared/ConfirmDialog';
import { NumInput } from '../shared/NumInput';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import { FP_CAT_DESC_DEFAULTS } from '../seedData';
import type { FactorPrestacional } from '../types';

const TIPOS: FactorPrestacional['tipo'][] = ['prestaciones', 'seguridad_social', 'parafiscales', 'otros'];
const TIPO_LABEL: Record<FactorPrestacional['tipo'], string> = {
  prestaciones: 'Prestaciones sociales',
  seguridad_social: 'Seguridad social',
  parafiscales: 'Parafiscales',
  otros: 'Otros',
};

export function FactorPrestacionalPanel() {
  const { state, patch, factorPrest } = useCivilManager();
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const items = state.factoresPrestaciones;

  function setItems(next: FactorPrestacional[]) {
    patch({ factoresPrestaciones: next });
  }

  function add(tipo: FactorPrestacional['tipo']) {
    const nuevo: FactorPrestacional = { id: crypto.randomUUID(), codigo: genCodeFor(items, 'FP'), nombre: 'Nuevo factor', factor: 0, tipo };
    setItems([...items, nuevo]);
    setEditIdx(items.length);
  }

  function upd(i: number, k: keyof FactorPrestacional, v: string | number) {
    const n = [...items];
    n[i] = { ...n[i], [k]: v };
    setItems(n);
  }

  async function del(i: number) {
    if (!(await askConfirm(`¿Eliminar "${items[i].nombre}"?`))) return;
    if (editIdx === i) setEditIdx(null);
    setItems(items.filter((_, j) => j !== i));
  }

  return (
    <div>
      {TIPOS.map(tipo => {
        const grupo = items.map((f, i) => ({ f, i })).filter(({ f }) => f.tipo === tipo);
        const subtotal = grupo.reduce((s, { f }) => s + (Number(f.factor) || 0), 0);
        return (
          <XlWrap key={tipo}>
            <div className="cm-modal-head">
              {TIPO_LABEL[tipo]} <span style={{ fontWeight: 400, color: 'var(--txt2)' }}>— {FP_CAT_DESC_DEFAULTS[tipo]}</span>
            </div>
            <XlScroll>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Factor %</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.length === 0 && <tr><td colSpan={5} className="cm-empty-row">Sin registros</td></tr>}
                  {grupo.map(({ f, i }, gi) => {
                    const editing = editIdx === i;
                    return (
                      <tr key={f.id}>
                        <XlRowNum n={gi + 1} />
                        <td>{f.codigo}</td>
                        <td>
                          {editing ? (
                            <input className="cm-ni" aria-label="Nombre" value={f.nombre} onChange={e => upd(i, 'nombre', e.target.value)} />
                          ) : (
                            <span onDoubleClick={() => setEditIdx(i)}>{f.nombre}</span>
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <NumInput value={f.factor} decimals={2} onChange={v => upd(i, 'factor', v)} />
                          ) : (
                            <span onDoubleClick={() => setEditIdx(i)}>{Number(f.factor).toFixed(2)}%</span>
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
              <button type="button" className="cm-btn cm-btn-ok" onClick={() => add(tipo)}>Agregar</button>
              <span className="cm-flex-1" />
              <span style={{ fontSize: 11 }}>Subtotal: <b>{subtotal.toFixed(2)}%</b></span>
            </div>
          </XlWrap>
        );
      })}
      <div style={{ fontSize: 13, fontWeight: 700, padding: '8px 4px' }}>
        Factor prestacional total: <span style={{ color: 'var(--acc)' }}>{factorPrest.toFixed(2)}%</span>
      </div>
    </div>
  );
}
