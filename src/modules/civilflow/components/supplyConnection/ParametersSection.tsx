import EditButton from '../shared/EditButton.tsx';
import { CONTADORES as CONTADORES_CAT } from '../../pages/catalog/catalogData.ts';
import { SupplyConnection_S2 } from './styles.ts';
import { fmt } from '../../utils/formatUtils.ts';
import {
  SECTION_COL,
  SECTION_HDR,
  SECTION_H4,
  TH_CENTER,
  TD_PARAM_LABEL,
  TD_PARAM_VALUE,
  TD_PARAM_UNIT,
} from './styles.ts';
import type { AcometidaProps } from './types.ts';

/** SeccionResumenParametros: una sección de la tabla de acometida (props de la tabla). */
export function SeccionResumenParametros(props: AcometidaProps) {
  const {
    Qaco,
    edit2,
    setEdit2,
    contadorSel,
    acoContIx,
    setAcoContIx,
    cHW1,
    cHW2,
    f1,
    f2,
    onContDiamChange,
  } = props;
  return (
    <>
      {/* SECTION 2: Parámetros y Constantes */}
      <div style={{ ...SECTION_COL, flex: '8 1 240px' }}>
        <div className="card-h" style={SECTION_HDR}>
          <h4 style={SECTION_H4}>2. Resumen de Parámetros</h4>
          <div style={{ marginLeft: 'auto' }}>
            <EditButton edit={edit2} setEdit={setEdit2} />
          </div>
        </div>
        <table
          className="tbl"
          style={{ fontSize: 12, width: '100%', tableLayout: 'fixed', borderBottom: 'none' }}
        >
          <thead>
            <tr>
              <th
                title="Nombre del parámetro de la acometida."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, width: '45%' }}
              >
                Parámetro
              </th>
              <th
                title="Valor para la acometida AC-01."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, width: '20%' }}
              >
                AC-01
              </th>
              <th
                title="Valor para la acometida AC-02."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, width: '20%' }}
              >
                AC-02
              </th>
              <th
                title="Unidad del parámetro."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, width: '15%' }}
              >
                Unidad
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={TD_PARAM_LABEL}>Caudal (Q)</td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(Qaco)}
              </td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(Qaco)}
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                l/s
              </td>
            </tr>
            <tr>
              <td style={TD_PARAM_LABEL}>Diámetro interior</td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f1.dInt)}
              </td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f2.dInt)}
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                mm
              </td>
            </tr>
            <tr>
              <td style={TD_PARAM_LABEL}>Velocidad</td>
              <td
                className="c"
                style={{
                  textAlign: 'center',
                  fontWeight: 600,
                  padding: '4px',
                  color: f1.V > 2500 ? 'var(--err)' : 'var(--txt2)',
                }}
              >
                {fmt(f1.V, 2)}
              </td>
              <td
                className="c"
                style={{
                  textAlign: 'center',
                  fontWeight: 600,
                  padding: '4px',
                  color: f2.V > 2500 ? 'var(--err)' : 'var(--txt2)',
                }}
              >
                {fmt(f2.V, 2)}
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                mm/s
              </td>
            </tr>
            <tr>
              <td style={TD_PARAM_LABEL}>Longitud total</td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f1.Lt)}
              </td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f2.Lt)}
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                m
              </td>
            </tr>
            <tr>
              <td style={TD_PARAM_LABEL}>Pérdidas por fricción (‰)</td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f1.hfPct)}
              </td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f2.hfPct)}
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                %
              </td>
            </tr>
            <tr>
              <td style={TD_PARAM_LABEL}>Pérdidas por fricción (m)</td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f1.hfM)}
              </td>
              <td className="c" style={TD_PARAM_VALUE}>
                {fmt(f2.hfM)}
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                mca
              </td>
            </tr>
            <tr>
              <td style={TD_PARAM_LABEL}>Coeficiente C</td>
              <td
                className="c"
                style={{
                  textAlign: 'center',
                  fontWeight: 600,
                  padding: '4px',
                  color: 'var(--txt2)',
                }}
              >
                {cHW1}
              </td>
              <td
                className="c"
                style={{
                  textAlign: 'center',
                  fontWeight: 600,
                  padding: '4px',
                  color: 'var(--txt2)',
                }}
              >
                {cHW2}
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                —
              </td>
            </tr>
            <tr>
              <td style={TD_PARAM_LABEL}>Diámetro del contador</td>
              <td className="c" colSpan={2} style={{ textAlign: 'center', padding: '2px' }}>
                <select
                  value={acoContIx}
                  aria-label="Diámetro del contador"
                  disabled={!edit2}
                  onChange={(e) => {
                    const i = parseInt(e.target.value);
                    setAcoContIx(i);
                    if (onContDiamChange && CONTADORES_CAT[i]) {
                      onContDiamChange(`${CONTADORES_CAT[i].dn}"`);
                    }
                  }}
                  style={
                    edit2
                      ? SupplyConnection_S2
                      : {
                          ...SupplyConnection_S2,
                          border: 'none',
                          background: 'transparent',
                          fontWeight: 600,
                          cursor: 'default',
                        }
                  }
                >
                  {CONTADORES_CAT.map((c, i) => (
                    <option key={i} value={i}>
                      {c.dn}
                    </option>
                  ))}
                </select>
              </td>
              <td className="c" style={TD_PARAM_UNIT}>
                pulg
              </td>
            </tr>
            <tr>
              <td style={{ ...TD_PARAM_LABEL, borderBottom: '1px solid var(--line)' }}>
                Caudal nominal (Qn)
              </td>
              <td
                className="c"
                colSpan={2}
                style={{
                  textAlign: 'center',
                  fontWeight: 600,
                  padding: '4px',
                  color: 'var(--txt2)',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                {fmt(contadorSel.q || 0)}
              </td>
              <td className="c" style={{ ...TD_PARAM_UNIT, borderBottom: '1px solid var(--line)' }}>
                L/s
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
