import { useMemo, useCallback, useEffect, useState } from 'react';
import EditButton from './shared/EditButton';
import { useTramos } from '../context/TramosContext';
import { useApparatus } from '../context/ApparatusContext';
import { usePlans } from '../context/PlansContext';
import { renderStatus } from '../utils/componentHelpers';
import { pisoCorto, DIAM_OPTIONS, SAN_UC_IDS, APARATOS_DEF } from '../constants';
import { caudalHunterLPS, factorSimultaneidad } from '../utils/calcSanitaryCore';
import { writeDiametroToDrawing, writePendienteToDrawing } from '../utils/writeDiameterToDrawing';
import {
  INODORO_APP_ID,
  sanDiamAllowedForApparatus,
  SAN_INODORO_MIN_MSG,
} from '../utils/sanitaryDiamCompat';
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
  const [editingPend, setEditingPend] = useState<Record<string, string>>({});
  const { tramosSan, updTramoSan } = useTramos();
  const { aps } = useApparatus();
  const { plans } = usePlans();

  const handleDiamChange = useCallback(
    (tramoId: string, newPulg: number) => {
      const opt = DIAM_OPTIONS.find((o) => o.pulg === newPulg);
      if (opt) {
        // Ítem 6/7/8: regla central (inodoro → 4" mínimo). Bloqueo directo en UI sin esperar al write.
        if (newPulg > 0 && !sanDiamAllowedForApparatus(newPulg, INODORO_APP_ID)) {
          const ramalId = tramoId.split('-')[0];
          const planId = tramoId.split('-')[1] || '';
          const key = `san_${ramalId}_${planId}`;
          try {
            const counts = JSON.parse(
              localStorage.getItem('civilflow_aparatos_by_tramo_v2') || '{}',
            );
            if ((counts[key]?.['san'] || 0) > 0) {
              window.dispatchEvent(
                new CustomEvent('civilflow_diametro_validation', {
                  detail: {
                    title: 'Diámetro no permitido',
                    message: SAN_INODORO_MIN_MSG,
                  },
                }),
              );
              return;
            }
          } catch (_e) {
            void _e;
          }
        }
        const res = writeDiametroToDrawing(tramoId, 'san', opt.label, plans);
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

  const { displayMap: conexionesDisplay, componentTotalMap } = useMemo(
    () => buildSanConnectivity(tramosSan, plans, mergedBase),
    [plans, tramosSan, mergedBase],
  );

  // ponytail: readable label (RS1, T1RS1...) for "Otros" badges — not raw tributario ids (T1780...)
  const keyToLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tramosSan) {
      const k = t._key || `${t.id}-${t.piso}`;
      m.set(k, t.label || t.id);
    }
    return m;
  }, [tramosSan]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span className="card-s">
              {displayTramos.length} tramos · {totalUD} UD totales
            </span>
            <EditButton edit={edit} setEdit={setEdit} />
          </div>
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
                    colSpan={4}
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
                  <th scope="col" className="col-h ok" style={TH_SUB}>
                    Chequeo
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
                                  const rId = keyToLabel.get(childKey) || childKey.split('-')[0];
                                  const childTotalUd = componentTotalMap[childKey] ?? 0;
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
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {edit ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  editingPend[tKey] !== undefined
                                    ? editingPend[tKey]
                                    : sVal > 0
                                      ? String(sVal)
                                      : ''
                                }
                                placeholder="—"
                                onFocus={() => {
                                  if (editingPend[tKey] === undefined && sVal > 0) {
                                    setEditingPend((prev) => ({ ...prev, [tKey]: String(sVal) }));
                                  }
                                }}
                                onChange={(e) => {
                                  const raw = e.target.value
                                    .replace(/,/g, '.')
                                    .replace(/[^0-9.]/g, '')
                                    .replace(/(\..*)\./g, '$1');
                                  setEditingPend((prev) => ({ ...prev, [tKey]: raw }));
                                }}
                                onBlur={(e) => {
                                  const raw =
                                    editingPend[tKey] !== undefined
                                      ? editingPend[tKey]
                                      : e.target.value;
                                  const v = parseFloat(String(raw).replace(/,/g, '.')) || 0;
                                  setEditingPend((prev) => {
                                    const n = { ...prev };
                                    delete n[tKey];
                                    return n;
                                  });
                                  writePendienteToDrawing(tKey, 'san', v, plans);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                style={{
                                  ...SanitaryDesign_S1,
                                  width: 50,
                                  textAlign: 'center',
                                }}
                              />
                            ) : sVal > 0 ? (
                              sVal
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 2px' }}
                          >
                            {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '--'}
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
                            {DdisPulg > 0 && DintMm > 0 ? DintMm : '--'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {DdisPulg > 0
                              ? DcalcPulg > 0
                                ? renderStatus(DcalcPulg <= DdisPulg ? 'Ok' : 'No cumple')
                                : renderStatus('No cumple')
                              : renderStatus('No cumple')}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && Qo > 0 ? Qo.toFixed(2) : '--'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && Vo > 0 ? Vo.toFixed(2) : '--'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && qqo > 0 ? qqo.toFixed(2) : '--'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && Vreal > 0 ? Vreal.toFixed(2) : '--'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {DdisPulg > 0 ? renderStatus(chequeoV) : 'No cumple'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && Yc > 0 ? Yc.toFixed(2) : '--'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && Yn > 0 ? Yn.toFixed(2) : '--'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && Froude > 0 ? Froude.toFixed(2) : '--'}
                          </td>
                          <td className="c" style={{ fontSize: 9, padding: '1px 2px' }}>
                            {DdisPulg > 0 ? tipoFlujo : '--'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && Ymax > 0 ? Ymax.toFixed(2) : '--'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {DdisPulg > 0 ? renderStatus(chequeoYn) : 'No cumple'}
                          </td>
                          <td
                            className="c"
                            style={{ fontFamily: 'var(--mono)', padding: '1px 2px' }}
                          >
                            {DdisPulg > 0 && fuerzaTractiva > 0 ? fuerzaTractiva.toFixed(2) : '--'}
                          </td>
                          <td className="c" style={{ padding: '1px 2px' }}>
                            {DdisPulg > 0 ? renderStatus(chequeoFT) : 'No cumple'}
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
