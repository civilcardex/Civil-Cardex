import React, { useMemo, useCallback, useEffect, useState } from 'react';
import EditButton from './shared/EditButton';
import { useTramos } from '../context/TramosContext';
import { usePlans } from '../context/PlansContext';
import { renderStatus } from '../utils/componentHelpers';
import { pisoCorto, DIAM_OPTIONS } from '../constants';
import { writeDiametroToDrawing } from '../utils/writeDiameterToDrawing';
import { calcHydraulicCheck } from '../utils/hydraulicCheck';
import { useRainwater } from '../context/RainwaterContext';
import {
  buildLlBajanteAssociations,
  computeLlQMap,
  computeLlRows,
  getTributarioIds,
} from '../utils/rainwaterRows';

const RainwaterDesign_S2: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  padding: '1px 1px',
  border: '1px solid var(--line)',
  borderRadius: 2,
  background: 'var(--bg2)',
  color: 'var(--txt)',
  cursor: 'pointer',
  maxWidth: 60,
};
const TH_HDR = { fontSize: 9, textAlign: 'center', padding: '1px 2px' } as const;

export default function DisenoLluvias() {
  const [edit, setEdit] = useState(false);
  const { tramosLl, updTramoLL } = useTramos();
  const { plans } = usePlans();
  const { bajantesLl } = useRainwater();

  const bajanteAssociations = useMemo(
    () => buildLlBajanteAssociations(tramosLl, plans),
    [plans, tramosLl],
  );

  const qMap = useMemo(
    () => computeLlQMap(tramosLl, plans, bajantesLl, bajanteAssociations),
    [tramosLl, bajantesLl, bajanteAssociations, plans],
  );

  const handleDiamChange = useCallback(
    (tramoKey: string, tramoId: string, newPulg: number) => {
      const opt = DIAM_OPTIONS.find((o) => o.pulg === newPulg);
      if (opt && tramoId) {
        const res = writeDiametroToDrawing(tramoId, 'll', opt.label, plans);
        if (!res.ok && res.reason === 'accessory-larger') {
          window.dispatchEvent(
            new CustomEvent('civilflow_diametro_validation', {
              detail: {
                title: 'Diámetro no permitido',
                message: `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
              },
            }),
          );
          return;
        }
        updTramoLL(tramoKey, 'diamDisPulg', newPulg);
      }
    },
    [updTramoLL, plans],
  );

  const tribIds = getTributarioIds(tramosLl);
  const displayTramos = tramosLl.filter(
    (t) => t._key != null && !t.esBajante && !tribIds.has(t._key) && !tribIds.has(t.id),
  );

  // Persiste el punto de control hidráulico (velocidad + relación de llenado) en cada Tramo
  // para que la insignia AGUAS LLUVIAS de InfTab lea un resultado real en vez de los valores por defecto siempre indefinidos.
  useEffect(() => {
    for (const t of displayTramos) {
      if (!t._key) continue;
      const n = t.nmaning ?? 0;
      const sVal = t.sPercent ?? 0;
      const S = sVal > 0 ? sVal / 100 : null;
      const Q = qMap[t._key] || 0;
      const dSel = DIAM_OPTIONS.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
      const DintMm = dSel ? dSel.mm : 0;
      let v_real = 0,
        yD = 0,
        qQ0 = 0;
      if (Q > 0 && S != null && S > 0 && n > 0 && DintMm > 0) {
        const hc = calcHydraulicCheck({ Q, S, n, DintMm });
        v_real = hc.Vreal;
        yD = Math.round((Math.max(hc.Yc, hc.Yn) / DintMm) * 1000) / 1000;
        qQ0 = hc.qqo;
      }
      if (t.v_real !== v_real) updTramoLL(t._key, 'v_real', v_real);
      if (t.yD !== yD) updTramoLL(t._key, 'yD', yD);
      if (t.qQ0 !== qQ0) updTramoLL(t._key, 'qQ0', qQ0);
    }
  }, [displayTramos, qMap, updTramoLL]);

  const llRows = useMemo(
    () => computeLlRows(displayTramos, qMap, bajanteAssociations),
    [displayTramos, qMap, bajanteAssociations],
  );

  return (
    <>
      <section className="card">
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/aguas_lluvias/RALL_Diseno_red.webp"
              alt="Diseño red aguas lluvias"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            Diseño de red aguas lluvias
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span className="card-s">{displayTramos.length} tramos</span>
            <EditButton edit={edit} setEdit={setEdit} />
          </div>
        </div>
        <div className="scroll-top" style={{ padding: '16px' }}>
          <div className="scroll-inner">
            <table className="tbl" style={{ fontSize: 10 }}>
              <thead>
                <tr>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Tramo
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Nivel
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Inicio
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Fin
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Bajantes
                    <br />
                    asociadas
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Caudal
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Manning
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Pendiente
                    <br />
                    <small>(%)</small>
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    colSpan={3}
                    style={{ textAlign: 'center', fontSize: 9, padding: '1px 2px' }}
                  >
                    Diámetro
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Qo
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Vo
                    <br />
                    <small>(m/s)</small>
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Q/Qo
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    V. real
                    <br />
                    <small>(m/s)</small>
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Chequeo velocidad
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Yc
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Yn
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Froude
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Flujo
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Ymax
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h ll" rowSpan={2} style={TH_HDR}>
                    Yn vs Yc
                  </th>
                  <th
                    scope="col"
                    className="col-h ven"
                    colSpan={2}
                    style={{ textAlign: 'center', fontSize: 9, padding: '1px 2px' }}
                  >
                    Fuerza Tractiva
                  </th>
                </tr>
                <tr>
                  <th scope="col" className="col-h ok" style={TH_HDR}>
                    Calculado
                    <br />
                    <small>(")</small>
                  </th>
                  <th scope="col" className="col-h ok" style={TH_HDR}>
                    Diseño
                    <br />
                    <small>(")</small>
                  </th>
                  <th scope="col" className="col-h ok" style={TH_HDR}>
                    Interior
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h ven" style={TH_HDR}>
                    Real
                    <br />
                    <small>(kg/m²)</small>
                  </th>
                  <th scope="col" className="col-h ven" style={TH_HDR}>
                    &gt;0.15
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayTramos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={24}
                      style={{
                        padding: '24px 0',
                        textAlign: 'center',
                        color: 'var(--txt3)',
                        fontSize: 10,
                      }}
                    >
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                ) : (
                  llRows.map((row) => {
                    const {
                      tKey,
                      id,
                      piso,
                      desde,
                      hasta,
                      bajantesAsociadas,
                      Q,
                      n,
                      sVal,
                      DcalcPulg,
                      DdisPulg,
                      DintMm,
                      Qo,
                      Vo,
                      qqo,
                      Vreal,
                      chequeoV,
                      Yc,
                      Yn,
                      Froude,
                      tipoFlujo,
                      Ymax,
                      chequeoYn,
                      fuerzaTractiva,
                      chequeoFT,
                    } = row;
                    return (
                      <tr key={tKey}>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          <span className="sigla" style={{ fontSize: 10 }}>
                            {id || tKey}
                          </span>
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: 'var(--mono)',
                              color: 'var(--txt2)',
                            }}
                          >
                            {piso ? pisoCorto(piso) : '—'}
                          </span>
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: 'var(--mono)',
                              color: 'var(--txt2)',
                            }}
                          >
                            {desde || '—'}
                          </span>
                        </td>
                        <td className="c" style={{ padding: '1px 2px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: 'var(--mono)',
                              color: 'var(--txt2)',
                            }}
                          >
                            {hasta || '—'}
                          </span>
                        </td>
                        <td
                          className="c"
                          style={{ padding: '1px 2px', minWidth: 60, maxWidth: 120 }}
                        >
                          {(() => {
                            const associatedBajantes = bajantesAsociadas;
                            return associatedBajantes.length === 0 ? (
                              <span style={{ fontSize: 10, color: 'var(--txt3)' }}>—</span>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 2,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              >
                                {associatedBajantes.map((bajName: string) => (
                                  <span
                                    key={bajName}
                                    style={{
                                      fontSize: 10,
                                      padding: '1px 2px',
                                      border: '1px solid var(--ll)',
                                      borderRadius: 3,
                                      color: 'var(--ll)',
                                      fontFamily: 'var(--mono)',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {bajName}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {Q > 0 ? Q.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {n > 0 ? n.toFixed(3) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {sVal > 0 ? sVal : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '—'}
                        </td>
                        <td className="c" style={{ padding: '1px 1px' }}>
                          <select
                            aria-label="Seleccionar diámetro"
                            value={DdisPulg || ''}
                            disabled={!edit}
                            onChange={(e) =>
                              handleDiamChange(tKey, id, parseFloat(e.target.value) || 0)
                            }
                            style={RainwaterDesign_S2}
                          >
                            <option value="">—</option>
                            {DIAM_OPTIONS.map((o) => (
                              <option key={o.pulg} value={o.pulg}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="c" style={{ fontSize: 10, padding: '1px 2px' }}>
                          {DintMm > 0 ? DintMm : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {Qo > 0 ? Qo.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {Vo > 0 ? Vo.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {qqo > 0 ? qqo.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {Vreal > 0 ? Vreal.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 10, padding: '1px 2px' }}>
                          {renderStatus(chequeoV)}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {Yc > 0 ? Yc.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {Yn > 0 ? Yn.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '1px 2px' }}
                        >
                          {Froude > 0 ? Froude.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 10, padding: '1px 2px' }}>
                          {tipoFlujo}
                        </td>
                        <td className="c" style={{ fontSize: 10, padding: '1px 2px' }}>
                          {Ymax > 0 ? Ymax.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 10, padding: '1px 2px' }}>
                          {renderStatus(chequeoYn)}
                        </td>
                        <td className="c" style={{ fontSize: 10, padding: '1px 2px' }}>
                          {fuerzaTractiva > 0 ? fuerzaTractiva.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 10, padding: '1px 2px' }}>
                          {renderStatus(chequeoFT)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
