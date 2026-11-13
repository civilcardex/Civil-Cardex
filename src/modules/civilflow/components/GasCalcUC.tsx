/** Tabla de Q (Caudal) de gas por ramal en m³/h: suma de aparatos con su caudal y factor de
 *  simultaneidad, base del dimensionamiento por Renouard (fórmula de pérdida en gas).
 *  Ej: RG1 con 2 estufas + 1 calentador -> Q del ramal y su diámetro propuesto. */
import React, { useMemo } from 'react';
import { usePlans } from '../context/PlansContext.tsx';
import { loadFromStorage } from '../services/storageService.ts';

import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys.ts';
import { GAS_APPARATUS, renouardByType } from '../utils/gasUtils.ts';
import { pisoCorto } from '../constants';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import type { DrawingData } from '../utils/drawingSync.ts';

const ABREV = {
  est4: 'EST-4Q',
  est2: 'EST-2Q',
  hor_g: 'HOR-G',
  hor_m: 'HOR-M',
  hor_p: 'HOR-P',
  sec_g: 'SEC-G',
  sec_p: 'SEC-P',
  cal6: 'CAL-6',
  cal11: 'CAL-11',
  cal21: 'CAL-21',
  jac: 'JAC',
  pisc: 'C-PSC',
  sauna: 'SAU',
  turco: 'TUR',
  calp: 'CAL-P',
};

