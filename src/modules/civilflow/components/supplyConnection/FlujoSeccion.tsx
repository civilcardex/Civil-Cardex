import EditButton from '../shared/EditaBoton.tsx';
import { SupplyConnection_S1 } from './estilos.ts';
import { useStickyThead2Offset } from '../shared/useStickyThead2Offset';
import { fmt } from '../../utils/formatoUtiles.ts';
import { LazyNumE } from './LazyNumE';
import { SECTION_COL, SECTION_HDR, SECTION_H4, TH_CENTER } from './estilos.ts';
import type { AcometidaProps } from './tipos.ts';

/** SeccionFlujoHidraulico: una sección de la tabla de acometida (props de la tabla). */
export function SeccionFlujoHidraulico(props: AcometidaProps) {
  const tablaRef = useStickyThead2Offset();
  const {
    Qaco,
    edit1,
    setEdit1,
    acoMonName,
    setAcoMonName,
    acoRedContDiam,
    acoContMonDiam,
    acoL1,
    setAcoL1,
    acoL2,
    setAcoL2,
    AF_DIAM_OPTS,
    isTr1Drawn,
    onTr1DiamChange,
    onTr2DiamChange,
    isTr2Drawn,
  } = props;
  return (
    <>
      {/* SECTION 1: Esquema de Flujo Hidráulico & Tabla Tramos */}
      <div style={{ ...SECTION_COL, flex: '16 1 440px' }}>
        <div className="card-h" style={SECTION_HDR}>
          <h4 style={SECTION_H4}>1. Flujo Hidráulico y Tramos</h4>
          <div style={{ marginLeft: 'auto' }}>
            <EditButton edit={edit1} setEdit={setEdit1} />
          </div>
        </div>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--line)' }}>
          {/* Text Diagram */}
          <div style={SupplyConnection_S1}>
            <span style={{ fontWeight: 700, color: 'var(--txt)' }}>RED PÚBLICA</span>
            <span style={{ color: 'var(--txt3)' }}>→</span>
            <span style={{ fontWeight: 700, color: 'var(--txt)' }}>CONTADOR</span>
            <span style={{ color: 'var(--txt3)' }}>→</span>
            <span style={{ fontWeight: 700, color: 'var(--txt)' }}>RED INTERNA</span>
          </div>
        </div>
        {/* Tramos Table */}
        <table
          ref={tablaRef}
          className="tbl"
          style={{ fontSize: 10, width: '100%', tableLayout: 'fixed', borderBottom: 'none' }}
        >
          <thead>
            <tr>
              <th
                title="Tramo de la acometida."
                scope="col"
                className="col-h"
                rowSpan={2}
                style={{ ...TH_CENTER, width: '10%' }}
              >
                Tramo
              </th>
              <th
                title="Punto de toma del acueducto."
                scope="col"
                className="col-h"
                rowSpan={2}
                style={{ ...TH_CENTER, width: '16%' }}
              >
                Desde
              </th>
              <th
                title="Llegada al equipo de medición."
                scope="col"
                className="col-h"
                rowSpan={2}
                style={{ ...TH_CENTER, width: '16%' }}
              >
                Hasta
              </th>
              <th
                title="Longitudes horizontal y equivalente de accesorios (m)."
                scope="colgroup"
                className="col-h"
                colSpan={2}
                style={{ ...TH_CENTER, fontSize: 10, width: '26%' }}
              >
                Longitud (m)
              </th>
              <th
                title="Diámetro que sugiere el cálculo para la acometida."
                scope="col"
                className="col-h"
                rowSpan={2}
                style={{ ...TH_CENTER, width: '16%' }}
              >
                Diámetro
                <br />
                Estimado
              </th>
              <th
                title="Diámetro comercial de la acometida."
                scope="col"
                className="col-h"
                rowSpan={2}
                style={{ ...TH_CENTER, width: '16%' }}
              >
                Diámetro
                <br />
                Propuesto
              </th>
            </tr>
            <tr>
              <th
                title="Longitud horizontal del tramo (m)."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, fontSize: 9, fontWeight: 405, width: '13%' }}
              >
                Horizontal
              </th>
              <th
                title="Longitud equivalente de accesorios (m)."
                scope="col"
                className="col-h"
                style={{ ...TH_CENTER, fontSize: 9, fontWeight: 405, width: '13%' }}
              >
                Eq. Accesorios
              </th>
            </tr>
          </thead>
          <tbody>
            {/* ACOM-01 */}
            <tr>
              <td className="c" style={{ fontWeight: 600, padding: '2px 4px' }}>
                AC-01
              </td>
              <td className="c" style={{ padding: '2px 4px' }}>
                Red Pública
              </td>
              <td className="c" style={{ padding: '2px 4px' }}>
                Contador
              </td>
              <td className="c" style={{ padding: '1px' }}>
                <LazyNumE
                  edit={edit1}
                  ariaLabel="Longitud horizontal ACOM-01"
                  value={acoL1.h}
                  onChange={(v: number) => setAcoL1((s) => ({ ...s, h: v }))}
                  className="ni"
                  style={{ width: '100%', textAlign: 'center', fontSize: 10, padding: 2 }}
                />
              </td>
              <td className="c" style={{ padding: '1px' }}>
                {isTr1Drawn ? (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--txt2)' }}>
                    {fmt(acoL1.le, 2)}
                  </span>
                ) : (
                  <LazyNumE
                    edit={edit1}
                    ariaLabel="Longitud equivalente ACOM-01"
                    value={acoL1.le}
                    onChange={(v: number) => setAcoL1((s) => ({ ...s, le: v }))}
                    className="ni"
                    style={{ width: '100%', textAlign: 'center', fontSize: 10, padding: 2 }}
                  />
                )}
              </td>
              <td
                className="c"
                style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--txt2)' }}
              >
                {Qaco > 0 ? fmt(Math.sqrt(Qaco), 2) : '—'}
              </td>
              <td className="c" style={{ padding: '1px 2px' }}>
                {isTr1Drawn ? (
                  <select
                    aria-label="Diámetro propuesto AC-01"
                    value={acoRedContDiam || ''}
                    disabled={!edit1}
                    onChange={(e) => onTr1DiamChange?.(e.target.value)}
                    style={{ width: '100%', fontSize: 10, textAlign: 'center' }}
                  >
                    <option value="">—</option>
                    {AF_DIAM_OPTS.map((o) => (
                      <option key={o.nominal} value={o.nominal}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ color: 'var(--txt3)' }}>—</span>
                )}
              </td>
            </tr>
            {/* ACOM-02 */}
            <tr>
              <td
                className="c"
                style={{
                  fontWeight: 600,
                  padding: '2px 4px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                AC-02
              </td>
              <td
                className="c"
                style={{ padding: '2px 4px', borderBottom: '1px solid var(--line)' }}
              >
                Contador
              </td>
              <td className="c" style={{ padding: '1px', borderBottom: '1px solid var(--line)' }}>
                {isTr2Drawn ? (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--txt2)' }}>
                    {acoMonName || '—'}
                  </span>
                ) : edit1 ? (
                  <input
                    aria-label="Nombre montante"
                    value={acoMonName}
                    onChange={(e) => setAcoMonName(e.target.value)}
                    className="ni"
                    style={{ fontSize: 10, padding: '2px' }}
                    placeholder="Mont..."
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--txt)',
                    }}
                  >
                    {acoMonName || '—'}
                  </span>
                )}
              </td>
              <td className="c" style={{ padding: '1px', borderBottom: '1px solid var(--line)' }}>
                {isTr2Drawn ? (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--txt2)' }}>
                    {fmt(acoL2.h, 2)}
                  </span>
                ) : (
                  <LazyNumE
                    edit={edit1}
                    ariaLabel="Longitud horizontal ACOM-02"
                    value={acoL2.h}
                    onChange={(v: number) => setAcoL2((s) => ({ ...s, h: v }))}
                    className="ni"
                    style={{ width: '100%', textAlign: 'center', fontSize: 10, padding: 2 }}
                  />
                )}
              </td>
              <td className="c" style={{ padding: '1px', borderBottom: '1px solid var(--line)' }}>
                {isTr2Drawn ? (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--txt2)' }}>
                    {fmt(acoL2.le, 2)}
                  </span>
                ) : (
                  <LazyNumE
                    edit={edit1}
                    ariaLabel="Longitud equivalente ACOM-02"
                    value={acoL2.le}
                    onChange={(v: number) => setAcoL2((s) => ({ ...s, le: v }))}
                    className="ni"
                    style={{ width: '100%', textAlign: 'center', fontSize: 10, padding: 2 }}
                  />
                )}
              </td>
              <td
                className="c"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--txt2)',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                {Qaco > 0 ? fmt(Math.sqrt(Qaco), 2) : '—'}
              </td>
              <td className="c" style={{ padding: '1px 2px' }}>
                {isTr2Drawn ? (
                  <select
                    aria-label="Diámetro propuesto AC-02"
                    value={acoContMonDiam || ''}
                    disabled={!edit1}
                    onChange={(e) => onTr2DiamChange?.(e.target.value)}
                    style={{ width: '100%', fontSize: 10, textAlign: 'center' }}
                  >
                    <option value="">—</option>
                    {AF_DIAM_OPTS.map((o) => (
                      <option key={o.nominal} value={o.nominal}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ color: 'var(--txt3)' }}>—</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
