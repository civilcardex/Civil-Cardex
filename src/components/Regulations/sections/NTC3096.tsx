import {
  NTC3096_PARAMS,
} from "../regulationsData";

export function NTC3096() {
  return (
    <div className="card-b" style={{ padding: "18px" }}>
      <table className="tbl" style={{ fontSize: 12 }}>
        <caption className="visually-hidden">Parámetros NTC 3096</caption>
        <thead>
          <tr>
            <th scope="col">Parámetro</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {NTC3096_PARAMS.map(([p, v]) => (
            <tr key={p}>
              <td style={{ fontWeight: 500 }}>{p}</td>
              <td className="c">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ib info" style={{ fontSize: 13, padding: "8px 12px", marginTop: 8, color: "var(--txt)" }}>
        <span>ℹ</span>
        <span>CPVC RDE 11: relación D externo / espesor = 11</span>
      </div>
    </div>
  );
}
