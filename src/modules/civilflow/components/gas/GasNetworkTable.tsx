import React from 'react';
import EditButton from '../shared/EditButton.tsx';
import EmptyRow from '../shared/EmptyRow.tsx';
import { pisoCorto } from '../../constants';
import { fmt } from '../../utils/formatUtils.ts';
import { gasTxt } from '../../constants/countryStandards';
import { listaDn } from '../../utils/gasRows.ts';
import type { FilaGasCalc } from '../../utils/gasCalcRows.ts';

// Columnas MOSTRADAS en la tabla (ped. usuario): las variantes sube/baja y el tapón
// cuentan en Le pero no aparecen como columnas.
const ACC_COLS = ['codos_90_std', 'codos_90_rl', 'te_linea', 'te_ramal', 'valvula_bola'];

// Notas descriptivas por columna del diseño de gas (tooltip en el encabezado). Material y
// diámetro son columnas separadas con desplegables propios (orig. usuario).
const GasDesign_TIPS = [
  'Tramo de la red de gas según el dibujo.',
  'Punto de inicio del tramo.',
  'Punto donde termina el tramo.',
  'Material de la tubería: define el diámetro interior y el coeficiente K. Se escribe al dibujo.',
  'Diámetro nominal del tramo según el material elegido (validado con accesorios y tramos conectados).',
  'Diámetro interior del tubo (mm), según material y diámetro.',
  'Coeficiente K del material para el cálculo.',
  'Longitud desarrollada del tramo (m).',
];

const GasDesign_COLS = [
  'Tramo',
  'Inicio',
  'Fin',
  'Material',
  'Diámetro',
  'Diámetro\ninterno',
  'Coeficiente\nK',
  'Longitud',
];

/** Tramo de gas mostrado en la tabla (lo que sale del dibujo). */
export interface TramoGasFila {
  id: string;
  planId: string | number;
  piso: number;
  ini: string;
  fin: string;
  longitud: number;
}

export interface GasTablaRedProps {
  tramos: TramoGasFila[];
  /** Fila de cálculo por clave "piso:id" (la red de gas ya resuelta). */
  checkPorClave: Map<string, FilaGasCalc>;
  diamMat: Record<string, string>;
  diamDn: Record<string, string>;
  diamK: Record<string, number>;
  diamInt: Record<string, number>;
  edit: boolean;
  setEdit: React.Dispatch<React.SetStateAction<boolean>>;
  handleMatChange: (tramoId: string, mat: string) => void;
  handleDiamChange: (tramoId: string, mat: string, dn: string) => void;
  getAcc: (t: { id: string; planId?: string | number }) => Record<string, number>;
  tablaRef: React.RefObject<HTMLTableElement | null>;
  pais: string | undefined;
}

/**
 * Tabla de diseño de gas: una fila por tramo con material, diámetro, accesorios y cálculo (Le = longitud equivalente, ΔP = pérdida de carga).
 * Ej: 6 tramos -> 6 filas con velocidad (m/s) y chequeo O.K./NO.
 */