function GasCalcUC() {
  const { plans } = usePlans();
  const tablaRef = useStickyThead2Offset();

  const { tramos, totalByAp, tramoTotals, tramoAppCounts } = useMemo(() => {
    const aparatos: Record<string, Record<string, number>> = loadFromStorage(
      APARATOS_BY_TRAMO_KEY,
      {},
    );
    const tramosMap: Record<
      string,
      {
        id: string;
        piso: number | string;
        ini: string;
        fin: string;
        counts: Record<string, number>;
      }
    > = {};

    for (const plano of plans) {
      if (!plano || plano.status !== 'confirmed' || plano.nivel == null) continue;
      const data = loadFromStorage<DrawingData | null>(TRAZOS_PREFIX + plano.id, null);
      if (!data) continue;

      for (const r of data.ramales || []) {
        if (r.net !== 'gas') continue;
        const pid = plano.id ? String(plano.id) : '';
        const key = `gas_${r.id}`;
        const keyPid = pid ? `gas_${r.id}_${pid}` : '';
        const counts = aparatos[keyPid] || aparatos[key] || {};
        const hasData = Object.values(counts).some((v) => (Number(v) || 0) > 0);
        if (!hasData) continue;

        // Clave por (ramal, plano): el MISMO id de ramal existe en varios pisos —
        // fusionarlos sumaba aparatos de pisos distintos en una sola fila.
        const rowKey = `${r.id}_${pid}`;
        if (!tramosMap[rowKey]) {
          tramosMap[rowKey] = {
            id: r.id,
            piso: r.piso ?? '',
            ini: r.ini || '',
            fin: r.fin || '',
            counts: {},
          };
        }
        for (const ap of GAS_APPARATUS) {
          const n = Number(counts[ap.id]) || 0;
          if (n > 0) tramosMap[rowKey].counts[ap.id] = (tramosMap[rowKey].counts[ap.id] || 0) + n;
        }
      }
    }

    const tramos = Object.values(tramosMap).sort(
      (a, b) => (Number(a.piso) || 0) - (Number(b.piso) || 0),
    );

    const totalByAp: Record<string, number> = {};
    for (const ap of GAS_APPARATUS) {
      totalByAp[ap.id] = tramos.reduce((s, t) => s + (t.counts[ap.id] || 0), 0);
    }

    const tramoTotals = tramos.map((t) => renouardByType(t.counts));
    const tramoAppCounts = tramos.map((t) => {
      let sum = 0;
      for (const ap of GAS_APPARATUS) sum += t.counts[ap.id] || 0;
      return sum;
    });

    return { tramos, totalByAp, tramoTotals, tramoAppCounts };
  }, [plans]);

  // Sumatoria = consumo INSTALADO real (Σ n×qgas). El /2 de Renouard es criterio de
  // SIMULTANEIDAD para el Q de diseño de cada tramo — la sumatoria no lo aplica (ped. usuario).
  const globalTotal = useMemo(() => {
    let raw = 0;
    for (const ap of GAS_APPARATUS) raw += (totalByAp[ap.id] || 0) * (ap.qgas || 0);
    return Math.round(raw * 100) / 100;
  }, [totalByAp]);

  const totalAppCount = useMemo(() => {
    let s = 0;
    for (const ap of GAS_APPARATUS) s += totalByAp[ap.id] || 0;
    return s;
  }, [totalByAp]);

  const tableHeader = (
    <thead>
      <tr>
        {/* Nivel integrado en la etiqueta del tramo (RG1-P1) — columna Nivel retirada. */}
        <th
          scope="col"
          className="ds-th gas-th-min44"
          rowSpan={2}
          title="Identificador del tramo con su nivel (ej. RG1-P1 · S1 = sótano · C = cubierta)"
        >
          Ramal/Montante
        </th>
        <th
          scope="col"
          className="ds-th gas-th-11"
          rowSpan={2}
          title="Punto de inicio del tramo (nodo o bajante de origen)."
        >
          Inicio
        </th>
        <th
          scope="col"
          className="ds-th gas-th-11"
          rowSpan={2}
          title="Punto donde termina el tramo (nodo o bajante de destino)."
        >
          Fin
        </th>
        <th
          scope="col"
          className="ds-th gas-th-group"
          colSpan={GAS_APPARATUS.length}
          title="Conteo de aparatos por tipo en el tramo (con su factor qg de gas debajo)."
        >
          Aparatos
        </th>
        <th
          scope="col"
          className="ds-th gas-th-min26"
          rowSpan={2}
          title="Número total de aparatos del tramo."
        >
          Total
        </th>
        <th
          scope="col"
          className="ds-th gas-th-min40"
          rowSpan={2}
          title="Caudal de gas del tramo por Renouard (m³/h), con factores de corrección."
        >
          Q (m&sup3;/h)
        </th>
      </tr>
      <tr>
        {GAS_APPARATUS.map((a) => (
          <th
            scope="col"
            key={a.id}
            title={`${a.nombre}: qg = ${a.qgas} m³/h por aparato.`}
            className="ds-th gas-th-min30"
          >
            <div className="gas-bold">{(ABREV as Record<string, string>)[a.id]}</div>
          </th>
        ))}
      </tr>
    </thead>
  );

  if (tramos.length === 0) {
    return (
      <section className="card">
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/gas/calculo_UC_gas.webp"
              alt="Cálculo UC gas"
              width={24}
              height={24}
              className="gas-icon-24"
              loading="lazy"
            />
            Cálculo de unidades de consumo gas
          </h3>
          <span className="card-s">0 tramos</span>
        </div>
        <div className="gas-empty">
          <table className="tbl">
            <caption className="sr-only">Cálculo de unidades de consumo gas</caption>
            {tableHeader}
            <tbody>
              <tr>
                <td colSpan={3 + GAS_APPARATUS.length + 2} className="gas-empty-row">
                  No hay tramos con aparatos de gas.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="gas-card-fill card">
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/gas/calculo_UC_gas.webp"
              alt="Cálculo UC gas"
              width={24}
              height={24}
              className="gas-icon-24"
              loading="lazy"
            />
            Cálculo de unidades de consumo gas
          </h3>
          <span className="card-s">{tramos.length} tramos</span>
        </div>
        <div className="gas-scroll">
          <table ref={tablaRef} className="tbl">
            <caption className="sr-only">Cálculo de unidades de consumo gas</caption>
            {tableHeader}
            <tbody>
              {tramos.map((t, i) => (
                <tr key={t.id}>
                  <td className="c ds-td gas-td-1">
                    <span
                      className="gas-fs gas-semibold sigla"
                      title={`Tramo ${t.id}${t.piso != null && t.piso !== '' ? ` — nivel ${pisoCorto(Number(t.piso))}` : ''}`}
                    >
                      {t.id}
                      {t.piso != null && t.piso !== '' ? `-${pisoCorto(Number(t.piso))}` : ''}
                    </span>
                  </td>
                  <td className="c ds-td gas-td-1">
                    <span className="gas-fs">{t.ini || '\u2014'}</span>
                  </td>
                  <td className="c ds-td gas-td-1">
                    <span className="gas-fs">{t.fin || '\u2014'}</span>
                  </td>
                  {GAS_APPARATUS.map((a) => (
                    <td key={a.id} className="c ds-td gas-td-2">
                      <span className={`gas-fs${(t.counts[a.id] || 0) === 0 ? ' gas-zero' : ''}`}>
                        {t.counts[a.id] || 0}
                      </span>
                    </td>
                  ))}
                  <td className="c ds-td gas-td-1 gas-semibold gas-fs gas-txt">
                    {tramoAppCounts[i]}
                  </td>
                  <td className="c ds-td gas-td-1 gas-bold gas-fs gas-txt">
                    {tramoTotals[i].toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="c ds-td gas-td-1 gas-semibold gas-fs gas-zero gas-td-top-2">
                  &Sigma;
                </td>
                <td className="gas-td-top-0"></td>
                <td className="gas-td-top-0"></td>
                {GAS_APPARATUS.map((a) => {
                  const total = (totalByAp as Record<string, number>)[a.id] || 0;
                  return (
                    <td key={a.id} className="c ds-td gas-td-2 gas-td-top-2">
                      <div className="gas-stack">
                        <span className="gas-foot-600">{total}</span>
                        <span className="gas-foot-mult">&times; {a.qgas}</span>
                        <span className="gas-foot-gas">{(total * a.qgas).toFixed(2)}</span>
                      </div>
                    </td>
                  );
                })}
                <td className="c ds-td gas-td-1 gas-semibold gas-fs gas-txt gas-td-top-2">
                  {totalAppCount}
                </td>
                <td className="c ds-td gas-td-1 gas-bold gas-fs gas-txt gas-td-top-2">
                  {globalTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
}
export default React.memo(GasCalcUC);
