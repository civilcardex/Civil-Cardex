import EditButton from '../shared/EditButton.tsx';
import { fmt } from '../../utils/formatUtils.ts';
import { FilaParamNum } from './ParamRow.tsx';
import { FilaComparativaInline } from './InlineComparisonRow.tsx';
import { diamFractionValue } from '../../utils/diamFractionValue.ts';
import { SECTION_COL, SECTION_HDR, SECTION_H4, TH_CENTER } from './styles.ts';
import type { AcometidaProps } from './types.ts';

/** SeccionVerificacion: una sección de la tabla de acometida (props de la tabla). */
export function SeccionVerificacion(props: AcometidaProps) {
  const {
    edit3,
    setEdit3,
    contadorSel,
    acoRedContDiam,
    acoPini,
    setAcoPini,
    acoHfMax,
    setAcoHfMax,
    acoPResMin,
    setAcoPResMin,
    acoLeMed,
    setAcoLeMed,
    f1,
    f2,
    hfContador,
    pResidual,
    okPresion,
  } = props;
  return (
    <>
      {/* SECTION 3: Verificación Final */}
      <div style={{ ...SECTION_COL, flex: '8 1 240px' }}>
        <div className="card-h" style={SECTION_HDR}>
          <h4 style={SECTION_H4}>3. Verificación</h4>
          <div style={{ marginLeft: 'auto' }}>
            <EditButton edit={edit3} setEdit={setEdit3} />
          </div>
        </div>
        <table
          className="tbl"
          style={{ fontSize: 12, width: '100%', tableLayout: 'fixed', borderBottom: 'none' }}
        >
          <thead>
            <tr>
              <th
                title="Parámetro verificado de la acometida."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, width: '55%' }}
              >
                Parámetro
              </th>
              <th
                title="Valor o estado del chequeo."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, width: '45%' }}
              >
                Valor / Estado
              </th>
            </tr>
          </thead>
          <tbody>
            <FilaParamNum
              disabled={!edit3}
              label="AC-01 Presión Inicial"
              ariaLabel="AC-01 Presión Inicial"
              value={acoPini}
              onChange={(v: number) => setAcoPini(v)}
              unidad="mca"
            />
            <tr>
              <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>
                AC-01 Presión Final
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  padding: '3px 4px',
                  color: 'var(--txt2)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {fmt(f1.Pfin)} <span style={{ fontSize: 9, color: 'var(--txt3)' }}>mca</span>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>
                AC-02 Presión Inicial
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  padding: '3px 4px',
                  color: 'var(--txt2)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {fmt(f1.Pfin)} <span style={{ fontSize: 9, color: 'var(--txt3)' }}>mca</span>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>
                AC-02 Presión Final
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  padding: '3px 4px',
                  color: 'var(--txt2)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {fmt(f2.Pfin)} <span style={{ fontSize: 9, color: 'var(--txt3)' }}>mca</span>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>
                Pérdidas en contador &le; Pérdidas máximas
              </td>
              <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    justifyContent: 'flex-end',
                    width: '100%',
                  }}
                >
                  <FilaComparativaInline
                    disabled={!edit3}
                    valor={hfContador}
                    cumple={hfContador <= acoHfMax}
                    op="≤"
                    ariaLabel="Hf max permitida contador"
                    value={acoHfMax}
                    onChange={(v: number) => setAcoHfMax(v)}
                    unidad="mca"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>
                Diámetro acometida vs Contador
              </td>
              <td
                style={{
                  textAlign: 'right',
                  padding: '3px 4px',
                  fontWeight: 700,
                  fontFamily: 'var(--mono)',
                }}
              >
                {(() => {
                  const dValAco = diamFractionValue(acoRedContDiam);
                  const dValCont = diamFractionValue(contadorSel.dn || '0');
                  const diff = dValAco - dValCont;
                  const ok = diff <= 0.5;
                  return (
                    <span style={{ color: ok ? 'var(--succ)' : 'var(--warn)' }}>
                      {ok ? '✓ Conforme' : `⚠️ +${diff.toFixed(2)}"`}
                    </span>
                  );
                })()}
              </td>
            </tr>
            <FilaParamNum
              disabled={!edit3}
              label="Le del medidor (AC-01)"
              ariaLabel="Longitud equivalente del medidor"
              value={acoLeMed}
              onChange={(v: number) => setAcoLeMed(v)}
              unidad="m"
            />
            <tr>
              <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>
                Presión residual final
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  padding: '3px 4px',
                  color: 'var(--txt2)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {fmt(pResidual)} <span style={{ fontSize: 9, color: 'var(--txt3)' }}>mca</span>
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, padding: '3px 4px', textAlign: 'left' }}>
                Presión residual &ge; Mínima
              </td>
              <td style={{ textAlign: 'right', padding: '2px 4px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    justifyContent: 'flex-end',
                    width: '100%',
                  }}
                >
                  <FilaComparativaInline
                    disabled={!edit3}
                    valor={pResidual}
                    cumple={pResidual >= acoPResMin}
                    op="≥"
                    ariaLabel="Presión residual mínima"
                    value={acoPResMin}
                    onChange={(v: number) => setAcoPResMin(v)}
                    unidad="mca"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td
                style={{
                  fontWeight: 700,
                  padding: '2px 4px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                ESTADO
              </td>
              <td
                style={{
                  textAlign: 'center',
                  fontWeight: 800,
                  background:
                    okPresion && hfContador <= acoHfMax
                      ? 'rgba(34,197,94,0.15)'
                      : 'rgba(239,68,68,0.15)',
                  color: okPresion && hfContador <= acoHfMax ? 'var(--succ)' : 'var(--err)',
                  padding: '4px',
                  letterSpacing: 0.5,
                  borderBottom: '1px solid var(--line)',
                }}
              >
                {okPresion && hfContador <= acoHfMax ? 'O.K.' : 'NO CUMPLE'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
