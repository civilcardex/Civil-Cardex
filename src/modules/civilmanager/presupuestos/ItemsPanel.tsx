import { useCivilManager } from '../context';
import { calcItemValue, esCapituloFinal, fmt } from '../calc';
import { NumInput } from '../shared/NumInput';
import { ActionIcon } from '../shared/icons';
import { XlRowNum, XlScroll, XlWrap } from '../shared/XlTable';
import type { Presupuesto, PresupuestoItem } from '../types';

interface Props {
  pres: Presupuesto;
  onUpdate: (patch: Partial<Presupuesto>) => void;
}

export function ItemsPanel({ pres, onUpdate }: Props) {
  const { state, apuCalcMap } = useCivilManager();

  function setItems(items: PresupuestoItem[]) {
    onUpdate({ items });
  }

  function add() {
    const nuevo: PresupuestoItem = {
      id: crypto.randomUUID(),
      num_item: String(pres.items.length + 1),
      capitulo: '',
      descripcion: 'Nuevo ítem',
      unidad: 'un',
      cantidad: 0,
      apu_id: '',
      tiene_apu: false,
      alerta_sin_apu: true,
      es_capitulo: false,
      es_capitulo_manual: null,
    };
    setItems([...pres.items, nuevo]);
  }

  function upd(i: number, k: keyof PresupuestoItem, v: string | number | boolean | null) {
    const n = [...pres.items];
    const item = { ...n[i], [k]: v } as PresupuestoItem;
    if (k === 'apu_id') {
      item.tiene_apu = Boolean(v);
      item.alerta_sin_apu = !v;
    }
    n[i] = item;
    setItems(n);
  }

  function del(i: number) {
    setItems(pres.items.filter((_, j) => j !== i));
  }

  return (
    <XlWrap>
      <XlScroll>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ítem</th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th>Cantidad</th>
              <th>APU</th>
              <th>Vr. Unitario</th>
              <th>Vr. Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pres.items.length === 0 && <tr><td colSpan={9} className="cm-empty-row">Sin ítems</td></tr>}
            {pres.items.map((it, i) => {
              const esCap = esCapituloFinal(it);
              const calc = calcItemValue(it, apuCalcMap.get(it.apu_id), pres.aiu_override, state.config);
              return (
                <tr key={it.id} style={esCap ? { fontWeight: 700, background: 'var(--bg3)' } : undefined}>
                  <XlRowNum n={i + 1} />
                  <td><input className="cm-ni" aria-label="Ítem" value={it.num_item} onChange={e => upd(i, 'num_item', e.target.value)} /></td>
                  <td><input className="cm-ni" aria-label="Descripción" value={it.descripcion} onChange={e => upd(i, 'descripcion', e.target.value)} /></td>
                  <td>
                    {!esCap && (
                      <select className="cm-sel" aria-label="Unidad" value={it.unidad} onChange={e => upd(i, 'unidad', e.target.value)}>
                        {state.config_listas.unidades.map(u => <option key={u.abreviatura} value={u.abreviatura}>{u.abreviatura}</option>)}
                      </select>
                    )}
                  </td>
                  <td>{!esCap && <NumInput value={it.cantidad} decimals={2} onChange={v => upd(i, 'cantidad', v)} />}</td>
                  <td>
                    {!esCap && (
                      <select
                        className="cm-sel"
                        aria-label="APU"
                        value={it.apu_id}
                        onChange={e => upd(i, 'apu_id', e.target.value)}
                        style={{ borderColor: it.alerta_sin_apu ? 'var(--err)' : undefined }}
                      >
                        <option value="">— sin APU —</option>
                        {state.apus.map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>)}
                      </select>
                    )}
                  </td>
                  <td>{!esCap && fmt(calc.vrUnitario)}</td>
                  <td>{fmt(calc.valorTotal)}</td>
                  <td className="cm-col-act">
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9 }}>
                      <input type="checkbox" checked={esCap} onChange={e => upd(i, 'es_capitulo_manual', e.target.checked)} title="Marcar como capítulo" aria-label="Marcar como capítulo" />
                    </label>
                    <button type="button" className="cm-btn-icon" onClick={() => del(i)} aria-label="Eliminar ítem">
                      <ActionIcon name="delete" label="Eliminar ítem" color="var(--err)" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </XlScroll>
      <div className="cm-xl-foot">
        <button type="button" className="cm-btn cm-btn-ok" onClick={add}>Agregar Ítem</button>
        <span className="cm-flex-1" />
        <span style={{ fontSize: 11 }}>Total ítems: <b>{pres.items.length}</b></span>
      </div>
    </XlWrap>
  );
}
