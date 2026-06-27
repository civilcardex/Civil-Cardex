import {
  NFPA13_RIESGOS, NFPA13_DENSIDADES, NFPA13_ROCIADORES,
} from "../regulationsData";
import { subHeadingStyle as h4 } from "../shared";

export function NFPA13() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h3 style={h4}>5.1 Clasificación de riesgos (§5.2)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Clasificación de riesgos NFPA 13</caption>
        <thead>
          <tr>
            <th scope="col">Grupo</th>
            <th scope="col">Descripción</th>
            <th scope="col">Ejemplos</th>
          </tr>
        </thead>
        <tbody>
          {NFPA13_RIESGOS.map(([g, d, e]) => (
            <tr key={g}>
              <td style={{ fontWeight: 500 }}>{g}</td>
              <td>{d}</td>
              <td>{e}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>5.2 Densidades y áreas de operación (§11.2.3)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Densidades y áreas de operación NFPA 13</caption>
        <thead>
          <tr>
            <th scope="col">Clasificación</th>
            <th scope="col">Densidad (gpm/pie²)</th>
            <th scope="col">Área operación (m²)</th>
          </tr>
        </thead>
        <tbody>
          {NFPA13_DENSIDADES.map(([c, d, a]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{d}</td>
              <td className="c">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>5.3 Rociadores (§7)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Rociadores NFPA 13</caption>
        <thead>
          <tr>
            <th scope="col">Parámetro</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {NFPA13_ROCIADORES.map(([p, v]) => (
            <tr key={p}>
              <td style={{ fontWeight: 500 }}>{p}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
