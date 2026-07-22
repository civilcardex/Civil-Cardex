import { useMemo, useState } from 'react';
import { useCivilManager } from '../context';
import { calcCuadrillaCost, fmt } from '../calc';
import { genCodeFor } from '../codeGen';
import { CrudFooter } from '../shared/CrudFooter';
import { NumInput } from '../shared/NumInput';
import { askConfirm } from '../shared/ConfirmDialog';
import { ActionIcon } from '../shared/icons';
import { XlAct, XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Cuadrilla, CuadrillaIntegrante } from '../types';

export function CuadrillasTab() {
  const { state, patch, cargosCalc, esHora } = useCivilManager();
  const [selIdx, setSelIdx] = useState<number | null>(state.cuadrillas.length ? 0 : null);
  const [search, setSearch] = useState('');

  const cargoMap = useMemo(() => new Map(cargosCalc.map(c => [c.id, c])), [cargosCalc]);

  const filtered = search
    ? state.cuadrillas.filter(c => (c.codigo + c.descripcion).toLowerCase().includes(search.toLowerCase()))
    : state.cuadrillas;

  function setCuadrillas(next: Cuadrilla[]) {
    patch({ cuadrillas: next });
  }

  function addCuadrilla() {
    const nueva: Cuadrilla = { id: crypto.randomUUID(), codigo: genCodeFor(state.cuadrillas, 'CU'), descripcion: 'Nueva cuadrilla', integrantes: [] };
    setCuadrillas([...state.cuadrillas, nueva]);
    setSelIdx(state.cuadrillas.length);
  }

  async function delCuadrilla(id: string) {
    if (!(await askConfirm('¿Eliminar esta cuadrilla?'))) return;
    const idx = state.cuadrillas.findIndex(c => c.id === id);
    setCuadrillas(state.cuadrillas.filter(c => c.id !== id));
    if (selIdx === idx) setSelIdx(null);
  }

  const sel = selIdx !== null ? filtered[selIdx] : null;
  const selRealIdx = sel ? state.cuadrillas.findIndex(c => c.id === sel.id) : -1;

  function updSel(patchObj: Partial<Cuadrilla>) {
    if (selRealIdx < 0) return;
    const next = [...state.cuadrillas];
    next[selRealIdx] = { ...next[selRealIdx], ...patchObj };
    setCuadrillas(next);
  }

  function addIntegrante() {
    if (!sel || !cargosCalc.length) return;
    const nuevo: CuadrillaIntegrante = { id: crypto.randomUUID(), cargo_id: cargosCalc[0].id, cantidad: 1 };
    updSel({ integrantes: [...sel.integrantes, nuevo] });
  }

  function updIntegrante(i: number, k: keyof CuadrillaIntegrante, v: string | number) {
    if (!sel) return;
    const next = [...sel.integrantes];
    next[i] = { ...next[i], [k]: v };
    updSel({ integrantes: next });
  }

  function delIntegrante(i: number) {
    if (!sel) return;
    updSel({ integrantes: sel.integrantes.filter((_, j) => j !== i) });
  }

  const cost = sel ? calcCuadrillaCost(sel, cargoMap, state.config.dias_mes, state.config.horas_mes, esHora) : null;

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      <XlWrap>
        <XlScroll>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>Integrantes</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="cm-empty-row">Sin cuadrillas</td></tr>}
              {filtered.map((c, i) => (
                <tr key={c.id} onClick={() => setSelIdx(i)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelIdx(i); } }} style={{ cursor: 'pointer', background: selIdx === i ? 'rgba(37,99,235,.12)' : undefined }}>
                  <XlRowNum n={i + 1} />
                  <td>{c.codigo}</td>
                  <td>{c.descripcion}</td>
                  <td>{c.integrantes.length}</td>
                  <XlAct onEdit={() => setSelIdx(i)} onDelete={() => delCuadrilla(c.id)} />
                </tr>
              ))}
            </tbody>
          </table>
        </XlScroll>
        <CrudFooter onAdd={addCuadrilla} addLabel="Nueva Cuadrilla" search={{ value: search, onChange: setSearch, placeholder: 'Buscar…' }} countLabel="Total:" count={filtered.length} />
      </XlWrap>

      {sel && (
        <XlWrap>
          <div style={{ padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
            <input className="cm-ni" style={{ maxWidth: 240 }} value={sel.descripcion} onChange={e => updSel({ descripcion: e.target.value })} aria-label="Nombre de la cuadrilla" />
            <span className="cm-flex-1" />
            <span style={{ fontSize: 11, color: 'var(--txt2)' }}>Costo/día: <b>{fmt(cost?.costoDia ?? 0)}</b> · Costo/hora: <b>{fmt(cost?.costoHora ?? 0)}</b></span>
          </div>
          <XlScroll>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cargo</th>
                  <th>Cantidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sel.integrantes.length === 0 && <tr><td colSpan={4} className="cm-empty-row">Sin integrantes</td></tr>}
                {sel.integrantes.map((int, i) => (
                  <tr key={int.id}>
                    <XlRowNum n={i + 1} />
                    <td>
                      <select className="cm-sel" value={int.cargo_id} onChange={e => updIntegrante(i, 'cargo_id', e.target.value)} aria-label="Cargo">
                        {cargosCalc.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
                      </select>
                    </td>
                    <td>
                      <NumInput value={int.cantidad} decimals={2} onChange={v => updIntegrante(i, 'cantidad', v)} />
                    </td>
                    <td className="cm-col-act">
                      <button type="button" className="cm-btn-icon" onClick={() => delIntegrante(i)} aria-label="Eliminar integrante">
                        <ActionIcon name="delete" label="Eliminar integrante" color="var(--err)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </XlScroll>
          <CrudFooter onAdd={addIntegrante} addLabel="Agregar Integrante" countLabel="Integrantes:" count={sel.integrantes.length} />
        </XlWrap>
      )}
    </div>
  );
}
