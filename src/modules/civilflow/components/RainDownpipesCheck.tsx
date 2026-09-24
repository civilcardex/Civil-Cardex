import { useMemo } from 'react';
import { useRainwater, type BajanteLL } from '../context/RainwaterContext';
import { useTramos } from '../context/TramosContext';
import EditButton from './shared/EditButton';
import { writeBajantePropToDrawing } from '../utils/writeDiameterToDrawing';
import {
  buildLlBajanteAssociations,
  computeCanalBajanteRamalKeys,
  maxRamalPulgDeBajante,
} from '../utils/rainwaterRows';
import ChipList from './shared/ChipList';
import { usePlans } from '../context/PlansContext';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { chequeoBajanteLluvia } from '../utils/calcRainwater';
import { renderStatus } from '../utils/componentHelpers';
import { parseDescargaEnId } from '../utils/parseDescargaEnId';
import { DIAM_BAN, pisoCorto } from '../constants';
import { trunc2 } from '../utils/formatUtils';
import React from 'react';
import { parseDecimalInput } from '../utils/parseDecimal';
import type { DrawingData } from '../utils/drawingSync';

interface Row {
  key: string;
  bajante: string;
  areaParcial: number;
  /** Área Otras (orig. usuario): editable, default 0. */
  areaOtras: number;
  /** TOTAL = areaParcial + areaOtras — alimenta el caudal. */
  areaAcum: number;
  intensidad: number;
  coeficienteC: number;
  R: string;
  manning: number;
  diamPropuesto: number;
  /** Bajante del dibujo (fila d_): escritura bidireccional de Llenado al trazado. */
  drawId?: string;
  drawPlanId?: string;
  nivel: string;
  asociadosSup: string[];
  ramalesAsoc: string[];
}
const RainDownpipesCheck_S1: React.CSSProperties = {
  width: 56,
  padding: '2px 4px',
  background: 'var(--bg2)',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt)',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  textAlign: 'center',
};

