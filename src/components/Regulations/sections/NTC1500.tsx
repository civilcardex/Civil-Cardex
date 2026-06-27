import {
  NTC1500_DOTACIONES, NTC1500_UC, NTC1500_HAZEN_C, NTC1500_VELOCIDADES,
  NTC1500_UD, NTC1500_PENDIENTES, NTC1500_CAPACIDAD, NTC1500_VENTILACION,
} from "../regulationsData";
import { subHeadingStyle as h4 } from "../shared";

export function NTC1500() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h3 style={h4}>1.1 Dotaciones de diseño (§4)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Dotaciones de diseño NTC 1500</caption>
        <thead>
          <tr>
            <th scope="col">Uso</th>
            <th scope="col">Dotación mínima</th>
            <th scope="col">Dotación máxima</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_DOTACIONES.map(([uso, min, max]) => (
            <tr key={uso}>
              <td style={{ fontWeight: 500 }}>{uso}</td>
              <td className="c">{min}</td>
              <td className="c">{max}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>1.2 Unidades de consumo UC (Tabla 1 — §5)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Unidades de consumo NTC 1500</caption>
        <thead>
          <tr>
            <th scope="col">Aparato</th>
            <th scope="col">Sigla</th>
            <th scope="col">UC AF</th>
            <th scope="col">UC AC</th>
            <th scope="col">P mín (mca)</th>
            <th scope="col">P máx (mca)</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_UC.map(([nom, sig, uca, ucac, pmin, pmax]) => (
            <tr key={nom}>
              <td style={{ fontWeight: 500 }}>{nom}</td>
              <td><span className="sigla">{sig}</span></td>
              <td className="c">{uca}</td>
              <td className="c">{ucac}</td>
              <td className="c">{pmin}</td>
              <td className="c">{pmax}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>1.4 Cálculo hidráulico — Hazen-Williams (§5.4)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: "10px 14px", color: "var(--txt)" }}>
        <span>∑</span>
        <span><b>Hf = 10.67 × L × Q¹·⁸⁵² / (C¹·⁸⁵² × D⁴·⁸⁷)</b></span>
      </div>

      <h3 style={h4}>Coeficientes C de Hazen-Williams</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Coeficientes C Hazen-Williams</caption>
        <thead>
          <tr>
            <th scope="col">Material</th>
            <th scope="col">C</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_HAZEN_C.map(([m, c]) => (
            <tr key={m}>
              <td style={{ fontWeight: 500 }}>{m}</td>
              <td className="c">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>Velocidades permisibles</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Velocidades permisibles NTC 1500</caption>
        <thead>
          <tr>
            <th scope="col">Condición</th>
            <th scope="col">Velocidad</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_VELOCIDADES.map(([c, v]) => (
            <tr key={c}>
              <td style={{ fontWeight: 500 }}>{c}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>1.7 Unidades de desagüe UD (Tabla 2 — §8)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Unidades de desagüe NTC 1500</caption>
        <thead>
          <tr>
            <th scope="col">Aparato</th>
            <th scope="col">UD</th>
            <th scope="col">D mín ramal</th>
            <th scope="col">D mín bajante</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_UD.map(([nom, ud, ramal, baj]) => (
            <tr key={nom}>
              <td style={{ fontWeight: 500 }}>{nom}</td>
              <td className="c">{ud}</td>
              <td className="c">{ramal}</td>
              <td className="c">{baj}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>1.8 Pendientes mínimas (§8.3)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Pendientes mínimas NTC 1500</caption>
        <thead>
          <tr>
            <th scope="col">Diámetro</th>
            <th scope="col">Pendiente mínima</th>
            <th scope="col">Pendiente recomendada</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_PENDIENTES.map(([d, min, rec]) => (
            <tr key={d}>
              <td className="c" style={{ fontWeight: 500 }}>{d}</td>
              <td className="c">{min}</td>
              <td className="c">{rec}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib warn" style={{ fontSize: 11, padding: "8px 12px", marginTop: 6 }}>
        <span>⚠</span>
        <span>NTC 1500 permite S = 1% para D ≥ 2" con justificación hidráulica.</span>
      </div>

      <h3 style={h4}>1.9 Capacidad máxima de desagüe por diámetro (Tabla 3 — §8.4)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Capacidad máxima de desagüe NTC 1500</caption>
        <thead>
          <tr>
            <th scope="col">D (pulg)</th>
            <th scope="col">UD máx ramal horizontal</th>
            <th scope="col">UD máx bajante 1 piso</th>
            <th scope="col">UD máx bajante ≥ 3 pisos</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_CAPACIDAD.map(([d, rh, b1, b3]) => (
            <tr key={d}>
              <td className="c" style={{ fontWeight: 500 }}>{d}"</td>
              <td className="c">{rh}</td>
              <td className="c">{b1}</td>
              <td className="c">{b3}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>1.10 Ventilación (§9)</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Ventilación NTC 1500</caption>
        <thead>
          <tr>
            <th scope="col">Parámetro</th>
            <th scope="col">Valor</th>
            <th scope="col">Artículo</th>
          </tr>
        </thead>
        <tbody>
          {NTC1500_VENTILACION.map(([p, v, a]) => (
            <tr key={p}>
              <td style={{ fontWeight: 500 }}>{p}</td>
              <td className="c">{v}</td>
              <td className="c">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
