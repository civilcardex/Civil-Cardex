import { useCivilManager } from '../context';
import { fmt, parseNum } from '../calc';
import { NumInput } from '../shared/NumInput';
import { ActionIcon } from '../shared/icons';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Apu, ApuRecursoTransporte } from '../types';

interface Props {
  apu: Apu;
  onChange: (recursos_transporte: ApuRecursoTransporte[]) => void;
}

export function ApuSeccionTransporte({ apu, onChange }: Props) {
  const { state } = useCivilManager();
  const unidades = state.config_listas.unidades_transporte;

  function add() {
    onChange([...apu.recursos_transporte, { unidad: unidades[0]?.nombre ?? 'Global', tarifa: 0, distancia_km: 0 }]);
  }

  function upd(i: number, k: keyof ApuRecursoTransporte, v: string | number) {
    const n = [...apu.recursos_transporte];
    n[i] = { ...n[i], [k]: v };
    onChange(n);
  }

  function del(i: number) {
    onChange(apu.recursos_transporte.filter((_, j) => j !== i));
  }

  function itemTotal(r: ApuRecursoTransporte): number {
    return r.unidad === 'Global' ? parseNum(r.tarifa) : parseNum(r.tarifa) * parseNum(r.distancia_km);
  }

  const subtotal = apu.recursos_transporte.reduce((s, r) => s + itemTotal(r), 0);

  return (
    <XlWrap>
      <div className="cm-modal-head">D. Transporte</div>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Unidad</th>
              <th>Tarifa</th>
              <th>Distancia (km)</th>
              <th>Subtotal</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {apu.recursos_transporte.length === 0 && <tr><td colSpan={6} className="cm-empty-row">Sin transporte</td></tr>}
            {apu.recursos_transporte.map((r, i) => {
              const esGlobal = r.unidad === 'Global';
              return (
                <tr key={i}>
                  <XlRowNum n={i + 1} />
                  <td>
                    <select className="cm-sel" value={r.unidad} onChange={e => upd(i, 'unidad', e.target.value)} aria-label="Unidad de transporte">
                      {unidades.map(u => <option key={u.codigo} value={u.nombre}>{u.nombre}</option>)}
                    </select>
                  </td>
                  <td><NumInput value={r.tarifa} format onChange={v => upd(i, 'tarifa', v)} /></td>
                  <td>
                    <NumInput value={r.distancia_km} decimals={2} onChange={v => upd(i, 'distancia_km', v)} disabled={esGlobal} />
                  </td>
                  <td>{fmt(itemTotal(r))}</td>
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
        <button type="button" className="cm-btn cm-btn-ok" onClick={add}>Agregar Transporte</button>
        <span className="cm-flex-1" />
        <span style={{ fontSize: 11 }}>Subtotal Transporte: <b>{fmt(subtotal)}</b></span>
      </div>
    </XlWrap>
  );
}
