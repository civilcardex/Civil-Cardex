import { useCivilManager } from '../context';
import { fmt, parseNum } from '../calc';
import { NumInput } from '../shared/NumInput';
import { ActionIcon } from '../shared/icons';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Apu, ApuRecursoEquipo } from '../types';

interface Props {
  apu: Apu;
  onChange: (recursos_eq: ApuRecursoEquipo[]) => void;
}

export function ApuSeccionEquipo({ apu, onChange }: Props) {
  const { state } = useCivilManager();
  const eqMap = new Map(state.equipos.map(e => [e.id, e]));

  function add() {
    if (!state.equipos.length) return;
    onChange([...apu.recursos_eq, { equipo_id: state.equipos[0].id, rendimiento: 1 }]);
  }

  function upd(i: number, k: keyof ApuRecursoEquipo, v: string | number) {
    const n = [...apu.recursos_eq];
    n[i] = { ...n[i], [k]: v };
    onChange(n);
  }

  function del(i: number) {
    onChange(apu.recursos_eq.filter((_, j) => j !== i));
  }

  const subtotal = apu.recursos_eq.reduce((s, r) => {
    const eq = eqMap.get(r.equipo_id);
    return s + (eq ? parseNum(eq.costo_hora) * parseNum(r.rendimiento) : 0);
  }, 0);

  return (
    <XlWrap>
      <div className="cm-modal-head">B. Equipo</div>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Equipo</th>
              <th>Rendimiento</th>
              <th>Costo/Hora</th>
              <th>Subtotal</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {apu.recursos_eq.length === 0 && <tr><td colSpan={6} className="cm-empty-row">Sin recursos de equipo</td></tr>}
            {apu.recursos_eq.map((r, i) => {
              const eq = eqMap.get(r.equipo_id);
              return (
                <tr key={i}>
                  <XlRowNum n={i + 1} />
                  <td>
                    <select className="cm-sel" value={r.equipo_id} onChange={e => upd(i, 'equipo_id', e.target.value)} aria-label="Equipo">
                      {state.equipos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </td>
                  <td><NumInput value={r.rendimiento} decimals={4} onChange={v => upd(i, 'rendimiento', v)} /></td>
                  <td>{fmt(eq?.costo_hora ?? 0)}</td>
                  <td>{fmt((eq?.costo_hora ?? 0) * (Number(r.rendimiento) || 0))}</td>
                  <td className="cm-col-act">
                    <button type="button" className="cm-btn-icon" onClick={() => del(i)} aria-label="Eliminar recurso">
                      <ActionIcon name="delete" label="Eliminar recurso" color="var(--err)" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </XlScroll>
      <div className="cm-xl-foot">
        <button type="button" className="cm-btn cm-btn-ok" onClick={add}>Agregar Recurso</button>
        <span className="cm-flex-1" />
        <span style={{ fontSize: 11 }}>Subtotal Equipo: <b>{fmt(subtotal)}</b></span>
      </div>
    </XlWrap>
  );
}
