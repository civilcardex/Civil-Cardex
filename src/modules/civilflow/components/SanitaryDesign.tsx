import { useMemo, useCallback, useEffect, useState } from 'react';
import EditButton from './shared/EditButton';
import { useTramos } from '../context/TramosContext';
import { useApparatus } from '../context/ApparatusContext';
import { usePlans } from '../context/PlansContext';
import { calcUDparcial, renderStatus } from '../utils/componentHelpers';
import { pisoCorto, DIAM_OPTIONS, SAN_UC_IDS, APARATOS_DEF } from '../constants';
import { caudalHunterLPS, factorSimultaneidad } from '../utils/calcSanitaryCore';
import { writeDiametroToDrawing } from '../utils/writeDiameterToDrawing';
import { calcHydraulicCheck } from '../utils/hydraulicCheck';
import { buildSanConnectivity, computeSanRows } from '../utils/sanitaryRows';

const SanitaryDesign_S1: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 9,
  padding: '1px 2px',
  border: '1px solid var(--line)',
  borderRadius: 2,
  background: 'var(--bg2)',
  color: 'var(--txt)',
  cursor: 'pointer',
};

const SR_ONLY = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
const EMPTY_ROW = {
  padding: '24px 0',
  textAlign: 'center',
  color: 'var(--txt3)',
  fontSize: 9,
} as const;
const TH_HDR = { fontSize: 9, textAlign: 'center', padding: '1px 2px' } as const;
const TH_SUB = { fontSize: 9, textAlign: 'center', padding: '1px 2px' } as const;

