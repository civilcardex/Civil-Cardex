import { useMemo } from 'react';
import { useRainwater, type BajanteLL } from '../context/RainwaterContext';
import { useTramos } from '../context/TramosContext';
import { usePlans } from '../context/PlansContext';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { chequeoBajanteLluvia } from '../utils/calcRainwater';
import { renderStatus } from '../utils/componentHelpers';
import { parseDecimalInput } from '../utils/parseDecimal';
import type { DrawingData } from '../utils/drawingSync';

interface AreaRaw {
  areaM2?: number;
}
interface Row {
  key: string;
  bajante: string;
  areaParcial: number;
  areaAcum: number;
  intensidad: number;
  coeficienteC: number;
  R: string;
  manning: number;
  diamPropuesto: number;
}
const RainDownpipesCheck_S1: React.CSSProperties = {
  width: 56,
  padding: '2px 4px',
  background: 'var(--bg2)',
  border: '1px solid var(--line)',
  borderRadius: 2,
  color: 'var(--txt)',
  fontFamily: 'var(--mono)',
  fontSize: 10,
  textAlign: 'center',
};

export default function ChequeoBajantesLluvias() {
  const { bajantesLl, updBajanteLL } = useRainwater();
  const { tramosLl } = useTramos();
  const { plans } = usePlans();

  const drawingBajantes = useMemo(() => {
    return tramosLl.filter((t) => t.esBajante);
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

  const areaAcumMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<(DrawingData & { areas?: AreaRaw[] }) | string | null>(
        TRAZOS_PREFIX + plan.id,
        null,
      );
      if (!raw) continue;
      let data: DrawingData & { areas?: AreaRaw[] } = raw as DrawingData & { areas?: AreaRaw[] };
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      const totalArea = (data.areas || []).reduce((s, a) => s + (a.areaM2 || 0), 0);
      map[String(plan.nivel)] = totalArea;
    }
    return map;
  }, [plans]);

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
      const areaParcial = areaDib || d.area_m2 || manual?.areaParcial || 0;
      const areaAcum = areaAcumMap[String(d.piso)] || manual?.areaAcumulada || 0;
      const rVal = d.bajR != null ? (Math.abs(d.bajR - 0.25) < 0.001 ? '1/4' : '7/24') : '7/24';
      out.push({
        key: 'd_' + d.id + '_' + d.piso,
        bajante: code,
        areaParcial,
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
      const areaAcum = areaAcumMap[String(bajDib?.piso)] || m.areaAcumulada || 0;
      out.push({
        key: 'm_' + m.id,
        bajante: m.bajante || m.id,
        areaParcial,
        areaAcum,
        intensidad: m.intensidad ?? 100,
        coeficienteC: 0.0278,
        R: m.R,
        manning: 0.009,
        diamPropuesto: m.diamPropuesto,
      });
    }

    return out;
  }, [drawingBajantes, bajantesLl, areaDibujoMap, areaAcumMap]);

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
      </div>
      <div style={{ padding: '16px' }}>
        <table
          className="tbl"
          style={{ fontSize: 10, tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="col-h ll"
                rowSpan={2}
                style={{
                  fontSize: 10,
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
                colSpan={2}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
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
                  fontSize: 10,
                  textAlign: 'center',
                  padding: '1px 1px',
                  whiteSpace: 'normal',
                  overflow: 'hidden',
                }}
              >
                Acumulada
              </th>
              <th
                scope="col"
                className="col-h ok"
                style={{
                  fontSize: 10,
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
                  fontSize: 10,
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
                  colSpan={11}
                  style={{
                    padding: '24px 0',
                    textAlign: 'center',
                    color: 'var(--txt3)',
                    fontSize: 10,
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
                      <span className="sigla" style={{ fontSize: 10 }}>
                        {row.bajante || '—'}
                      </span>
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                        {row.areaParcial > 0 ? row.areaParcial.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                        {row.areaAcum > 0 ? row.areaAcum.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="c">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.intensidad ?? 100}
                        aria-label="Intensidad (I)"
                        key={row.key + '_in'}
                        onChange={() => {}}
                        onBlur={(e) => {
                          const v = parseDecimalInput(e.target.value) ?? 100;
                          if (v !== null && row.bajante) {
                            updBajanteLL(row.bajante, 'intensidad', v);
                          }
                        }}
                        style={RainDownpipesCheck_S1}
                      />
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>0.0278</span>
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                        {row.R || '—'}
                      </span>
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10 }}
                    >
                      {Q > 0 ? Q.toFixed(2) : '—'}
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                        {row.manning || '—'}
                      </span>
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 10 }}
                    >
                      {diamCalc > 0 ? diamCalc.toFixed(2) : '—'}
                    </td>
                    <td className="c">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                        {row.diamPropuesto ? row.diamPropuesto + '"' : '—'}
                      </span>
                    </td>
                    <td className="c" style={{ fontSize: 10 }}>
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
