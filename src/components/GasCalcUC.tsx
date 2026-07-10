import React, { useMemo } from "react";
import { usePlans } from "../context/PlansContext";
import { loadFromStorage } from "../services/storageService";

import { TRAZOS_PREFIX, APARATOS_BY_TRAMO_KEY } from "../constants/storage-keys";
import { GAS_APPARATUS, renouardByType } from "../utils/gasUtils";
import { pisoCorto } from "../constants";
import { TH, TD } from "../styles/sharedTableStyles";
const GasCalcUC_S1: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };
const GasCalcUC_S2: React.CSSProperties = { position:'absolute',width:'1px',height:'1px',padding:0,margin:'-1px',overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0 };


const ABREV = {
  est4: "EST-4Q", est2: "EST-2Q", hor_g: "HOR-G", hor_m: "HOR-M",
  hor_p: "HOR-P", sec_g: "SEC-G", sec_p: "SEC-P",
  cal6: "CAL-6", cal11: "CAL-11", cal21: "CAL-21", jac: "JAC", pisc: "C-PSC",
  sauna: "SAU", turco: "TUR",
};

function GasCalcUC({ patm, temp, densRel }: { patm: string; temp: string; densRel: string }) {
  const { plans } = usePlans();

  const { tramos, totalByAp, tramoTotals, tramoAppCounts } = useMemo(() => {
    const aparatos: Record<string, any> = loadFromStorage(APARATOS_BY_TRAMO_KEY, {});
    const tramosMap: Record<string, { id: string; piso: number | string; ini: string; fin: string; counts: Record<string, number> }> = {};

    for (const plano of plans) {
      if (!plano || plano.status !== "confirmed" || plano.nivel == null) continue;
      const raw = loadFromStorage(TRAZOS_PREFIX + plano.id, null);
      if (!raw) continue;
      const data = raw as Record<string, any>;

      for (const r of data.ramales || []) {
        if (r.net !== "gas") continue;
        const pid = plano.id ? String(plano.id) : '';
        const key = `gas_${r.id}`;
        const keyPid = pid ? `gas_${r.id}_${pid}` : '';
        const counts = (aparatos as Record<string, any>)[keyPid] || (aparatos as Record<string, any>)[key] || {};
        const hasData = Object.values(counts).some((v) => (Number(v) || 0) > 0);
        if (!hasData) continue;

        if (!tramosMap[r.id]) {
          tramosMap[r.id] = {
            id: r.id, piso: r.piso ?? "", ini: r.ini || "", fin: r.fin || "", counts: {},
          };
        }
        for (const ap of GAS_APPARATUS) {
          const n = Number(counts[ap.id]) || 0;
          if (n > 0)
            tramosMap[r.id].counts[ap.id] =
              (tramosMap[r.id].counts[ap.id] || 0) + n;
        }
      }
    }

    const tramos = Object.values(tramosMap).sort(
      (a, b) => (Number(a.piso) || 0) - (Number(b.piso) || 0)
    );

    const totalByAp: Record<string, number> = {};
    for (const ap of GAS_APPARATUS) {
      totalByAp[ap.id] = tramos.reduce(
        (s, t) => s + (t.counts[ap.id] || 0), 0
      );
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

  const pAtm = Number(patm) || 101.325;
  const T = Number(temp) || 23;
  const DR = Number(densRel) || 0.67;
  const fAlt = 101.325 / pAtm;
  const fTemp = Math.sqrt(288 / (273 + T));
  const fDens = Math.sqrt(0.67 / DR);
  const corrTotal = fAlt * fTemp * fDens;

  const tableHeader = (
    <thead>
      <tr>
        <th scope="col" style={{...TH, minWidth:30, fontSize: 9}} rowSpan={2}>Tramo</th>
        <th scope="col" style={{...TH, minWidth:26, fontSize: 9}} rowSpan={2}>Niveñs</th>
        <th scope="col" style={{...TH, minWidth:28, fontSize: 9}} rowSpan={2}>Inicio</th>
        <th scope="col" style={{...TH, minWidth:28, fontSize: 9}} rowSpan={2}>Fin</th>
        <th scope="col" style={{...TH, textAlign:"center"}} colSpan={GAS_APPARATUS.length}>Aparatos</th>
        <th scope="col" style={{...TH, minWidth:34, fontSize: 9}} rowSpan={2}>Total</th>
        <th scope="col" style={{...TH, minWidth:44, fontSize: 9}} rowSpan={2}>Q (m&sup3;/h)</th>
      </tr>
      <tr>
        {GAS_APPARATUS.map((a) => (
          <th scope="col" key={a.id} style={{...TH, minWidth:28, fontSize: 9, padding:"2px 2px", lineHeight:1.1}}>
            <div style={{fontWeight:700}} title={a.nombre}>{(ABREV as Record<string, string>)[a.id]}</div>
            <div style={{fontSize: 9, fontWeight:400, color:"var(--txt3)", marginTop:1}}>{a.qgas}</div>
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
            <img src="/iconos_diseno_redes/gas/calculo_UC_gas.svg" alt="Cálculo UC gas"  width={24} height={24} style={{width:24,height:24, verticalAlign: "middle", marginRight: 4 }}  loading="lazy" />
            Cálculo de unidades de consumo gas
          </h3>
          <span className="card-s">0 tramos</span>
        </div>
        <div style={{ padding: 16 }}>
          <table className="tbl" style={{ width: "100%" }}>
            <caption style={GasCalcUC_S1}>Cálculo de unidades de consumo gas</caption>
            {tableHeader}
            <tbody>
              <tr><td colSpan={4 + GAS_APPARATUS.length + 2} style={{ padding: "24px 0", textAlign: "center", color: "var(--txt3)", fontSize: 9 }}>No hay tramos con aparatos de gas.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (<>
    <section className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="card-h">
        <h3 className="card-t">
          <img src="/iconos_diseno_redes/gas/calculo_UC_gas.svg" alt="Cálculo UC gas"  width={24} height={24} style={{width:24,height:24, verticalAlign: "middle", marginRight: 4 }}  loading="lazy" />
          Cálculo de unidades de consumo gas
        </h3>
        <span className="card-s">{tramos.length} tramos</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
        <table className="tbl" style={{ width: "100%" }}>
          <caption style={GasCalcUC_S2}>Cálculo de unidades de consumo gas</caption>
          {tableHeader}
          <tbody>
            {tramos.map((t, i) => (
              <tr key={t.id}>
                <td className="c" style={{...TD, padding:'1px 1px'}}><span className="sigla" style={{ fontSize: 9, fontWeight: 600 }}>{t.id}</span></td>
                <td className="c" style={{...TD, padding:'1px 1px'}}><span style={{ fontSize: 9 }}>{t.piso != null && t.piso !== '' ? pisoCorto(Number(t.piso)) : "\u2014"}</span></td>
                <td className="c" style={{...TD, padding:'1px 1px'}}><span style={{ fontSize: 9 }}>{t.ini || "\u2014"}</span></td>
                <td className="c" style={{...TD, padding:'1px 1px'}}><span style={{ fontSize: 9 }}>{t.fin || "\u2014"}</span></td>
                {GAS_APPARATUS.map((a) => (
                  <td key={a.id} className="c" style={{...TD, padding:"2px 2px"}}>
                    <span style={{ fontSize: 9, color: (t.counts[a.id] || 0) === 0 ? "var(--txt3)" : "var(--txt)" }}>{t.counts[a.id] || 0}</span>
                  </td>
                ))}
                <td className="c" style={{...TD, padding:'1px 1px', fontWeight:600, fontSize: 9, color:"var(--txt)"}}>{tramoAppCounts[i]}</td>
                <td className="c" style={{...TD, padding:'1px 1px', fontWeight:700, fontSize: 9, color:"var(--txt)"}}>{tramoTotals[i].toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="c" style={{...TD, padding:'1px 1px', fontWeight:600, fontSize: 9, color:"var(--txt3)", textAlign:"center", borderTop:"2px solid var(--line)"}}>&Sigma;</td>
              <td style={{borderTop:"2px solid var(--line)", padding:0}}></td>
              <td style={{borderTop:"2px solid var(--line)", padding:0}}></td>
              <td style={{borderTop:"2px solid var(--line)", padding:0}}></td>
              {GAS_APPARATUS.map((a) => {
                const total = (totalByAp as Record<string, number>)[a.id] || 0;
                return (
                  <td key={a.id} className="c" style={{...TD, padding:"2px 2px", borderTop:"2px solid var(--line)"}}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, fontSize: 9, fontFamily: "var(--mono)" }}>
                      <span style={{ fontWeight: 600, color: "var(--txt)", fontSize: 9 }}>{total}</span>
                      <span style={{ color: "var(--txt3)", fontSize: 7 }}>&times; {a.qgas}</span>
                      <span style={{ fontWeight: 700, color: "var(--gas)", fontSize: 9 }}>{(total * a.qgas).toFixed(2)}</span>
                    </div>
                  </td>
                );
              })}
              <td className="c" style={{...TD, padding:'1px 1px', fontWeight:600, fontSize: 9, color:"var(--txt)", textAlign:"center", borderTop:"2px solid var(--line)"}}>{totalAppCount}</td>
              <td className="c" style={{...TD, padding:'1px 1px', fontWeight:700, fontSize: 9, color:"var(--txt)", textAlign:"center", borderTop:"2px solid var(--line)"}}>{globalTotal.toFixed(2)} m&sup3;/h</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <section className="card" style={{ flexShrink: 0, alignSelf: "stretch" }}>
      <div className="card-h">
        <h3 className="card-t">
          <img src="/iconos_diseno_redes/general/calculo_perdidas_de_carga.svg" alt="Cálculo pérdidas de carga"  width={24} height={24} style={{width:24,height:24, verticalAlign: "middle", marginRight: 4 }}  loading="lazy" />
          Factores de correcci&oacute;n
        </h3>
      </div>
      <div style={{ padding: "8px 16px", display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 9 }}>Altitud</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>f<sub>alt</sub> = 101.325 / {pAtm.toFixed(2)} = <span>{fAlt.toFixed(2)}</span></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 9 }}>Temperatura</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>f<sub>temp</sub> = &radic;(288 / (273+{T})) = <span>{fTemp.toFixed(2)}</span></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 9 }}>Densidad</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>f<sub>dens</sub> = &radic;(0.67 / {DR.toFixed(2)}) = <span>{fDens.toFixed(2)}</span></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 9 }}>Caudal de diseño</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>Q<sub>d</sub> = max(&Sigma;Q<sub>i</sub> &times; {corrTotal.toFixed(2)}, 2.7) = <span style={{fontWeight:700}}>{Math.max(globalTotal * corrTotal, 2.7).toFixed(2)}</span> m&sup3;/h</span>
        </div>
      </div>
    </section>
  </>);
}
export default React.memo(GasCalcUC);