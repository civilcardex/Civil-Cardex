import {
  NTC3728_PRESIONES, NTC3728_SIMULTANEIDAD, NTC3728_CAUDALES,
} from "../regulationsData";
import { h4 } from "../shared";

export function NTC3728() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h3 style={h4}>3.1 Presiones de diseño (§4)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Presiones de diseño NTC 3728</caption>
        <thead>
          <tr>
            <th scope="col">Tipo de red</th>
            <th scope="col">Presión mínima</th>
            <th scope="col">Presión máxima</th>
          </tr>
        </thead>
        <tbody>
          {NTC3728_PRESIONES.map(([t, min, max]) => (
            <tr key={t}>
              <td style={{ fontWeight: 500 }}>{t}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>3.2 Ecuación de Renouard (§6.2)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>ΔP = 48620 × K × L × Q¹·⁸² / (P_at × Di⁴·⁸²)</b></span>
      </div>

      <h3 style={h4}>Velocidad máxima: V ≤ 10 m/s</h3>

      <h3 style={h4}>3.5 Factores de simultaneidad fs (§5.3)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Factores de simultaneidad NTC 3728</caption>
        <thead>
          <tr>
            <th scope="col">N° aparatos (n)</th>
            <th scope="col">fs</th>
          </tr>
        </thead>
        <tbody>
          {NTC3728_SIMULTANEIDAD.map(([n, fs]) => (
            <tr key={n}>
              <td className="c">{n}</td>
              <td className="c">{fs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib info" style={{ fontSize: 13, padding: "8px 12px", marginTop: 6, color: "var(--txt)" }}>
        <span>ℹ</span>
        <span>Q_diseño = Q_instalado × fs</span>
      </div>

      <h3 style={h4}>3.6 Caudales de aparatos a gas (Tabla 1 — §5.2)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Caudales de aparatos a gas NTC 3728</caption>
        <thead>
          <tr>
            <th scope="col">Aparato</th>
            <th scope="col">Q (m³/hr)</th>
          </tr>
        </thead>
        <tbody>
          {NTC3728_CAUDALES.map(([a, q]) => (
            <tr key={a}>
              <td style={{ fontWeight: 500 }}>{a}</td>
              <td className="c">{q}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
