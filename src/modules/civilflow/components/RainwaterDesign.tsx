import React, { useMemo, useCallback, useEffect, useState } from 'react';
import ChipList from './shared/ChipList';
import EditButton from './shared/EditButton';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { useTramos } from '../context/TramosContext';
import { usePlans } from '../context/PlansContext';
import { renderStatus } from '../utils/componentHelpers';
import { pisoCorto, DIAM_OPTIONS, DIAM_OPTIONS_LL } from '../constants';
import { writeDiametroToDrawing, writePendienteToDrawing } from '../utils/writeDiameterToDrawing';
import { avisarDiametroInvalido } from '../utils/diametroValidation';
import { calcHydraulicCheck } from '../utils/hydraulicCheck';
import { fmt } from '../utils/formatUtils';
import { useRainwater } from '../context/RainwaterContext';
import {
  buildLlBajanteAssociations,
  computeCanalBajanteRamalKeys,
  computeLlQMap,
  computeLlRows,
  getTributarioIds,
} from '../utils/rainwaterRows';

const RainwaterDesign_S2: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11.5,
  padding: '2px 2px',
  border: '1px solid var(--line)',
  borderRadius: 2,
  background: 'var(--bg2)',
  color: 'var(--txt)',
  cursor: 'pointer',
  maxWidth: 72,
};
// Input de pendiente editable (mismo ancho/mono que el select de diámetro).
const RainwaterDesign_S3: React.CSSProperties = {
  ...RainwaterDesign_S2,
  cursor: 'text',
  textAlign: 'center',
  width: 50,
};
const TH_HDR = { fontSize: 10, textAlign: 'center', padding: '2px 3px' } as const;

