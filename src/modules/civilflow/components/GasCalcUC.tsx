import React, { useMemo } from 'react';
import { usePlans } from '../context/PlansContext';
import { loadFromStorage } from '../services/storageService';

import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys';
import { GAS_APPARATUS, renouardByType } from '../utils/gasUtils';
import { pisoCorto } from '../constants';
import { TH, TD } from '../styles/sharedTableStyles';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import type { DrawingData } from '../utils/drawingSync';
const GasCalcUC_S1: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
const GasCalcUC_S2: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const ABREV = {
  est4: 'EST4',
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

  const globalTotal = useMemo(() => tramoTotals.reduce((s, q) => s + q, 0), [tramoTotals]);

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
          style={{ ...TH, minWidth: 44, fontSize: 11 }}
          rowSpan={2}
          title="Identificador del tramo con su nivel (ej. RG1-P1 · S1 = sótano · C = cubierta)"
        >
          Tramo
        </th>
        <th
          scope="col"
          style={{ ...TH, fontSize: 11 }}
          rowSpan={2}
          title="Punto de inicio del tramo (nudo o bajante de origen)."
        >
          Inicio
        </th>
        <th
          scope="col"
          style={{ ...TH, fontSize: 11 }}
          rowSpan={2}
          title="Punto donde termina el tramo (nudo o bajante de destino)."
        >
          Fin
        </th>
        <th
          scope="col"
          style={{
            ...TH,
            textAlign: 'center',
            fontSize: 11,
            borderBottom: '2px solid var(--line)',
          }}
          colSpan={GAS_APPARATUS.length}
          title="Conteo de aparatos por tipo en el tramo (con su factor qg de gas debajo)."
        >
          Aparatos
        </th>
        <th
          scope="col"
          style={{ ...TH, minWidth: 26, fontSize: 11 }}
          rowSpan={2}
          title="Número total de aparatos del tramo."
        >
          Total
        </th>
        <th
          scope="col"
          style={{ ...TH, minWidth: 40, fontSize: 11 }}
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
            style={{ ...TH, minWidth: 30, fontSize: 11, padding: '2px 2px', lineHeight: 1.1 }}
          >
            <div style={{ fontWeight: 700 }}>{(ABREV as Record<string, string>)[a.id]}</div>
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
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />
            Cálculo de unidades de consumo gas
          </h3>
          <span className="card-s">0 tramos</span>
        </div>
        <div style={{ padding: 16 }}>
          <table className="tbl" style={{ width: '100%' }}>
            <caption style={GasCalcUC_S1}>Cálculo de unidades de consumo gas</caption>
            {tableHeader}
            <tbody>
              <tr>
                <td
                  colSpan={3 + GAS_APPARATUS.length + 2}
                  style={{
                    padding: '24px 0',
                    textAlign: 'center',
                    color: 'var(--txt3)',
                    fontSize: 12.5,
                  }}
                >
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
      <section
        className="card"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/gas/calculo_UC_gas.webp"
              alt="Cálculo UC gas"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />
            Cálculo de unidades de consumo gas
          </h3>
          <span className="card-s">{tramos.length} tramos</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
          <table ref={tablaRef} className="tbl" style={{ width: '100%' }}>
            <caption style={GasCalcUC_S2}>Cálculo de unidades de consumo gas</caption>
            {tableHeader}
            <tbody>
              {tramos.map((t, i) => (
                <tr key={t.id}>
                  <td className="c" style={{ ...TD, padding: '1px 1px' }}>
                    <span
                      className="sigla"
                      style={{ fontSize: 12.5, fontWeight: 600 }}
                      title={`Tramo ${t.id}${t.piso != null && t.piso !== '' ? ` — nivel ${pisoCorto(Number(t.piso))}` : ''}`}
                    >
                      {t.id}
                      {t.piso != null && t.piso !== '' ? `-${pisoCorto(Number(t.piso))}` : ''}
                    </span>
                  </td>
                  <td className="c" style={{ ...TD, padding: '1px 1px' }}>
                    <span style={{ fontSize: 12.5 }}>{t.ini || '\u2014'}</span>
                  </td>
                  <td className="c" style={{ ...TD, padding: '1px 1px' }}>
                    <span style={{ fontSize: 12.5 }}>{t.fin || '\u2014'}</span>
                  </td>
                  {GAS_APPARATUS.map((a) => (
                    <td key={a.id} className="c" style={{ ...TD, padding: '2px 2px' }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          color: (t.counts[a.id] || 0) === 0 ? 'var(--txt3)' : 'var(--txt)',
                        }}
                      >
                        {t.counts[a.id] || 0}
                      </span>
                    </td>
                  ))}
                  <td
                    className="c"
                    style={{
                      ...TD,
                      padding: '1px 1px',
                      fontWeight: 600,
                      fontSize: 12.5,
                      color: 'var(--txt)',
                    }}
                  >
                    {tramoAppCounts[i]}
                  </td>
                  <td
                    className="c"
                    style={{
                      ...TD,
                      padding: '1px 1px',
                      fontWeight: 700,
                      fontSize: 12.5,
                      color: 'var(--txt)',
                    }}
                  >
                    {tramoTotals[i].toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  className="c"
                  style={{
                    ...TD,
                    padding: '1px 1px',
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: 'var(--txt3)',
                    textAlign: 'center',
                    borderTop: '2px solid var(--line)',
                  }}
                >
                  &Sigma;
                </td>
                <td style={{ borderTop: '2px solid var(--line)', padding: 0 }}></td>
                <td style={{ borderTop: '2px solid var(--line)', padding: 0 }}></td>
                {GAS_APPARATUS.map((a) => {
                  const total = (totalByAp as Record<string, number>)[a.id] || 0;
                  return (
                    <td
                      key={a.id}
                      className="c"
                      style={{ ...TD, padding: '2px 2px', borderTop: '2px solid var(--line)' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0,
                          fontSize: 12.5,
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--txt)', fontSize: 12.5 }}>
                          {total}
                        </span>
                        <span style={{ color: 'var(--txt3)', fontSize: 10.5 }}>
                          &times; {a.qgas}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--gas)', fontSize: 12.5 }}>
                          {(total * a.qgas).toFixed(2)}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td
                  className="c"
                  style={{
                    ...TD,
                    padding: '1px 1px',
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: 'var(--txt)',
                    textAlign: 'center',
                    borderTop: '2px solid var(--line)',
                  }}
                >
                  {totalAppCount}
                </td>
                <td
                  className="c"
                  style={{
                    ...TD,
                    padding: '1px 1px',
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: 'var(--txt)',
                    textAlign: 'center',
                    borderTop: '2px solid var(--line)',
                  }}
                >
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
