import { useMemo } from "react";
import { usePlanos } from "../context/PlansContext";
import { APARATOS_DEF } from "../constants";
import { safeParse } from "../utils/parseUtils";

const TRAZOS_PREFIX = "civilflow_trazos_";
const APARATOS_KEY = "civilflow_aparatos_by_tramo_v2";

const GAS_APPARATUS = APARATOS_DEF.filter(
  (a) => a.grupo === "g" && (a.qgas || 0) > 0
);

const ABREV = {
  est4: "EST-4Q", est2: "EST-2Q", hor_g: "HOR-G", hor_m: "HOR-M",
  hor_p: "HOR-P", sec_g: "SEC-G", sec_p: "SEC-P", cal_b: "CAL-P",
  cal6: "CAL-6", cal11: "CAL-11", cal21: "CAL-21", jac: "JAC", pisc: "C-PSC",
  sauna: "SAU", turco: "TUR",
};

const TH = {
  fontSize: 10, fontWeight: 600, color: "var(--txt3)", fontFamily: "var(--mono)",
  textAlign: "center", padding: "3px 4px",
  borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line2)",
  whiteSpace: "nowrap", textTransform: "uppercase",
  letterSpacing: "0.4px", background: "var(--bg3)",
};
const TD = {
  fontSize: 11, fontFamily: "var(--mono)", padding: "3px 4px",
  borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line2)",
  color: "var(--txt2)", textAlign: "center", verticalAlign: "middle",
};

function renouardByType(counts) {
  const present = [];
  for (const ap of GAS_APPARATUS) {
    const n = counts[ap.id] || 0;
    if (n > 0) present.push({ q: ap.qgas, n });
  }
  const sorted = present.sort((a, b) => b.q - a.q);
  const nTypes = sorted.length;
  if (nTypes === 0) return 0;
  if (nTypes === 1) return (sorted[0].q * sorted[0].n) / 2;
  if (nTypes === 2) return ((sorted[0].q * sorted[0].n) + (sorted[1].q * sorted[1].n)) / 2;
  const part1 = ((sorted[0].q * sorted[0].n) + (sorted[1].q * sorted[1].n)) / 2;
  const qMayor2 = sorted[1].q;
  const part2 = sorted.slice(2).filter(p => p.q < qMayor2).reduce((s, p) => s + p.q * p.n, 0);
  return part1 + part2;
}

