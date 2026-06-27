import {
  NSR10_CLASIFICACION, NSR10_ALTURA,
} from "../regulationsData";
import { subHeadingStyle as h4 } from "../shared";

export function NSR10() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h3 style={h4}>4.1 Clasificación por tipo de ocupación (J.2)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Clasificación por tipo de ocupación NSR-10</caption>
        <thead>
          <tr>
            <th scope="col">Tipo</th>
            <th scope="col">Clasificación</th>
            <th scope="col">Ejemplos</th>
          </tr>
        </thead>
        <tbody>
          {NSR10_CLASIFICACION.map(([t, c, e]) => (
            <tr key={t}>
              <td className="c" style={{ fontWeight: 600 }}>{t}</td>
              <td>{c}</td>
              <td>{e}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>4.2 Requisitos según altura y ocupación (J.4)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Requisitos según altura y ocupación NSR-10</caption>
        <thead>
          <tr>
            <th scope="col">Altura edificación</th>
            <th scope="col">Tipo A</th>
            <th scope="col">Tipo B</th>
            <th scope="col">Tipo C</th>
          </tr>
        </thead>
        <tbody>
          {NSR10_ALTURA.map(([h, a, b, c]) => (
            <tr key={h}>
              <td style={{ fontWeight: 500 }}>{h}</td>
              <td className="c">{a}</td>
              <td className="c">{b}</td>
              <td className="c">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
