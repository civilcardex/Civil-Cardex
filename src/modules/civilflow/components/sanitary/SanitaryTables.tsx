/**
 * Tabla de diseño de red sanitaria: cabeceras con tooltips por columna (UD, Hunter, Manning,
 * diámetros, Froude, fuerza tractiva) y una fila por ramal con sus inputs de edición. La tabla
 * pinta EXACTAMENTE lo que pintaba SanitaryDesign inline — mismo orden de nodos y estilos.
 * Ej: fila RS1-P1 con 4 UD, K 0.8, Q 0.38 L/s, diámetro diseñado 2" y chequeo "Ok".
 */
import { renderStatus } from '../../utils/componentHelpers.tsx';
import { pisoCorto, DIAM_OPTIONS_SAN } from '../../constants';
import {
  writePendienteToDrawing,
  writeNSalidasToDrawing,
} from '../../utils/writeDiameterToDrawing.ts';
import { rangoSanTxt, ftTxt } from '../../constants/countryStandards';
import { fmt, sectorDe } from '../../utils/formatUtils.ts';
import { dec } from '../../utils/parseDecimal.ts';
import EmptyRow from '../shared/EmptyRow.tsx';
import type { SanRow } from '../../utils/sanitaryRows.ts';
import type { PlanItem } from '../../context/PlansContext.tsx';
import type { UpdTramoSan } from './useSanitaryRows.ts';

/** Props de la tabla: el modelo ya calculado (useSanitaryRows) + el estado de edición. */
export interface SanitaryTablesProps {
  tablaRef: React.RefObject<HTMLTableElement | null>;
  /** País del proyecto: solo para los tooltips de rango (velocidad / fuerza tractiva). */
  pais: string;
  /** Ramales dibujados: la tabla muestra EmptyRow cuando no hay ninguno. */
  displayTramos: unknown[];
  sanRows: SanRow[];
  conexionesDisplay: Record<string, string[]>;
  /** UD acumuladas por clave (para el título "X UD" de cada insignia "Otros"). */
  componentTotalMap: Record<string, number>;
  /** Clave de tramo -> etiqueta legible (RS1, T1RS1…). */
  keyToLabel: Map<string, string>;
  edit: boolean;
  /** Borradores de pendiente por tramo mientras se escribe en el input. */
  editingPend: Record<string, string>;
  setEditingPend: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Borradores de nº de descargas por tramo mientras se escribe en el input. */
  editingNSalidas: Record<string, string>;
  setEditingNSalidas: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updTramoSan: UpdTramoSan;
  handleDiamChange: (tramoId: string, newPulg: number) => void;
  plans: PlanItem[];
}

