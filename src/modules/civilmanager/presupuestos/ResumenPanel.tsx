import { useCivilManager } from '../context';
import { calcResumenPresupuesto, fmt } from '../calc';
import { NumInput } from '../shared/NumInput';
import type { AiuOverride, Presupuesto } from '../types';

interface Props {
  pres: Presupuesto;
  onUpdate: (patch: Partial<Presupuesto>) => void;
}

export function ResumenPanel({ pres, onUpdate }: Props) {
  const { state, apuCalcMap } = useCivilManager();
  const resumen = calcResumenPresupuesto(pres.items, apuCalcMap, pres.aiu_override, state.config);
  const aiu = pres.aiu_override;

  function updAiu<K extends keyof AiuOverride>(k: K, v: AiuOverride[K]) {
    onUpdate({ aiu_override: { ...aiu, [k]: v } });
  }

  return (
    <div>
      <div className="cm-xl-wrap" style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={aiu.activo} onChange={e => updAiu('activo', e.target.checked)} />
            Usar AIU específico de este presupuesto (en vez del global)
          </label>
        </div>
        {aiu.activo && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <label htmlFor="aiu-pct-a" style={{ fontSize: 10, color: 'var(--txt2)' }}>Administración %</label>
              <NumInput id="aiu-pct-a" value={aiu.pct_a} decimals={2} onChange={v => updAiu('pct_a', v)} />
            </div>
            <div>
              <label htmlFor="aiu-pct-i" style={{ fontSize: 10, color: 'var(--txt2)' }}>Imprevistos %</label>
              <NumInput id="aiu-pct-i" value={aiu.pct_i} decimals={2} onChange={v => updAiu('pct_i', v)} />
            </div>
            <div>
              <label htmlFor="aiu-pct-u" style={{ fontSize: 10, color: 'var(--txt2)' }}>Utilidad %</label>
              <NumInput id="aiu-pct-u" value={aiu.pct_u} decimals={2} onChange={v => updAiu('pct_u', v)} />
            </div>
            <div>
              <label htmlFor="aiu-iva-pct" style={{ fontSize: 10, color: 'var(--txt2)' }}>IVA sobre utilidad %</label>
              <NumInput id="aiu-iva-pct" value={aiu.iva_pct} decimals={2} onChange={v => updAiu('iva_pct', v)} />
            </div>
          </div>
        )}
      </div>

      <div className="cm-xl-wrap" style={{ padding: 14 }}>
        <table className="cm-tbl">
          <tbody>
            <tr><td>Costo Directo</td><td style={{ textAlign: 'right' }}>{fmt(resumen.costoDirecto)}</td></tr>
            <tr><td>Administración</td><td style={{ textAlign: 'right' }}>{fmt(resumen.administracion)}</td></tr>
            <tr><td>Imprevistos</td><td style={{ textAlign: 'right' }}>{fmt(resumen.imprevistos)}</td></tr>
            <tr><td>Utilidad</td><td style={{ textAlign: 'right' }}>{fmt(resumen.utilidad)}</td></tr>
            <tr><td>IVA sobre utilidad</td><td style={{ textAlign: 'right' }}>{fmt(resumen.ivaUtilidad)}</td></tr>
            <tr style={{ fontWeight: 700, fontSize: 13 }}>
              <td>VALOR TOTAL</td>
              <td style={{ textAlign: 'right', color: 'var(--acc)' }}>{fmt(resumen.valorTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
