import { useCivilManager } from '../context';
import { fmt } from '../calc';
import { ApuSeccionMO } from './ApuSeccionMO';
import { ApuSeccionEquipo } from './ApuSeccionEquipo';
import { ApuSeccionInsumos } from './ApuSeccionInsumos';
import { ApuSeccionTransporte } from './ApuSeccionTransporte';
import type { Apu } from '../types';

interface Props {
  apu: Apu;
  onUpdate: (patch: Partial<Apu>) => void;
}

export function ApuEditor({ apu, onUpdate }: Props) {
  const { state, apuCalcMap } = useCivilManager();
  const calc = apuCalcMap.get(apu.id);

  return (
    <div>
      <div className="cm-xl-wrap" style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{apu.codigo}</span>
        <input className="cm-ni" style={{ maxWidth: 260 }} value={apu.nombre} onChange={e => onUpdate({ nombre: e.target.value })} aria-label="Nombre del APU" />
        <select className="cm-sel" value={apu.categoria} onChange={e => onUpdate({ categoria: e.target.value })} aria-label="Categoría">
          {state.categorias_apu.map(c => <option key={c.codigo} value={c.categoria}>{c.categoria}</option>)}
        </select>
        <select className="cm-sel" value={apu.unidad} onChange={e => onUpdate({ unidad: e.target.value })} aria-label="Unidad">
          {state.config_listas.unidades.map(u => <option key={u.abreviatura} value={u.abreviatura}>{u.abreviatura}</option>)}
        </select>
        <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={apu.es_basico} onChange={e => onUpdate({ es_basico: e.target.checked })} />
          APU básico (preparado en obra)
        </label>
        <span className="cm-flex-1" />
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          Costo unitario: <span style={{ color: 'var(--acc)' }}>{fmt(calc?.totalDirecto ?? 0)}</span>
        </span>
      </div>

      <ApuSeccionMO apu={apu} onChange={recursos_mo => onUpdate({ recursos_mo })} />
      <ApuSeccionEquipo apu={apu} onChange={recursos_eq => onUpdate({ recursos_eq })} />
      <ApuSeccionInsumos apu={apu} onChange={recursos_ins => onUpdate({ recursos_ins })} />
      <ApuSeccionTransporte apu={apu} onChange={recursos_transporte => onUpdate({ recursos_transporte })} />

      {calc && (
        <div className="cm-xl-wrap" style={{ padding: 10, fontSize: 11 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <div>Mano de obra: <b>{fmt(calc.subMO)}</b></div>
            <div>Herramienta menor: <b>{fmt(calc.herr)}</b></div>
            <div>Prestaciones: <b>{fmt(calc.vrPrest)}</b></div>
            <div>Equipo: <b>{fmt(calc.subEq)}</b></div>
            <div>Insumos: <b>{fmt(calc.subIns)}</b></div>
            <div>Transporte: <b>{fmt(calc.subTrans)}</b></div>
            <div style={{ gridColumn: 'span 2', fontWeight: 700 }}>Total directo: <span style={{ color: 'var(--acc)' }}>{fmt(calc.totalDirecto)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
