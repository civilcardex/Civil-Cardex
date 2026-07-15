import { useCivilManager } from '../context';
import { fmt, parseNum } from '../calc';
import { NumInput } from '../shared/NumInput';
import { ActionIcon } from '../shared/icons';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Apu, ApuRecursoInsumo } from '../types';

interface Props {
  apu: Apu;
  onChange: (recursos_ins: ApuRecursoInsumo[]) => void;
}

export function ApuSeccionInsumos({ apu, onChange }: Props) {
  const { state, apusBasicoCalc } = useCivilManager();
  const insMap = new Map(state.insumos.map(x => [x.id, x]));
  const abMap = new Map(apusBasicoCalc.map(a => [a.id, a]));

  function add() {
    if (!state.insumos.length) return;
    onChange([...apu.recursos_ins, { insumo_id: state.insumos[0].id, consumo: 1, desperdicios_pct: 5 }]);
  }

  function upd(i: number, k: keyof ApuRecursoInsumo, v: string | number) {
    const n = [...apu.recursos_ins];
    n[i] = { ...n[i], [k]: v };
    onChange(n);
  }

  function del(i: number) {
    onChange(apu.recursos_ins.filter((_, j) => j !== i));
  }

  function costoUnitario(insumoId: string): number {
    const ins = insMap.get(insumoId);
    if (!ins) return 0;
    if (ins.origen === 'Preparado en obra') return abMap.get(ins.apu_basico_id)?.costo_unitario ?? 0;
    return ins.costo_unitario;
  }

  const subtotal = apu.recursos_ins.reduce((s, r) => {
    const costoU = costoUnitario(r.insumo_id);
    const consumo = parseNum(r.consumo) || 1;
    const desp = (parseNum(r.desperdicios_pct) || 5) / 100;
    return s + costoU * consumo * (1 + desp);
  }, 0);

  return (
    <XlWrap>
      <div className="cm-modal-head">C. Insumos</div>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Insumo</th>
              <th>Consumo</th>
              <th>Desperdicio %</th>
              <th>Costo Unit.</th>
              <th>Subtotal</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {apu.recursos_ins.length === 0 && <tr><td colSpan={7} className="cm-empty-row">Sin insumos</td></tr>}
            {apu.recursos_ins.map((r, i) => {
              const costoU = costoUnitario(r.insumo_id);
              const consumo = parseNum(r.consumo) || 1;
              const desp = (parseNum(r.desperdicios_pct) || 5) / 100;
              return (
                <tr key={i}>
                  <XlRowNum n={i + 1} />
                  <td>
                    <select className="cm-sel" value={r.insumo_id} onChange={e => upd(i, 'insumo_id', e.target.value)} aria-label="Insumo">
                      {state.insumos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  </td>
                  <td><NumInput value={r.consumo} decimals={4} onChange={v => upd(i, 'consumo', v)} /></td>
                  <td><NumInput value={r.desperdicios_pct} decimals={2} onChange={v => upd(i, 'desperdicios_pct', v)} /></td>
                  <td>{fmt(costoU)}</td>
                  <td>{fmt(costoU * consumo * (1 + desp))}</td>
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
        <button type="button" className="cm-btn cm-btn-ok" onClick={add}>Agregar Insumo</button>
        <span className="cm-flex-1" />
        <span style={{ fontSize: 11 }}>Subtotal Insumos: <b>{fmt(subtotal)}</b></span>
      </div>
    </XlWrap>
  );
}
