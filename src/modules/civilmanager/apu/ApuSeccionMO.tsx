import { useCivilManager } from '../context';
import { cargoJornal, fmt } from '../calc';
import { NumInput } from '../shared/NumInput';
import { ActionIcon } from '../shared/icons';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Apu, ApuRecursoMO } from '../types';

interface Props {
  apu: Apu;
  onChange: (recursos_mo: ApuRecursoMO[]) => void;
}

export function ApuSeccionMO({ apu, onChange }: Props) {
  const { cargosCalc, esHora, state } = useCivilManager();
  const usarFP = state.config.usar_fp_en_apu;
  const cargoMap = new Map(cargosCalc.map(c => [c.id, c]));

  function add() {
    if (!cargosCalc.length) return;
    onChange([...apu.recursos_mo, { id: crypto.randomUUID(), cargo_id: cargosCalc[0].id, cant_personas: 1, rendimiento: 1 }]);
  }

  function upd(i: number, k: keyof ApuRecursoMO, v: string | number) {
    const n = [...apu.recursos_mo];
    n[i] = { ...n[i], [k]: v };
    onChange(n);
  }

  function del(i: number) {
    onChange(apu.recursos_mo.filter((_, j) => j !== i));
  }

  const subtotal = apu.recursos_mo.reduce((s, r) => {
    const cargo = cargoMap.get(r.cargo_id);
    return s + cargoJornal(cargo, usarFP, esHora) * (Number(r.cant_personas) || 0) * (Number(r.rendimiento) || 0);
  }, 0);

  return (
    <XlWrap>
      <div className="cm-modal-head">A. Mano de Obra</div>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cargo</th>
              <th>Cant. Personas</th>
              <th>Rendimiento</th>
              <th>Jornal</th>
              <th>Subtotal</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {apu.recursos_mo.length === 0 && <tr><td colSpan={7} className="cm-empty-row">Sin recursos de mano de obra</td></tr>}
            {apu.recursos_mo.map((r, i) => {
              const cargo = cargoMap.get(r.cargo_id);
              const jornal = cargoJornal(cargo, usarFP, esHora);
              return (
                <tr key={r.id}>
                  <XlRowNum n={i + 1} />
                  <td>
                    <select className="cm-sel" value={r.cargo_id} onChange={e => upd(i, 'cargo_id', e.target.value)} aria-label="Cargo">
                      {cargosCalc.map(c => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
                    </select>
                  </td>
                  <td><NumInput value={r.cant_personas} decimals={2} onChange={v => upd(i, 'cant_personas', v)} /></td>
                  <td><NumInput value={r.rendimiento} decimals={4} onChange={v => upd(i, 'rendimiento', v)} /></td>
                  <td>{fmt(jornal)}</td>
                  <td>{fmt(jornal * (Number(r.cant_personas) || 0) * (Number(r.rendimiento) || 0))}</td>
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
        <span style={{ fontSize: 11 }}>Subtotal MO: <b>{fmt(subtotal)}</b></span>
      </div>
    </XlWrap>
  );
}