export function GasTablaRed(props: GasTablaRedProps) {
  const {
    tramos,
    checkPorClave,
    diamMat,
    diamDn,
    diamK,
    diamInt,
    edit,
    setEdit,
    handleMatChange,
    handleDiamChange,
    getAcc,
    tablaRef,
    pais,
  } = props;
  const ALL_DN = listaDn();
  const COLS = GasDesign_COLS;
  const tramoKey = (t: { planId: string | number; id: string }): string => `${t.planId}:${t.id}`;
  return (
    <section className="gas-col card">
      <div className="gas-between card-h">
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/gas/diseno_red_gas.webp"
            alt="Diseño red de gas"
            width={20}
            height={20}
            className="gas-icon-20"
            loading="lazy"
          />
          Diseño de red de gas
        </h3>
        <div className="gas-row-auto">
          <span className="card-s">{tramos.length} tramos</span>
          <EditButton edit={edit} setEdit={setEdit} />
        </div>
      </div>
      <div className="gas-pad-6">
        <table ref={tablaRef} className="gas-net-table tbl">
          <caption className="sr-only">Diseño de red</caption>
          <thead>
            <tr>
              {COLS.map((c, i) => (
                <th
                  scope="col"
                  key={i}
                  title={GasDesign_TIPS[i]}
                  className="ds-th gas-th-105 gas-th-preline"
                  rowSpan={2}
                >
                  {c}
                </th>
              ))}
              <th
                scope="col"
                title="Factores de corrección por condiciones de la ciudad y del gas (celdas AB/AC/AD del método Renouard)."
                className="ds-th gas-th-105 gas-th-group"
                colSpan={3}
              >
                Correcciones por
              </th>
              <th scope="col" className="ds-th gas-th-105 gas-th-group" colSpan={2}>
                Consumo
              </th>
              <th
                scope="col"
                title="Accesorios instalados en el tramo (cantidad por tipo)."
                className="ds-th gas-th-105 gas-th-group"
                colSpan={ACC_COLS.length}
              >
                Accesorios
              </th>
              <th
                scope="col"
                title="Suma de longitudes equivalentes de los accesorios (m)."
                className="ds-th gas-th-105"
                rowSpan={2}
              >
                Longitud
                <br />
                equivalente
              </th>
              <th
                scope="col"
                title="Pérdida de presión del tramo (mbar)."
                className="ds-th gas-th-105"
                rowSpan={2}
              >
                {'Δ'}P
              </th>
              <th
                scope="col"
                title={`Pérdida de presión acumulada desde el inicio de la red, en mbar. Límite: ${gasTxt(pais)}.`}
                className="ds-th gas-th-105"
                rowSpan={2}
              >
                {'Δ'}P
                <br />
                acum
              </th>
              <th
                scope="col"
                title="Velocidad del gas en el tramo (m/s)."
                className="ds-th gas-th-105"
                rowSpan={2}
              >
                Velocidad
              </th>
              <th
                scope="col"
                title="Presión disponible al inicio y al final del tramo (mbar)."
                className="ds-th gas-th-105 gas-th-group"
                colSpan={2}
              >
                Presión
              </th>
              <th
                scope="col"
                title={`O.K. según ${gasTxt(pais)}.`}
                className="ds-th gas-th-105"
                rowSpan={2}
              >
                Chequeo
              </th>
            </tr>
            <tr>
              <th
                scope="col"
                title="Factor por altitud: 101.325 / presión atmosférica."
                className="ds-th gas-th-105"
              >
                Altitud
              </th>
              <th
                scope="col"
                title="Factor por temperatura: √(288 / (273 + T °C))."
                className="ds-th gas-th-105"
              >
                Temperatura
              </th>
              <th
                scope="col"
                title="Factor por densidad relativa del gas: √(0.67 / DR)."
                className="ds-th gas-th-105"
              >
                Densidad
                <br />
                relativa
              </th>
              <th
                scope="col"
                title="Consumo total del tramo por criterio Renouard (m³/h)."
                className="ds-th gas-th-105"
              >
                Total Q
                <br />
                consumo
              </th>
              <th
                scope="col"
                title="Q de diseño en m³/h: consumo corregido por los tres factores (m³/hr > 2.70 — el piso aplica a cualquier tramo)."
                className="ds-th gas-th-105"
              >
                Q de diseño
              </th>
              {['Codos 90° std', 'Codos 90° rl', 'Te en línea', 'Te ramal', 'Válvula de bola'].map(
                (lbl) => (
                  <th key={lbl} scope="col" className="ds-th gas-th-105 gas-th-10">
                    {lbl}
                  </th>
                ),
              )}
              <th
                scope="col"
                title="Presión al inicio del tramo (mbar)."
                className="ds-th gas-th-105"
              >
                Inicio
              </th>
              <th
                scope="col"
                title="Presión al final del tramo (mbar)."
                className="ds-th gas-th-105"
              >
                Fin
              </th>
            </tr>
          </thead>
          <tbody>
            {tramos.length === 0 && (
              <EmptyRow colSpan={8 + 2 + 3 + ACC_COLS.length + 7} fontSize={10.5} />
            )}
            {tramos.map((t) => {
              const chk = checkPorClave.get(tramoKey(t));
              const mat = diamMat[tramoKey(t)] || '';
              const dn = diamDn[tramoKey(t)] || '';
              const kVal = diamK[tramoKey(t)] || 0;
              const dInt = diamInt[tramoKey(t)] || 0;
              return (
                <tr key={tramoKey(t)}>
                  <td className="c gas-px-0">
                    <span className="gas-sigla sigla">
                      {t.id}
                      {t.piso != null ? `-${pisoCorto(t.piso)}` : ''}
                    </span>
                  </td>

                  <td className="c ds-td gas-td-105">{t.ini || '—'}</td>
                  <td className="c ds-td gas-td-105 gas-td-min78 c">{t.fin || '—'}</td>
                  <td className="c gas-px-0">
                    {/* Material y diámetro separados: cada uno con su desplegable. */}
                    <select
                      aria-label="Material del tramo"
                      value={mat}
                      disabled={!edit}
                      onChange={(e) => handleMatChange(tramoKey(t), e.target.value)}
                      className="ds-sd gas-sd-max104"
                    >
                      <option value="">—</option>
                      {[...new Set(ALL_DN.map((r) => r.mat))]
                        .sort((a, b) => a.localeCompare(b))
                        .map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="c gas-px-0">
                    <select
                      aria-label="Diámetro diseño"
                      value={dn}
                      disabled={!edit || !mat}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          handleDiamChange(tramoKey(t), mat, '');
                          return;
                        }
                        handleDiamChange(tramoKey(t), mat, v);
                      }}
                      className="ds-sd gas-sd-center"
                    >
                      <option value="">—</option>
                      {ALL_DN.filter((r) => r.mat === mat).map((r) => (
                        <option key={r.dn} value={r.dn}>
                          {r.dn}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`c ds-td gas-td-105${dInt ? '' : ' gas-zero'}`}>
                    {dInt ? dInt.toFixed(2) : '—'}
                  </td>
                  <td className={`c ds-td gas-td-105${kVal ? '' : ' gas-zero'}`}>
                    {kVal ? fmt(kVal, 2) : '—'}
                  </td>
                  <td className="c ds-td gas-td-105">
                    {t.longitud > 0 ? t.longitud.toFixed(2) : '—'}
                  </td>
                  {(['qConsumo', 'fAlt', 'fTemp', 'fDens', 'qDiseno'] as const).map((k) => (
                    <td
                      key={k}
                      className={`c ds-td gas-td-105${k === 'qDiseno' ? ' gas-strong-600' : ''}${
                        (chk?.[k] ?? 0) > 0 ? '' : ' gas-zero'
                      }`}
                    >
                      {(chk?.[k] ?? 0) > 0 ? (chk![k] as number).toFixed(2) : '—'}
                    </td>
                  ))}
                  {ACC_COLS.map((k) => (
                    <td key={k} className="c gas-pad-xs c">
                      <span
                        className={`gas-acc-600${
                          (getAcc({ id: t.id, planId: t.planId })[k] || 0) > 0 ? '' : ' gas-zero'
                        }`}
                      >
                        {getAcc({ id: t.id, planId: t.planId })[k] || 0}
                      </span>
                    </td>
                  ))}
                  <td className="c ds-td gas-td-105 gas-td-left-border">
                    {(chk?.le ?? 0).toFixed(2)}
                  </td>
                  <td className="c ds-td gas-td-105">{(chk?.dP ?? 0).toFixed(2)}</td>
                  <td
                    className={`c ds-td gas-td-105 gas-strong-600${
                      (chk?.dPAcum ?? 0) > 9.81 ? ' gas-td-err' : ''
                    }`}
                  >
                    {(chk?.dPAcum ?? 0).toFixed(2)}
                  </td>
                  <td className="c ds-td gas-td-105">{(chk?.vel ?? 0).toFixed(2)}</td>
                  <td className="c ds-td gas-td-105">{(chk?.pIni ?? 0).toFixed(2)}</td>
                  <td className="c ds-td gas-td-105">{(chk?.pFin ?? 0).toFixed(2)}</td>
                  <td
                    className={
                      chk?.chequeo === 'O.K.'
                        ? 'gas-td-ok'
                        : chk?.chequeo === 'NO'
                          ? 'gas-td-no'
                          : 'gas-td-dim'
                    }
                  >
                    {chk?.chequeo ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
