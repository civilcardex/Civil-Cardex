import { useCivilManager } from '../context';
import { NumInput } from '../shared/NumInput';
import type { CivilManagerConfig } from '../types';

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180 }}>
      <label style={{ fontSize: 10, color: 'var(--txt2)', fontWeight: 700 }}>{label}</label>
      {children}
      {help && <span style={{ fontSize: 9, color: 'var(--txt3)' }}>{help}</span>}
    </div>
  );
}

export function ParametrosApuPanel() {
  const { state, patch } = useCivilManager();
  const { config } = state;
  const c = config.comentarios_apu;

  function upd<K extends keyof CivilManagerConfig>(k: K, v: CivilManagerConfig[K]) {
    patch({ config: { ...config, [k]: v } });
  }

  return (
    <div className="cm-xl-wrap" style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <Field label="Salario base" help={c.tipo_salario}>
        <NumInput value={config.salario_base} format onChange={v => upd('salario_base', v)} />
      </Field>
      <Field label="Auxilio de transporte">
        <NumInput value={config.auxilio_transporte} format onChange={v => upd('auxilio_transporte', v)} />
      </Field>
      <Field label="Días/mes">
        <NumInput value={config.dias_mes} decimals={0} onChange={v => upd('dias_mes', v)} />
      </Field>
      <Field label="Horas/mes">
        <NumInput value={config.horas_mes} decimals={0} onChange={v => upd('horas_mes', v)} />
      </Field>
      <Field label="Herramienta menor %" help={c.herramienta_menor}>
        <NumInput value={config.herr_pct} decimals={2} onChange={v => upd('herr_pct', v)} />
      </Field>
      <Field label="Administración %" help={c.administracion}>
        <NumInput value={config.pct_administracion} decimals={2} onChange={v => upd('pct_administracion', v)} />
      </Field>
      <Field label="Imprevistos %" help={c.imprevistos}>
        <NumInput value={config.pct_imprevistos} decimals={2} onChange={v => upd('pct_imprevistos', v)} />
      </Field>
      <Field label="Utilidad %" help={c.utilidad}>
        <NumInput value={config.pct_utilidad} decimals={2} onChange={v => upd('pct_utilidad', v)} />
      </Field>
      <Field label="Usar F.P. en cada APU" help={config.usar_fp_en_apu ? undefined : c.costo_personal_fp}>
        <select className="cm-sel" value={config.usar_fp_en_apu ? 'si' : 'no'} onChange={e => upd('usar_fp_en_apu', e.target.value === 'si')}>
          <option value="no">No — incrustado en costo personal</option>
          <option value="si">Sí — se calcula al final</option>
        </select>
      </Field>
      <Field label="Aplicar AIU por APU" help={c.usar_en_cada_apu}>
        <select className="cm-sel" value={config.usar_en_cada_apu ? 'si' : 'no'} onChange={e => upd('usar_en_cada_apu', e.target.value === 'si')}>
          <option value="si">En cada APU</option>
          <option value="no">Al final del presupuesto</option>
        </select>
      </Field>
      <Field label="Valor resumido" help={c.vr_resumido}>
        <select className="cm-sel" value={config.vr_resumido ? 'si' : 'no'} onChange={e => upd('vr_resumido', e.target.value === 'si')}>
          <option value="no">Discriminar AIU</option>
          <option value="si">No discriminar</option>
        </select>
      </Field>
    </div>
  );
}