/** La tabla completa (thead + tbody) del diseño sanitario. */
export default function SanitaryTables({
  tablaRef,
  pais,
  displayTramos,
  sanRows,
  conexionesDisplay,
  componentTotalMap,
  keyToLabel,
  edit,
  editingPend,
  setEditingPend,
  editingNSalidas,
  setEditingNSalidas,
  updTramoSan,
  handleDiamChange,
  plans,
}: SanitaryTablesProps) {
  return (
    <div className="scroll-top san-pad-16">
      <div className="scroll-inner">
        <table ref={tablaRef} className="tbl san-fs">
          <caption className="sr-only">Diseño de red sanitaria</caption>
          <thead>
            <tr>
              <th
                title="Tramo de la red sanitaria según el dibujo (ramal o bajante)."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="6"
              >
                Tramo
              </th>
              <th
                title="Unidades de descarga (Hunter) que acumula el tramo."
                scope="col"
                className="san-th-grupo col-h san"
                colSpan={3}
              >
                Unidades de descarga
              </th>
              <th
                title="Descargas simultáneas esperadas en el tramo."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="6"
              >
                descargas
                <br />
                simultaneas
              </th>
              <th
                title="Coeficiente de simultaneidad K aplicado al cálculo del caudal."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="3"
              >
                K
              </th>
              <th
                title="Caudal de diseño del tramo (L/s). Unidad: L/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Caudal
              </th>
              <th
                title="Rugosidad n del material de la tubería."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Manning
              </th>
              <th
                title="Pendiente de diseño del tramo (%) — manda el dibujo. Unidad: porcentaje (%)."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Pendiente
              </th>
              <th
                title={
                  'Diámetro del tramo: calculado, propuesto y su interior. Unidad: pulgadas (").'
                }
                scope="col"
                className="san-th-grupo col-h ok"
                colSpan={4}
              >
                Diámetro
              </th>
              <th
                title="Capacidad máxima del diámetro propuesto (L/s). Unidad: L/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="4.5"
              >
                Q<sub>o</sub>
              </th>
              <th
                title="Velocidad de salida/capacidad asociada al diámetro (m/s). Unidad: m/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="4.5"
              >
                V<sub>o</sub>
              </th>
              <th
                title="Uso de la capacidad: debe ser ≤ 100%."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="4.5"
              >
                Q/Q<sub>o</sub>
              </th>
              <th
                title="Velocidad real del flujo con el diámetro propuesto (m/s). Unidad: m/s."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Velocidad real
              </th>
              <th
                title={`O.K. si la velocidad está dentro del rango permitido: ${rangoSanTxt(pais)}.`}
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Chequeo velocidad
              </th>
              <th
                title="Tirante crítico del flujo (mm). Unidad: mm."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Y<sub>c</sub>
              </th>
              <th
                title="Tirante normal del flujo (mm). Unidad: mm."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Y<sub>n</sub>
              </th>
              <th
                title="Número de Froude del flujo (subcrítico si es menor a 1)."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Froude
              </th>
              <th
                title="Régimen del flujo según el número de Froude."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="6"
              >
                Flujo
              </th>
              <th
                title="Altura máxima admisible del tirante (mm). Unidad: mm."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
                data-w="5"
              >
                Y<sub>max</sub>
              </th>
              <th
                title="Comparación del tirante normal contra el crítico."
                scope="col"
                className="san-th col-h"
                rowSpan={2}
              >
                Y<sub>n</sub> vs Y<sub>c</sub>
              </th>
              <th
                title="Esfuerzo de arrastre sobre el tubo; debe superar el mínimo de autolimpieza."
                scope="col"
                className="san-th-grupo col-h ven"
                colSpan={2}
              >
                Fuerza Tractiva
              </th>
            </tr>
            <tr>
              <th
                title="Unidades de descarga generadas en el propio tramo."
                scope="col"
                className="col-h san san-th-sub"
              >
                Propia
              </th>
              <th
                title="Unidades de descarga que llegan de tramos conectados aguas arriba."
                scope="col"
                className="col-h san san-th-sub"
              >
                Otros
              </th>
              <th
                title="Unidades de descarga acumuladas del tramo."
                scope="col"
                className="col-h san san-th-sub"
              >
                Total
              </th>
              <th
                title='Diámetro calculado con el caudal y la pendiente (pulg). Unidad: pulgadas (").'
                scope="col"
                className="col-h ok san-th-sub"
              >
                Calculado
              </th>
              <th
                title='Diámetro comercial propuesto (pulg) — editable. Unidad: pulgadas (").'
                scope="col"
                className="col-h ok san-th-sub"
              >
                Diseño
              </th>
              <th
                title="Diámetro interior del tubo propuesto (mm). Unidad: mm."
                scope="col"
                className="col-h ok san-th-sub"
              >
                Interior
              </th>
              <th
                title="O.K. si el diámetro propuesto cubre el calculado."
                scope="col"
                className="col-h ok san-th-sub"
              >
                Chequeo
              </th>
              <th
                title="Fuerza tractiva real del flujo (kg/m²). Unidad: kg/m²."
                scope="col"
                className="col-h ven san-th-sub"
              >
                Real
              </th>
              <th
                title={`La fuerza tractiva debe superar ${ftTxt(pais)} (autolimpieza).`}
                scope="col"
                className="col-h ven san-th-sub"
              >
                &gt;0.15
              </th>
            </tr>
          </thead>
          <tbody>
            {displayTramos.length === 0 ? (
              <EmptyRow colSpan={25} fontSize={10.5} />
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
                      <td className="c san-pad">
                        <span className="sigla san-fs">
                          {/* Tramo + piso (orig. usuario): etiqueta tipo row-P1. */}
                          {row.id}
                          {row.piso != null ? `-${pisoCorto(row.piso)}` : ''}
                        </span>
                      </td>

                      <td className="c san-pad san-mono">{udPropias}</td>
                      <td className="c san-td-minmax">
                        {connectedKeys.length === 0 ? (
                          <span className="san-muted">—</span>
                        ) : (
                          <div className="san-connected">
                            {connectedKeys.map((childKey) => {
                              const rId = keyToLabel.get(childKey) || sectorDe(childKey);
                              const childTotalUd = componentTotalMap[childKey] ?? 0;
                              return (
                                <span
                                  key={childKey}
                                  title={`${rId} (${childTotalUd} UD)`}
                                  className="san-badge"
                                >
                                  {rId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="san-mono-700 c">{udAcum}</td>
                      <td className="c san-pad">
                        {edit ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              editingNSalidas[tKey] !== undefined
                                ? editingNSalidas[tKey]
                                : nSalidas > 0
                                  ? String(nSalidas)
                                  : ''
                            }
                            placeholder="—"
                            onFocus={() => {
                              if (editingNSalidas[tKey] === undefined && nSalidas > 0) {
                                setEditingNSalidas((prev) => ({
                                  ...prev,
                                  [tKey]: String(nSalidas),
                                }));
                              }
                            }}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              setEditingNSalidas((prev) => ({ ...prev, [tKey]: raw }));
                            }}
                            onBlur={(e) => {
                              const raw =
                                editingNSalidas[tKey] !== undefined
                                  ? editingNSalidas[tKey]
                                  : e.target.value;
                              const v = parseInt(String(raw), 10) || 1;
                              const clamped = Math.max(1, v);
                              setEditingNSalidas((prev) => {
                                const n = { ...prev };
                                delete n[tKey];
                                return n;
                              });
                              updTramoSan(tKey, 'nSalidas', clamped);
                              writeNSalidasToDrawing(tKey, 'san', clamped, plans);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            className="san-input san-input-w52"
                          />
                        ) : nSalidas > 0 ? (
                          <span className="san-mono">{nSalidas}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="san-mono-600 c">{K != null ? K.toFixed(2) : '—'}</td>
                      <td className="san-mono-600 c">{Q != null && Q > 0 ? Q.toFixed(2) : '—'}</td>
                      <td className="c san-pad san-mono">{n > 0 ? n.toFixed(3) : '—'}</td>
                      <td className="c san-pad">
                        {edit ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              editingPend[tKey] !== undefined
                                ? editingPend[tKey]
                                : sVal > 0
                                  ? fmt(sVal, 2)
                                  : ''
                            }
                            placeholder="—"
                            onFocus={() => {
                              if (editingPend[tKey] === undefined && sVal > 0) {
                                setEditingPend((prev) => ({
                                  ...prev,
                                  [tKey]: fmt(sVal, 2),
                                }));
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
                              const v = dec(String(raw));
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
                            className="san-input san-input-w50"
                          />
                        ) : sVal > 0 ? (
                          fmt(sVal, 2)
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="san-pad san-mono san-fs c">
                        {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '--'}
                      </td>
                      <td className="c san-pad">
                        <select
                          aria-label="Diámetro diseño"
                          value={DdisPulg || ''}
                          disabled={!edit}
                          onChange={(e) => handleDiamChange(tKey, parseFloat(e.target.value) || 0)}
                          className="san-input"
                        >
                          <option value="">—</option>
                          {DIAM_OPTIONS_SAN.map((o) => (
                            <option key={o.pulg} value={o.pulg}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="c san-pad">
                        {DdisPulg > 0 && DintMm > 0 ? fmt(DintMm, 2) : '--'}
                      </td>
                      <td className="c san-pad">
                        {DdisPulg > 0
                          ? DcalcPulg > 0
                            ? renderStatus(DcalcPulg <= DdisPulg ? 'Ok' : 'No cumple')
                            : renderStatus('No cumple')
                          : renderStatus('No cumple')}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && Qo > 0 ? Qo.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && Vo > 0 ? Vo.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && qqo > 0 ? qqo.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && Vreal > 0 ? Vreal.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad">
                        {DdisPulg > 0 ? renderStatus(chequeoV) : 'No cumple'}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && Yc > 0 ? Yc.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && Yn > 0 ? Yn.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && Froude > 0 ? Froude.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad san-fs">{DdisPulg > 0 ? tipoFlujo : '--'}</td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && Ymax > 0 ? Ymax.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad">
                        {DdisPulg > 0 ? renderStatus(chequeoYn) : 'No cumple'}
                      </td>
                      <td className="c san-pad san-mono">
                        {DdisPulg > 0 && fuerzaTractiva > 0 ? fuerzaTractiva.toFixed(2) : '--'}
                      </td>
                      <td className="c san-pad">
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
  );
}
