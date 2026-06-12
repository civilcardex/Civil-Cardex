import {
  RAS2000_DOTACIONES, RAS2000_VELOCIDADES, RAS2000_LLENADO, RAS2000_ESCORRENTIA, RAS2000_TR,
} from "../regulationsData";
import { h4 } from "../shared";

export function RAS2000() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h3 style={h4}>2.1 Dotaciones por nivel de complejidad (Tabla B.2.1)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Dotaciones por nivel de complejidad RAS 2000</caption>
        <thead>
          <tr>
            <th scope="col">Nivel de complejidad</th>
            <th scope="col">Dotación neta mínima</th>
            <th scope="col">Dotación neta máxima</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_DOTACIONES.map(([n, min, max]) => (
            <tr key={n}>
              <td style={{ fontWeight: 500 }}>{n}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>2.3 Ecuación de Manning (§D.4.3)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>V = (1/n) × R²⸍³ × S¹⸍² &nbsp;·&nbsp; Q = V × A</b></span>
      </div>

      <h3 style={h4}>Velocidades en tuberías sanitarias</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Velocidades en tuberías sanitarias RAS 2000</caption>
        <thead>
          <tr>
            <th scope="col">Condición</th>
            <th scope="col">Velocidad</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_VELOCIDADES.map(([c, v]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>Llenado máximo de la sección</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Llenado máximo de la sección RAS 2000</caption>
        <thead>
          <tr>
            <th scope="col">Condición</th>
            <th scope="col">y/D</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_LLENADO.map(([c, v]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>2.5 Aguas lluvias — Método Racional (§D.2)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>Q = C × I × A / 360.000</b> &nbsp;—&nbsp; Válido para A &lt; 2 km²</span>
      </div>

      <h3 style={h4}>Coeficientes de escorrentía C (Tabla D.2.1)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Coeficientes de escorrentía RAS 2000</caption>
        <thead>
          <tr>
            <th scope="col">Superficie</th>
            <th scope="col">C mínimo</th>
            <th scope="col">C máximo</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_ESCORRENTIA.map(([sup, cmin, cmax]) => (
            <tr key={sup}>
              <td style={{ fontWeight: 500 }}>{sup}</td>
              <td className="c">{cmin}</td>
              <td className="c">{cmax}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>Períodos de retorno Tr (Tabla D.2.2)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Períodos de retorno RAS 2000</caption>
        <thead>
          <tr>
            <th scope="col">Tipo de proyecto</th>
            <th scope="col">Tr (años)</th>
          </tr>
        </thead>
        <tbody>
          {RAS2000_TR.map(([t, tr]) => (
            <tr key={t}>
              <td style={{ fontWeight: 500 }}>{t}</td>
              <td className="c">{tr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
