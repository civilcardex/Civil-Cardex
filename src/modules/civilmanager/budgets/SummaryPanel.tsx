import { useCivilManager } from '../context.tsx';
import { calcResumenPresupuesto, fmtMoneda } from '../calc.ts';
import { NumInput } from '../shared/NumInput.tsx';
import { DimEnLectura, TableHeader, useEditable } from '../shared/EditLock.tsx';
import type { AiuOverride, Presupuesto } from '../types.ts';

interface Props {
  pres: Presupuesto;
  onUpdate: (patch: Partial<Presupuesto>) => void;
}

/** Sub-pestaña 'Resumen AIU' (Administración, Imprevistos, Utilidad): % globales con posibilidad de override propio del presupuesto y los 6 totales (costo directo, adm, imp, uti, IVA de la utilidad, total). */
export function ResumenPanel({ pres, onUpdate }: Props) {
  const { state, apuCalcMap } = useCivilManager();
  const editable = useEditable();
  const resumen = calcResumenPresupuesto(pres.items, apuCalcMap, pres.aiu_override, state.config);
  const aiu = pres.aiu_override;

  function updAiu<K extends keyof AiuOverride>(k: K, v: AiuOverride[K]) {
    onUpdate({ aiu_override: { ...aiu, [k]: v } });
  }

  return (
    <div>
      <TableHeader title="Resumen AIU" icon="resumen_aiu" />
      <DimEnLectura>
        <fieldset className="cm-xl-wrap cm-fieldset" disabled={!editable}>
          <div className="cm-check-row">
            <label className="cm-check-label">
              <input
                type="checkbox"
                checked={aiu.activo}
                onChange={(e) => updAiu('activo', e.target.checked)}
              />
              Usar AIU específico de este presupuesto (en vez del global)
            </label>
          </div>
          {aiu.activo && (
            <div className="cm-aiu-grid">
              <div>
                <label htmlFor="aiu-pct-a" className="cm-aiu-label">
                  Administración %
                </label>
                <NumInput
                  id="aiu-pct-a"
                  value={aiu.pct_a}
                  decimals={2}
                  onChange={(v) => updAiu('pct_a', v)}
                />
              </div>
              <div>
                <label htmlFor="aiu-pct-i" className="cm-aiu-label">
                  Imprevistos %
                </label>
                <NumInput
                  id="aiu-pct-i"
                  value={aiu.pct_i}
                  decimals={2}
                  onChange={(v) => updAiu('pct_i', v)}
                />
              </div>
              <div>
                <label htmlFor="aiu-pct-u" className="cm-aiu-label">
                  Utilidad %
                </label>
                <NumInput
                  id="aiu-pct-u"
                  value={aiu.pct_u}
                  decimals={2}
                  onChange={(v) => updAiu('pct_u', v)}
                />
              </div>
              <div>
                <label htmlFor="aiu-iva-pct" className="cm-aiu-label">
                  IVA sobre utilidad %
                </label>
                <NumInput
                  id="aiu-iva-pct"
                  value={aiu.iva_pct}
                  decimals={2}
                  onChange={(v) => updAiu('iva_pct', v)}
                />
              </div>
            </div>
          )}
        </fieldset>

        <div className="cm-xl-wrap cm-fieldset-bare">
          <table className="cm-tbl">
            <tbody>
              <tr>
                <td>Costo Directo</td>
                <td className="cm-td-num">{fmtMoneda(resumen.costoDirecto)}</td>
              </tr>
              <tr>
                <td>Administración</td>
                <td className="cm-td-num">{fmtMoneda(resumen.administracion)}</td>
              </tr>
              <tr>
                <td>Imprevistos</td>
                <td className="cm-td-num">{fmtMoneda(resumen.imprevistos)}</td>
              </tr>
              <tr>
                <td>Utilidad</td>
                <td className="cm-td-num">{fmtMoneda(resumen.utilidad)}</td>
              </tr>
              <tr>
                <td>IVA sobre utilidad</td>
                <td className="cm-td-num">{fmtMoneda(resumen.ivaUtilidad)}</td>
              </tr>
              <tr className="cm-total-row">
                <td>VALOR TOTAL</td>
                <td className="cm-total-val">{fmtMoneda(resumen.valorTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DimEnLectura>
    </div>
  );
}