export default function GasCalcUC({ patm, temp, densRel }) {
  const { planos } = usePlanos();

  const { tramos, totalByAp, tramoTotals, tramoAppCounts } = useMemo(() => {
    const aparatos = safeParse(localStorage.getItem(APARATOS_KEY), {}) || {};
    const tramosMap = {};

    for (const plano of planos) {
      if (!plano || plano.status !== "confirmed" || plano.nivel == null) continue;
      const raw = safeParse(localStorage.getItem(TRAZOS_PREFIX + plano.id), null);
      if (!raw) continue;
      const data = typeof raw === "string" ? safeParse(raw, {}) : raw;

      for (const r of data.ramales || []) {
        if (r.net !== "gas") continue;
        const key = `gas_${r.id}`;
        const counts = aparatos[key] || {};
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
      (a, b) => (a.piso || 0) - (b.piso || 0)
    );

    const totalByAp = {};
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
  }, [planos]);

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
  const qDiseno = Math.max(globalTotal * corrTotal, 2.7);

  const tableHeader = (
    <thead>
      <tr>
        <th style={{...TH, minWidth:42, fontSize:11}} rowSpan={2}>Tramo</th>
        <th style={{...TH, minWidth:36, fontSize:11}} rowSpan={2}>Niv.</th>
        <th style={{...TH, minWidth:40, fontSize:11}} rowSpan={2}>Inicio</th>
        <th style={{...TH, minWidth:40, fontSize:11}} rowSpan={2}>Fin</th>
        <th style={{...TH, textAlign:"center"}} colSpan={GAS_APPARATUS.length}>Aparatos</th>
        <th style={{...TH, minWidth:48, fontSize:11}} rowSpan={2}>Total</th>
        <th style={{...TH, minWidth:62, fontSize:11}} rowSpan={2}>Q (m&sup3;/h)</th>
        <th style={{...TH, minWidth:62, fontSize:11}} rowSpan={2}>Q dise&ntilde;o</th>
      </tr>
      <tr>
        {GAS_APPARATUS.map((a) => (
          <th key={a.id} style={{...TH, minWidth:40, fontSize:10, padding:"2px 2px", lineHeight:1.1}}>
            <div style={{fontWeight:700}} title={a.nombre}>{ABREV[a.id]}</div>
            <div style={{fontSize:8, fontWeight:400, color:"var(--txt3)", marginTop:1}}>{a.qgas}</div>
          </th>
        ))}
      </tr>
    </thead>
  );

  if (tramos.length === 0) {
    return (
      <div className="card" style={{ flex: 1 }}>
        <div className="card-h">
          <span className="card-t">
            <img src="/iconos_diseno_redes/red_de_gas.webp" alt="" style={{ width: 24, height: 24, verticalAlign: "middle", marginRight: 4 }} />
            C&aacute;lculo UC gas
          </span>
          <span className="card-s">0 tramos</span>
        </div>
        <div style={{ padding: 16 }}>
          <table className="tbl" style={{ width: "100%" }}>
            {tableHeader}
            <tbody>
              <tr><td colSpan={4 + GAS_APPARATUS.length + 3} style={{ padding: 30, textAlign: "center", color: "var(--txt3)", fontSize: 11 }}>No hay tramos con aparatos de gas.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (<>
    <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="card-h">
        <span className="card-t">
          <img src="/iconos_diseno_redes/red_de_gas.webp" alt="" style={{ width: 24, height: 24, verticalAlign: "middle", marginRight: 4 }} />
          C&aacute;lculo UC gas
        </span>
        <span className="card-s">{tramos.length} tramos</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
        <table className="tbl" style={{ width: "100%" }}>
          {tableHeader}
          <tbody>
            {tramos.map((t, i) => (
              <tr key={t.id}>
                <td className="c" style={{...TD, padding:"2px 3px"}}><span className="sigla" style={{ fontSize: 10, fontWeight: 600 }}>{t.id}</span></td>
                <td className="c" style={{...TD, padding:"2px 3px"}}><span style={{ fontSize: 10 }}>{t.piso || "\u2014"}</span></td>
                <td className="c" style={{...TD, padding:"2px 3px"}}><span style={{ fontSize: 10 }}>{t.ini || "\u2014"}</span></td>
                <td className="c" style={{...TD, padding:"2px 3px"}}><span style={{ fontSize: 10 }}>{t.fin || "\u2014"}</span></td>
                {GAS_APPARATUS.map((a) => (
                  <td key={a.id} className="c" style={{...TD, padding:"2px 2px"}}>
                    <span style={{ fontSize: 10, color: (t.counts[a.id] || 0) === 0 ? "var(--txt3)" : "var(--txt)" }}>{t.counts[a.id] || 0}</span>
                  </td>
                ))}
                <td className="c" style={{...TD, padding:"2px 3px", fontWeight:600, fontSize:11, color:"var(--txt)"}}>{tramoAppCounts[i]}</td>
                <td className="c" style={{...TD, padding:"2px 3px", fontWeight:700, fontSize:11, color:"var(--txt)"}}>{tramoTotals[i].toFixed(2)}</td>
                <td className="c" style={{...TD, padding:"2px 3px", fontWeight:700, fontSize:11, color:"var(--txt)"}}>{qDiseno.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="c" style={{...TD, padding:"2px 3px", fontWeight:600, fontSize:11, color:"var(--txt3)", textAlign:"center", borderTop:"2px solid var(--line)"}}>&Sigma;</td>
              <td style={{borderTop:"2px solid var(--line)", padding:0}}></td>
              <td style={{borderTop:"2px solid var(--line)", padding:0}}></td>
              <td style={{borderTop:"2px solid var(--line)", padding:0}}></td>
              {GAS_APPARATUS.map((a) => {
                const total = totalByAp[a.id] || 0;
                return (
                  <td key={a.id} className="c" style={{...TD, padding:"2px 2px", borderTop:"2px solid var(--line)"}}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, fontSize: 9, fontFamily: "var(--mono)" }}>
                      <span style={{ fontWeight: 600, color: "var(--txt)", fontSize: 10 }}>{total}</span>
                      <span style={{ color: "var(--txt3)", fontSize: 7 }}>&times; {a.qgas}</span>
                      <span style={{ fontWeight: 700, color: "var(--gas)", fontSize: 10 }}>{(total * a.qgas).toFixed(2)}</span>
                    </div>
                  </td>
                );
              })}
              <td className="c" style={{...TD, padding:"2px 3px", fontWeight:600, fontSize:12, color:"var(--txt)", textAlign:"center", borderTop:"2px solid var(--line)"}}>{totalAppCount}</td>
              <td className="c" style={{...TD, padding:"2px 3px", fontWeight:700, fontSize:12, color:"var(--txt)", textAlign:"center", borderTop:"2px solid var(--line)"}}>{globalTotal.toFixed(2)} m&sup3;/h</td>
              <td className="c" style={{...TD, padding:"2px 3px", fontWeight:700, fontSize:12, color:"var(--txt)", textAlign:"center", borderTop:"2px solid var(--line)"}}>{qDiseno.toFixed(2)} m&sup3;/h</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div className="card" style={{ flexShrink: 0, alignSelf: "stretch" }}>
      <div className="card-h">
        <span className="card-t">
          <img src="/iconos_diseno_redes/calculo_perdidas_de_carga.webp" alt="" style={{ width: 24, height: 24, verticalAlign: "middle", marginRight: 4 }} />
          Factores de correcci&oacute;n
        </span>
      </div>
      <div style={{ padding: "8px 16px", display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 11 }}>Altitud</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>f<sub>alt</sub> = 101.325 / {pAtm.toFixed(2)} = <span>{fAlt.toFixed(2)}</span></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 11 }}>Temperatura</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>f<sub>temp</sub> = &radic;(288 / (273+{T})) = <span>{fTemp.toFixed(2)}</span></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 11 }}>Densidad</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>f<sub>dens</sub> = &radic;(0.67 / {DR.toFixed(2)}) = <span>{fDens.toFixed(2)}</span></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 0", minWidth: 0 }}>
          <span style={{ color: "var(--txt3)", fontSize: 11 }}>Factor total</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>F = {fAlt.toFixed(2)} &times; {fTemp.toFixed(2)} &times; {fDens.toFixed(2)} = <span>{corrTotal.toFixed(2)}</span></span>
        </div>
      </div>
    </div>
  </>);
}
