import {
  TABLAS_PRESION, TABLAS_CAUDALES, TABLAS_CRITERIOS, TABLAS_ALTITUDES,
} from "../regulationsData";
import { subHeadingStyle as h4 } from "../shared";

export function TablasRef() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <h3 style={h4}>7.1 Conversión de unidades de presión</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Conversión de unidades de presión</caption>
        <thead>
          <tr>
            <th scope="col">Unidad</th>
            <th scope="col">mca</th>
            <th scope="col">bar</th>
            <th scope="col">PSI</th>
            <th scope="col">kPa</th>
            <th scope="col">mbar</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_PRESION.map(([u, mca, bar, psi, kpa, mbar]) => (
            <tr key={u}>
              <td style={{ fontWeight: 600 }}>{u}</td>
              <td className="c">{mca}</td>
              <td className="c">{bar}</td>
              <td className="c">{psi}</td>
              <td className="c">{kpa}</td>
              <td className="c">{mbar}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>7.2 Conversión de caudales</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Conversión de caudales</caption>
        <thead>
          <tr>
            <th scope="col">Unidad</th>
            <th scope="col">lps</th>
            <th scope="col">lpm</th>
            <th scope="col">m³/hr</th>
            <th scope="col">gpm</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_CAUDALES.map(([u, lps, lpm, m3h, gpm]) => (
            <tr key={u}>
              <td style={{ fontWeight: 600 }}>{u}</td>
              <td className="c">{lps}</td>
              <td className="c">{lpm}</td>
              <td className="c">{m3h}</td>
              <td className="c">{gpm}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={h4}>7.3 Resumen de criterios críticos por red</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Resumen de criterios críticos por red</caption>
        <thead>
          <tr>
            <th scope="col">Red</th>
            <th scope="col">Parámetro</th>
            <th scope="col">Criterio</th>
            <th scope="col">Norma</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_CRITERIOS.map(([red, param, crit, norm], i) => {
            const col =
              red === "AF / AC"
                ? "var(--acc2)"
                : red === "SAN"
                ? "var(--san)"
                : red === "LL"
                ? "var(--ll)"
                : red === "GAS"
                ? "var(--gas)"
                : red === "VEN"
                ? "var(--txt3)"
                : "#F87171";
            return (
              <tr key={i}>
                <td>
                  <span
                    className="td-mono"
                    style={{
                      color: col,
                      fontWeight: 600,
                      fontSize: 10,
                    }}
                  >
                    {red}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{param}</td>
                <td className="c">{crit}</td>
                <td className="c td-mono" style={{ fontSize: 10 }}>
                  {norm}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 style={h4}>7.4 Altitudes y presiones atmosféricas</h3>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Altitudes y presiones atmosféricas</caption>
        <thead>
          <tr>
            <th scope="col">Ciudad</th>
            <th scope="col">Altitud (msnm)</th>
            <th scope="col">P atm (kPa)</th>
            <th scope="col">Densidad GN (kg/m³)</th>
          </tr>
        </thead>
        <tbody>
          {TABLAS_ALTITUDES.map(([ciudad, alt, patm, den]) => (
            <tr key={ciudad}>
              <td style={{ fontWeight: 500 }}>{ciudad}</td>
              <td className="c">{alt}</td>
              <td className="c">{patm}</td>
              <td className="c">{den}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