// Área Otras (orig. usuario): SIEMPRE editable — estado local de texto con commit en blur.
// (Un input controlado con value fijo + onChange no-op congela la tipografía: no se podía
// borrar el 0.)
const OtrasField = React.memo(function OtrasField({
  rowKey,
  bajante,
  value,
  onCommit,
  disabled = false,
}: {
  rowKey: string;
  bajante: string;
  value: number;
  onCommit: (bajante: string, v: number) => void;
  /** Edición gated por el botón EDITAR de la tabla. */
  disabled?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const display = editing ? text : String(value ?? 0);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      aria-label="Área otras"
      key={rowKey + '_otras'}
      disabled={disabled}
      onFocus={() => {
        setEditing(true);
        // Al enfocar un 0 el campo arranca vacío: no hay que "quitar el 0" a mano.
        setText(value > 0 ? String(value) : '');
      }}
      onChange={(e) => {
        setText(e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        setEditing(false);
        // Área física: negativo = basura de tipeo (I·C·A negativo aguas abajo).
        const v = Math.max(0, parseFloat(text) || 0);
        if (bajante) onCommit(bajante, v);
      }}
      style={{ ...RainDownpipesCheck_S1, opacity: disabled ? 0.6 : 1 }}
    />
  );
});

export default function ChequeoBajantesLluvias() {
  const [edit, setEdit] = React.useState(false);
  const { bajantesLl, updBajanteLL } = useRainwater();
  const { tramosLl, updTramoLL } = useTramos();
  const { plans } = usePlans();

  // Las CAJAS de aguas lluvias (CALL, tipo caja_ll) no son bajantes: fuera de la tabla.
  const drawingBajantes = useMemo(() => {
    return tramosLl.filter(
      (t) =>
        t.esBajante &&
        !String(t.code ?? '').startsWith('CALL') &&
        !String(t.id ?? '').startsWith('CALL'),
    );
  }, [tramosLl]);

  const areaDibujoMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data: DrawingData = raw as DrawingData;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      for (const b of data.bajantes || []) {
        if (b.net === 'll' && b.tipo !== 'canal' && b.area_m2) {
          map[b.code || b.id] = b.area_m2;
          map[b.id] = b.area_m2;
        }
      }
    }
    return map;
  }, [plans]);

  // (areaAcumMap del total dibujado del piso retirado — orig. usuario: TOTAL = Parcial + Otras,
  // sin fallback al total del piso; el área que no sea la del dibujo se escribe en Otras.)

  // Bajantes del piso superior que descargan en cada bajante: el bajante superior deja
  // descargaEnId = "planId|id" apuntando al inferior (asociación entre pisos) — un escaneo de
  // todos los pisos construye el mapa inverso.
  const uppersByBajante = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data: DrawingData = raw as DrawingData;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      const suf = pisoCorto(plan.nivel);
      for (const b of data.bajantes || []) {
        // Cajas CALL fuera: no son bajantes asociados (glifo de captura).
        if (b.net !== 'll' || b.tipo === 'caja_ll' || !b.descargaEnId) continue;
        // Formato canónico 'plan|id'; el LEGACY sin '|' apunta al MISMO plan — sin
        // normalizarlo la columna "asociados" quedaba en — para esos datos viejos.
        const [dPlan, dId] = parseDescargaEnId(b.descargaEnId, plan.id);
        const clave = `${dPlan}|${dId}`;
        if (!map[clave]) map[clave] = [];
        const code = `${b.code || b.id}-${suf}`;
        if (!map[clave].includes(code)) map[clave].push(code);
      }
    }
    return map;
  }, [plans]);

  // Ramales asociados a cada bajante: misma BFS que Diseño de red lluvias, invertida
  // (clave de bajante → ids de ramales que le drenan).
  const bajanteAssociations = useMemo(
    () => buildLlBajanteAssociations(tramosLl, plans),
    [tramosLl, plans],
  );
  // Ramales de/descargando al canal: nunca son "ramales asociados" de un bajante.
  const canalRamalKeys = useMemo(() => computeCanalBajanteRamalKeys(plans), [plans]);

  const ramalesByBajante = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [ramalKey, codes] of Object.entries(bajanteAssociations)) {
      const [ramalId, planId] = ramalKey.split('-');
      // Piso del ramal (de su plano) → etiqueta "RS1-P1" en el chip.
      const nivel = plans?.find((pl) => String(pl.id) === planId)?.nivel;
      const label = nivel != null ? `${ramalId}-${pisoCorto(nivel)}` : ramalId;
      // Ramal de canal: fuera.
      if (canalRamalKeys.has(ramalKey)) continue;
      for (const code of codes) {
        const t = tramosLl.find((x) => x.esBajante && (x.code === code || x.id === code));
        const k = t?._key;
        if (!k) continue;
        // Solo ramales del MISMO piso del bajante (orig. usuario).
        if (String(t.planId ?? '') !== planId) continue;
        if (!map[k]) map[k] = [];
        if (!map[k].includes(label)) map[k].push(label);
      }
    }
    return map;
  }, [bajanteAssociations, tramosLl, plans, canalRamalKeys]);

  const rows = useMemo(() => {
    const manualMap = new Map<string, BajanteLL>();
    for (const m of bajantesLl) {
      const key = m.bajante || m.id;
      manualMap.set(key, m);
    }

    const usedManual = new Set<string>();
    const out: Row[] = [];

    for (const d of drawingBajantes) {
      const code = d.code || d.id;
      const manual = manualMap.get(code) || manualMap.get(d.id);
      if (manual) usedManual.add(manual.bajante || manual.id);
      const areaDib = areaDibujoMap[code] || areaDibujoMap[d.id] || 0;
      // Parcial = área asociada al bajante en el dibujo; Otras = editable (default 0);
      // TOTAL = Parcial + Otras alimenta el caudal (orig. usuario).
      const areaParcial = areaDib || d.area_m2 || manual?.areaParcial || 0;
      const areaOtras = manual?.areaOtras ?? 0;
      const areaAcum = areaParcial + areaOtras;
      const rVal = d.bajR != null ? (Math.abs(d.bajR - 0.25) < 0.001 ? '1/4' : '7/24') : '7/24';
      out.push({
        key: 'd_' + d.id + '_' + d.piso,
        bajante: code,
        drawId: d.id,
        drawPlanId: String(d.planId ?? ''),
        nivel: pisoCorto(d.piso),
        asociadosSup: uppersByBajante[`${d.planId}|${d.id}`] ?? [],
        ramalesAsoc: ramalesByBajante[`${d.id}-${d.planId}`] ?? [],
        areaParcial,
        areaOtras,
        areaAcum,
        intensidad: manual?.intensidad ?? 100,
        coeficienteC: 0.0278,
        R: rVal,
        manning: 0.009,
        diamPropuesto: d.diamDisPulg || 0,
      });
    }

    for (const m of bajantesLl) {
      const key = m.bajante || m.id;
      if (usedManual.has(key)) continue;
      const bajDib = drawingBajantes.find((d) => d.code === m.bajante || d.id === m.bajante);
      const areaDib = areaDibujoMap[m.bajante] || 0;
      const areaParcial = areaDib || bajDib?.area_m2 || m.areaParcial || 0;
      const areaOtras = m.areaOtras ?? 0;
      const areaAcum = areaParcial + areaOtras;
      out.push({
        key: 'm_' + m.id,
        bajante: m.bajante || m.id,
        nivel: '—',
        asociadosSup: [],
        ramalesAsoc: [],
        areaParcial,
        areaOtras,
        areaAcum,
        intensidad: m.intensidad ?? 100,
        coeficienteC: 0.0278,
        R: m.R,
        manning: 0.009,
        diamPropuesto: m.diamPropuesto,
      });
    }

    return out;
  }, [drawingBajantes, bajantesLl, areaDibujoMap, uppersByBajante, ramalesByBajante]);

  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/aguas_lluvias/RALL_Chequeo_bajantes.webp"
            alt="Chequeo bajantes"
            width={24}
            height={24}
            style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />{' '}
          Chequeo capacidad bajantes aguas lluvias
        </h3>
        <div style={{ marginLeft: 'auto' }}>
          <EditButton edit={edit} setEdit={setEdit} />
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        <table
          className="tbl"
          style={{ fontSize: 11, tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Bajante
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Nivel
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Bajantes
                <br />
                asociados
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Ramales asociados
              </th>
              <th
                scope="col"
                className="col-h ll"
                colSpan={3}
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Área (m²)
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Intensidad (I)
                <br />
                <small>mm/hr</small>
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Coeficiente
                <br />
                Escorrentía
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Llenado
                <br />
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Q = C×I×A
                <br />
                <small>(LPS)</small>
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Manning
                <br />
              </th>
              <th
                scope="col"
                className="col-h ok"
                colSpan={2}
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Diámetro (")
              </th>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Chequeo
                <br />
                Dcal &lt; Dprop
              </th>
            </tr>
            <tr>
              <th
                scope="col"
                className="col-h ll"
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Parcial
              </th>
              <th
                scope="col"
                className="col-h ll"
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Otras
              </th>
              <th
                scope="col"
                className="col-h ll"
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Total
              </th>
              <th
                scope="col"
                className="col-h ok"
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Calculado
              </th>
              <th
                scope="col"
                className="col-h ok"
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Propuesto
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={15}
                  style={{
                    padding: '24px 0',
                    textAlign: 'center',
                    color: 'var(--txt3)',
                    fontSize: 11,
                  }}
                >
                  No hay bajantes de lluvias definidos. Dibuje bajantes en el plano o agréguelos en
                  el panel de entrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const {
                  Q,
                  dCalc: diamCalc,
                  chequeo,
                } = chequeoBajanteLluvia({
                  ...row,
                  coeficienteC: 0.0278,
                  areaAcumulada: row.areaAcum || 0,
                });
                return (
                  <tr key={row.key}>
                    <td className="c">
                      <span className="sigla" style={{ fontSize: 11 }}>
                        {row.bajante || '—'}
                      </span>
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{row.nivel}</span>
                    </td>
                    <td className="c">
                      <ChipList items={row.asociadosSup} />
                    </td>
                    <td className="c">
                      <ChipList items={row.ramalesAsoc} />
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {row.areaParcial > 0 ? trunc2(row.areaParcial) : '—'}
                      </span>
                    </td>
                    <td className="c">
                      {/* Otras (orig. usuario): editable siempre, default 0 — nunca vacía. */}
                      <OtrasField
                        rowKey={row.key}
                        bajante={row.bajante}
                        value={row.areaOtras ?? 0}
                        onCommit={(baj, v) => updBajanteLL(baj, 'areaOtras', v)}
                        disabled={!edit}
                      />
                    </td>
                    <td className="c">
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {row.areaAcum > 0 ? trunc2(row.areaAcum) : '—'}
                      </span>
                    </td>
                    <td className="c">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.intensidad ?? 100}
                        aria-label="Intensidad (I)"
                        disabled={!edit}
                        key={row.key + '_in'}
                        onChange={() => {}}
                        onBlur={(e) => {
                          const v = Math.max(0, parseDecimalInput(e.target.value) ?? 100);
                          if (row.bajante) {
                            updBajanteLL(row.bajante, 'intensidad', v);
                          }
                        }}
                        style={{ ...RainDownpipesCheck_S1, opacity: edit ? 1 : 0.6 }}
                      />
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>0.0278</span>
                    </td>
                    <td className="c">
                      <select
                        value={row.R || '7/24'}
                        aria-label="Llenado (R)"
                        disabled={!edit}
                        onChange={(e) => {
                          const label = e.target.value;
                          const num = label === '1/4' ? 0.25 : 7 / 24;
                          // Bidireccional: escribe el bajante del dibujo (engine vivo o storage)
                          // y refleja en el tramo + entrada manual del contexto.
                          if (row.drawId) {
                            writeBajantePropToDrawing(
                              `${row.drawId}-${row.drawPlanId}`,
                              'll',
                              'bajR',
                              num,
                              plans,
                            );
                            updTramoLL(`${row.drawId}-${row.drawPlanId}`, 'bajR', num);
                          }
                          updBajanteLL(row.bajante, 'R', label);
                        }}
                        style={{
                          ...RainDownpipesCheck_S1,
                          opacity: edit ? 1 : 0.6,
                          cursor: edit ? 'pointer' : 'default',
                        }}
                      >
                        <option value="7/24">7/24</option>
                        <option value="1/4">1/4</option>
                      </select>
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11 }}
                    >
                      {Q > 0 ? trunc2(Q) : '—'}
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                        {row.manning || '—'}
                      </span>
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 11 }}
                    >
                      {diamCalc > 0 ? trunc2(diamCalc) : '—'}
                    </td>
                    <td className="c">
                      <select
                        value={DIAM_BAN.find((d) => d.pulg === row.diamPropuesto)?.nom ?? ''}
                        aria-label="Diámetro propuesto"
                        disabled={!edit}
                        onChange={(e) => {
                          const nom = e.target.value;
                          const opt = DIAM_BAN.find((d) => d.nom === nom);
                          // Regla ll: el bajante no puede quedar menor que sus ramales conectados.
                          if (opt && row.drawId) {
                            const maxRamal = maxRamalPulgDeBajante(
                              row.drawId,
                              String(row.drawPlanId ?? ''),
                              tramosLl,
                            );
                            if (maxRamal > 0 && opt.pulg < maxRamal) {
                              window.dispatchEvent(
                                new CustomEvent('civilflow_diametro_validation', {
                                  detail: {
                                    title: 'Diámetro no permitido',
                                    message: `El diámetro del bajante no puede ser menor al de los ramales conectados (máximo ${maxRamal}"). Sube primero el diámetro de los ramales o selecciona un bajante mayor.`,
                                  },
                                }),
                              );
                              return;
                            }
                          }
                          // Bidireccional (orig. usuario): escribe el dNominal del bajante en el
                          // dibujo (engine vivo o storage) y refleja el pulg en el tramo.
                          if (row.drawId && opt) {
                            writeBajantePropToDrawing(
                              `${row.drawId}-${row.drawPlanId}`,
                              'll',
                              'dNominal',
                              nom,
                              plans,
                            );
                            updTramoLL(`${row.drawId}-${row.drawPlanId}`, 'diamDisPulg', opt.pulg);
                          }
                        }}
                        style={{
                          ...RainDownpipesCheck_S1,
                          opacity: edit ? 1 : 0.6,
                          cursor: edit ? 'pointer' : 'default',
                        }}
                      >
                        <option value="">—</option>
                        {DIAM_BAN.map((d) => (
                          <option key={d.pulg} value={d.nom}>
                            {d.nom}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="c" style={{ fontSize: 11 }}>
                      {renderStatus(chequeo)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