export default function DisenosSanitarios() {
  const [edit, setEdit] = useState(false);
  const { tramosSan, updTramoSan } = useTramos();
  const { aps } = useApparatus();
  const { plans } = usePlans();

  const handleDiamChange = useCallback(
    (tramoId: string, newPulg: number) => {
      const opt = DIAM_OPTIONS.find((o) => o.pulg === newPulg);
      if (opt) {
        const res = writeDiametroToDrawing(tramoId, 'san', opt.label, plans);
        if (!res.ok && res.reason === 'accessory-larger') {
          window.dispatchEvent(
            new CustomEvent('civilflow_diametro_validation', {
              detail: {
                title: 'Diámetro no permitido',
                message: `El diámetro del ramal no puede ser menor al del accesorio conectado (${res.accessoryDiam}).`,
              },
            }),
          );
          return;
        }
        updTramoSan(tramoId, 'diamDisPulg', newPulg);
      }
    },
    [updTramoSan, plans],
  );

  const mergedBase = useMemo(() => {
    const defMap = new Map(APARATOS_DEF.map((d) => [d.id, d]));
    return SAN_UC_IDS.map((id) => {
      const fromAps = aps.find((p) => p.id === id);
      const def = defMap.get(id);
      return { id, nombre: def?.nombre || id, ud: fromAps?.ud ?? def?.ud ?? 0 };
    });
  }, [aps]);

  const displayTramos = useMemo(() => {
    return tramosSan.filter((t) => t.tipo === 'ramal' && !t.esBajante);
  }, [tramosSan]);

  const {
    orientedConexiones: conexiones,
    displayMap: conexionesDisplay,
    componentTotalMap,
  } = useMemo(
    () => buildSanConnectivity(tramosSan, plans, mergedBase),
    [plans, tramosSan, mergedBase],
  );

  // Persiste el punto de chequeo hidráulico (velocidad + relación de llenado) en cada Tramo
  // para que la insignia SANITARIA de InfTab lea un resultado real en lugar de los valores
  // por defecto permanentemente indefinidos.
  useEffect(() => {
    for (const t of displayTramos) {
      const tKey = t._key || `${t.id}-${t.piso}`;
      const idKey = t._key || t.id;
      const udAcum = componentTotalMap[tKey] || 0;
      const nSalidas = t.nSalidas ?? 0;
      const K = nSalidas > 0 ? Math.round(factorSimultaneidad(nSalidas) * 100) / 100 : null;
      const n = t.nmaning || 0.009;
      const sVal = t.sPercent ?? 0;
      const S = sVal > 0 ? sVal / 100 : null;
      const Q =
        udAcum > 0 && K != null ? Math.round(caudalHunterLPS(udAcum, K) * 1000) / 1000 : null;
      const dSel = DIAM_OPTIONS.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
      const DintMm = dSel ? dSel.mm : 0;
      let v_real = 0,
        yD = 0,
        qQ0 = 0;
      if (Q != null && Q > 0 && S != null && S > 0 && n > 0 && DintMm > 0) {
        const hc = calcHydraulicCheck({ Q, S, n, DintMm });
        v_real = hc.Vreal;
        yD = Math.round((Math.max(hc.Yc, hc.Yn) / DintMm) * 1000) / 1000;
        qQ0 = hc.qqo;
      }
      if (t.v_real !== v_real) updTramoSan(idKey, 'v_real', v_real);
      if (t.yD !== yD) updTramoSan(idKey, 'yD', yD);
      if (t.qQ0 !== qQ0) updTramoSan(idKey, 'qQ0', qQ0);
    }
  }, [displayTramos, componentTotalMap, updTramoSan]);

  function getDescendantsUD(tKey: string, visited = new Set<string>()): number {
    if (visited.has(tKey)) return 0;
    visited.add(tKey);
    const children = conexiones[tKey] || [];
    let sum = 0;
    for (const childKey of children) {
      const childTramo = tramosSan.find((x) => x._key === childKey);
      if (childTramo) {
        sum += calcUDparcial(childTramo, mergedBase) + getDescendantsUD(childKey, visited);
      }
    }
    return sum;
  }

  const totales = useMemo(
    () =>
      mergedBase.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        ud: d.ud,
        cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0),
      })),
    [mergedBase, tramosSan],
  );

  const totalUD = useMemo(
    () => totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0),
    [totales],
  );

  const sanRows = useMemo(
    () => computeSanRows(displayTramos, componentTotalMap, mergedBase),
    [displayTramos, componentTotalMap, mergedBase],
  );

  return (
    <>
      <section className="card">
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/sanitaria/RS_Diseno.webp"
              alt="Diseño red sanitaria"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            Diseño de red sanitaria
          </h3>
          <span className="card-s">
            {displayTramos.length} tramos · {totalUD} UD totales
          </span>
          <EditButton edit={edit} setEdit={setEdit} />
        </div>
        <div className="scroll-top" style={{ padding: '16px' }}>
          <div className="scroll-inner">
            <table className="tbl" style={{ fontSize: 9 }}>
              <caption style={SR_ONLY}>Diseño de red sanitaria</caption>
              <thead>
                <tr>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Tramo
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Nivel
                  </th>
                  <th
                    scope="col"
                    className="col-h san"
                    colSpan={3}
                    style={{ textAlign: 'center', fontSize: 9, padding: '1px 2px' }}
                  >
                    Unidades de descarga
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    No. Descargas
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    K
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Caudal
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Manning
                    <br />
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
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
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Q<sub>o</sub>
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    V<sub>o</sub>
                    <br />
                    <small>(m/s)</small>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Q/Q<sub>o</sub>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Velocidad real
                    <br />
                    <small>(m/s)</small>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Chequeo velocidad
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Y<sub>c</sub>
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Y<sub>n</sub>
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Froude
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Flujo
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Y<sub>max</sub>
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h" rowSpan={2} style={TH_HDR}>
                    Y<sub>n</sub> vs Y<sub>c</sub>
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
                  <th scope="col" className="col-h san" style={TH_SUB}>
                    Propia
                  </th>
                  <th scope="col" className="col-h san" style={TH_SUB}>
                    Otros
                  </th>
                  <th scope="col" className="col-h san" style={TH_SUB}>
                    Total
                  </th>
                  <th scope="col" className="col-h ok" style={TH_SUB}>
                    Calculado
                    <br />
                    <small>(")</small>
                  </th>
                  <th scope="col" className="col-h ok" style={TH_SUB}>
                    Diseño
                    <br />
                    <small>(")</small>
                  </th>
                  <th scope="col" className="col-h ok" style={TH_SUB}>
                    Interior
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th scope="col" className="col-h ven" style={TH_SUB}>
                    Real
                    <br />
                    <small>(kg/m²)</small>
                  </th>
                  <th scope="col" className="col-h ven" style={TH_SUB}>
                    &gt;0.15
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayTramos.length === 0 ? (
                  <tr>
                    <td colSpan={26} style={EMPTY_ROW}>
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    return sanRows.map((row) => {
                      const tKey = row.tKey;
                      const connectedKeys = conexionesDisplay[tKey] || [];
                      const {
                        udPropias,
                        udAcum,
                        nSalidas,
                        K,
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
                            <span className="sigla" style={{ fontSize: 9 }}>
                              {row.id}
                            </span>
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            <span
                              style={{
                                fontSize: 9,
                                fontFamily: 'var(--mono)',
                                color: 'var(--txt2)',
                              }}
                            >
                              {pisoCorto(row.piso)}
                            </span>
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {udPropias}
                          </td>
                          <td
                            className="c"
                            style={{ padding: '1px 2px', minWidth: 60, maxWidth: 120 }}
                          >
                            {connectedKeys.length === 0 ? (
                              <span style={{ fontSize: 9, color: 'var(--txt3)' }}>—</span>
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
                                {connectedKeys.map((childKey) => {
                                  const parts = childKey.split('-');
                                  const rId = parts[0];
                                  const childTramo = tramosSan.find((tr) => tr._key === childKey);
                                  const childOwnUd = childTramo
                                    ? calcUDparcial(childTramo, mergedBase)
                                    : 0;
                                  const childTotalUd = childOwnUd + getDescendantsUD(childKey);
                                  return (
                                    <span
                                      key={childKey}
                                      title={`${rId} (${childTotalUd} UD)`}
                                      style={{
                                        fontSize: 9,
                                        padding: '1px 2px',
                                        border: '1px solid var(--san)',
                                        borderRadius: 3,
                                        color: 'var(--san)',
                                        fontFamily: 'var(--mono)',
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      {rId}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td
                            className="c"
                            style={{
                              fontFamily: 'var(--mono)',
                              fontWeight: 700,
                              fontSize: 9,
                              padding: '1px 2px',
                            }}
                          >
                            {udAcum}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {nSalidas > 0 ? nSalidas : '—'}
                          </td>
                          <td
                            className="c"
                            style={{
                              fontFamily: 'var(--mono)',
                              fontWeight: 600,
                              padding: '1px 2px',
                            }}
                          >
                            {K != null ? K.toFixed(2) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{
                              fontFamily: 'var(--mono)',
                              fontWeight: 600,
                              padding: '1px 2px',
                            }}
                          >
                            {Q != null && Q > 0 ? Q.toFixed(2) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {n > 0 ? n.toFixed(3) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {sVal > 0 ? sVal : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 2px' }}
                          >
                            {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '—'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            <select
                              aria-label="Diámetro diseño"
                              value={DdisPulg || ''}
                              disabled={!edit}
                              onChange={(e) =>
                                handleDiamChange(tKey, parseFloat(e.target.value) || 0)
                              }
                              style={SanitaryDesign_S1}
                            >
                              <option value="">—</option>
                              {DIAM_OPTIONS.map((o) => (
                                <option key={o.pulg} value={o.pulg}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {DintMm > 0 ? DintMm : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {Qo > 0 ? Qo.toFixed(2) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {Vo > 0 ? Vo.toFixed(2) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {qqo > 0 ? qqo.toFixed(2) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {Vreal > 0 ? Vreal.toFixed(2) : '—'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {renderStatus(chequeoV)}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {Yc > 0 ? Yc.toFixed(2) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {Yn > 0 ? Yn.toFixed(2) : '—'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {Froude > 0 ? Froude.toFixed(2) : '—'}
                          </td>
                          <td className="c" style={{ fontSize: 9, padding: '1px 2px' }}>
                            {tipoFlujo}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {Ymax > 0 ? Ymax.toFixed(2) : '—'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {renderStatus(chequeoYn)}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {fuerzaTractiva > 0 ? fuerzaTractiva.toFixed(2) : '—'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {renderStatus(chequeoFT)}
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