export default function DisenoLluvias() {
  const [edit, setEdit] = useState(false);
  const tablaRef = useStickyThead2Offset();
  // Borrador del input de pendiente por tramo (commit en blur — mismo patrón que SanitaryDesign).
  const [editingPend, setEditingPend] = useState<Record<string, string>>({});
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
        // DOCTRINA (decisión 2026-09-24, unificada con el engine): si el ramal sube por
        // ENCIMA del bajante, el bajante AUTO-SUBE (bumpConnectedBajantes en el choke point
        // del engine / followBajanteToMaxRamal en el write) — no se bloquea. El guard que
        // había aquí contradecía ese comportamiento con una alerta.
        const res = writeDiametroToDrawing(tramoId, 'll', opt.label, plans);
        if (!res.ok && res.reason === 'accessory-larger') {
          if (
            avisarDiametroInvalido(
              `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
            )
          )
            return;
        }
        updTramoLL(tramoKey, 'diamDisPulg', newPulg);
      }
    },
    [updTramoLL, plans],
  );

  const tribIds = getTributarioIds(tramosLl);
  // Ramales canal↔bajante: conexión física del bajante al canal recolector, no colector de
  // diseño — fuera de la tabla (orig. usuario).
  const canalBajKeys = useMemo(() => computeCanalBajanteRamalKeys(plans), [plans]);
  const displayTramos = tramosLl.filter(
    (t) =>
      t._key != null &&
      !t.esBajante &&
      !tribIds.has(t._key) &&
      !tribIds.has(t.id) &&
      !canalBajKeys.has(t._key),
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

  // Piso de cada bajante (por code/id) para etiquetar los chips "Bajantes asociados" (BAN1-P1).
  const pisoByBajCode = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tramosLl) {
      if (!t.esBajante) continue;
      if (t.code) m[t.code] = t.piso;
      m[t.id] = t.piso;
    }
    return m;
  }, [tramosLl]);

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
            <table ref={tablaRef} className="tbl" style={{ fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th
                    title="Tramo de la red de aguas lluvias según el dibujo."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Tramo
                  </th>
                  <th
                    title="Punto de inicio del tramo."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Inicio
                  </th>
                  <th
                    title="Punto donde termina el tramo."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Fin
                  </th>
                  <th
                    title="Bajantes que descargan en este tramo."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Bajantes
                    <br />
                    asociados
                  </th>
                  <th
                    title="Caudal de diseño acumulado del tramo (L/s)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Caudal
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th
                    title="Rugosidad n del material de la tubería."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Manning
                  </th>
                  <th
                    title="Pendiente del tramo (%) — manda el dibujo."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Pendiente
                    <br />
                    <small>(%)</small>
                  </th>
                  <th
                    title='Diámetro del tramo: calculado, propuesto y su interior. Unidad: pulgadas (").'
                    scope="col"
                    className="col-h ok"
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      fontSize: 10,
                      padding: '2px 3px',
                      borderBottom: '2px solid var(--line)',
                    }}
                  >
                    Diámetro
                  </th>
                  <th
                    title="Capacidad máxima del diámetro propuesto (L/s)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Qo
                    <br />
                    <small>(LPS)</small>
                  </th>
                  <th
                    title="Velocidad de salida/capacidad asociada al diámetro (m/s)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Vo
                    <br />
                    <small>(m/s)</small>
                  </th>
                  <th
                    title="Uso de la capacidad: debe ser ≤ 100%."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Q/Qo
                  </th>
                  <th
                    title="Velocidad real del flujo con el diámetro propuesto (m/s)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    V. real
                    <br />
                    <small>(m/s)</small>
                  </th>
                  <th
                    title="O.K. si la velocidad está dentro del rango permitido."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Chequeo velocidad
                  </th>
                  <th
                    title="Tirante crítico del flujo (mm)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Yc
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th
                    title="Tirante normal del flujo (mm)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Yn
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th
                    title="Número de Froude del flujo (subcrítico si es menor a 1)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Froude
                  </th>
                  <th
                    title="Régimen del flujo según el número de Froude."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Flujo
                  </th>
                  <th
                    title="Altura máxima admisible del tirante (mm)."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Ymax
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th
                    title="Comparación del tirante normal contra el crítico."
                    scope="col"
                    className="col-h ll"
                    rowSpan={2}
                    style={TH_HDR}
                  >
                    Yn vs Yc
                  </th>
                  <th
                    title="Esfuerzo de arrastre sobre el tubo; debe superar el mínimo de autolimpieza."
                    scope="col"
                    className="col-h ven"
                    colSpan={2}
                    style={{
                      textAlign: 'center',
                      fontSize: 10,
                      padding: '2px 3px',
                      borderBottom: '2px solid var(--line)',
                    }}
                  >
                    Fuerza Tractiva
                  </th>
                </tr>
                <tr>
                  <th
                    title="Diámetro calculado con el caudal y la pendiente (pulg)."
                    scope="col"
                    className="col-h ok"
                    style={TH_HDR}
                  >
                    Calculado
                    <br />
                    <small>(")</small>
                  </th>
                  <th
                    title="Diámetro comercial propuesto (pulg) — editable."
                    scope="col"
                    className="col-h ok"
                    style={TH_HDR}
                  >
                    Diseño
                    <br />
                    <small>(")</small>
                  </th>
                  <th
                    title="Diámetro interior del tubo propuesto (mm)."
                    scope="col"
                    className="col-h ok"
                    style={TH_HDR}
                  >
                    Interior
                    <br />
                    <small>(mm)</small>
                  </th>
                  <th
                    title="O.K. si el diámetro propuesto cubre el calculado."
                    scope="col"
                    className="col-h ok"
                    style={TH_HDR}
                  >
                    Chequeo
                  </th>
                  <th
                    title="Fuerza tractiva real del flujo (kg/m²)."
                    scope="col"
                    className="col-h ven"
                    style={TH_HDR}
                  >
                    Real
                    <br />
                    <small>(kg/m²)</small>
                  </th>
                  <th
                    title="La fuerza tractiva debe superar 0,15 kg/m² (autolimpieza)."
                    scope="col"
                    className="col-h ven"
                    style={TH_HDR}
                  >
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
                        fontSize: 11.5,
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
                      chequeoD,
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
                        <td className="c" style={{ padding: '2px 3px' }}>
                          <span className="sigla" style={{ fontSize: 11.5 }}>
                            {id || tKey}
                            {piso != null ? `-${pisoCorto(piso)}` : ''}
                          </span>
                        </td>

                        <td className="c" style={{ padding: '2px 3px' }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontFamily: 'var(--mono)',
                              color: 'var(--txt2)',
                            }}
                          >
                            {desde || '—'}
                          </span>
                        </td>
                        <td className="c" style={{ padding: '2px 3px' }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontFamily: 'var(--mono)',
                              color: 'var(--txt2)',
                            }}
                          >
                            {hasta || '—'}
                          </span>
                        </td>
                        <td
                          className="c"
                          style={{ padding: '2px 3px', minWidth: 60, maxWidth: 120 }}
                        >
                          {(() => {
                            const associatedBajantes = bajantesAsociadas.map((c) =>
                              pisoByBajCode[c] != null ? `${c}-${pisoCorto(pisoByBajCode[c])}` : c,
                            );
                            return <ChipList items={associatedBajantes} />;
                          })()}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {Q > 0 ? Q.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {n > 0 ? n.toFixed(3) : '—'}
                        </td>
                        <td className="c" style={{ padding: '2px 2px' }}>
                          {edit ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label="Pendiente (%)"
                              value={editingPend[tKey] ?? (sVal > 0 ? fmt(sVal, 2) : '')}
                              placeholder="—"
                              onFocus={() => {
                                if (editingPend[tKey] === undefined && sVal > 0) {
                                  setEditingPend((prev) => ({ ...prev, [tKey]: fmt(sVal, 2) }));
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
                                // Coma o punto como separador decimal.
                                const v = parseFloat(String(raw).replace(/,/g, '.')) || 0;
                                setEditingPend((prev) => {
                                  const n = { ...prev };
                                  delete n[tKey];
                                  return n;
                                });
                                // Rango físico (manning/PVC): ≤0 drena mal, >15% es
                                // basura de tipeo — se rechaza y restaura el valor previo.
                                if (v <= 0 || v > 15) {
                                  if (
                                    avisarDiametroInvalido(
                                      `La pendiente debe ser mayor que 0 % y hasta 15 % (${v} % no es válido).`,
                                      'Pendiente fuera de rango',
                                    )
                                  )
                                    return;
                                }
                                writePendienteToDrawing(tKey, 'll', v, plans);
                                updTramoLL(tKey, 'sPercent', v);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              style={RainwaterDesign_S3}
                            />
                          ) : (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                              {sVal > 0 ? fmt(sVal, 2) : '—'}
                            </span>
                          )}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '—'}
                        </td>
                        <td className="c" style={{ padding: '2px 2px' }}>
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
                            {DIAM_OPTIONS_LL.map((o) => (
                              <option key={o.pulg} value={o.pulg}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
                          {DintMm > 0 ? fmt(DintMm, 2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
                          {renderStatus(chequeoD)}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {Qo > 0 ? Qo.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {Vo > 0 ? Vo.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {qqo > 0 ? qqo.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {Vreal > 0 ? Vreal.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
                          {renderStatus(chequeoV)}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {Yc > 0 ? Yc.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {Yn > 0 ? Yn.toFixed(2) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{ fontFamily: 'var(--mono)', fontSize: 11.5, padding: '2px 3px' }}
                        >
                          {Froude > 0 ? Froude.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
                          {tipoFlujo}
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
                          {Ymax > 0 ? Ymax.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
                          {renderStatus(chequeoYn)}
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
                          {fuerzaTractiva > 0 ? fuerzaTractiva.toFixed(2) : '—'}
                        </td>
                        <td className="c" style={{ fontSize: 11.5, padding: '2px 3px' }}>
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
