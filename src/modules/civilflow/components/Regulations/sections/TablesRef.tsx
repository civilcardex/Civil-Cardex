/** Tablas de referencia de presiones (TABLAS_PRESION): valores normativos de consulta para
 *  af (Agua Fría)/ac (Agua Caliente)/rci (Red Contra Incendio) sin salir de la app. */
import {
  TABLAS_PRESION,
  TABLAS_CAUDALES,
  TABLAS_CRITERIOS,
  TABLAS_ALTITUDES,
} from '../regulationsData.ts';
import { subHeadingStyle as h4, RegTable } from '../shared.tsx';

export function TablasRef() {
  return (
    <div className="card-b" style={{ padding: '18px' }}>
      <h3 style={h4}>7.1 Conversión de unidades de presión</h3>
      <RegTable
        caption="Conversión de unidades de presión"
        headers={['Unidad', 'mca', 'bar', 'PSI', 'kPa', 'mbar']}
        rows={TABLAS_PRESION.map(([u, ...rest]) => [{ t: u, w: 600 }, ...rest])}
      />

      <h3 style={h4}>7.2 Conversión de caudales</h3>
      <RegTable
        caption="Conversión de caudales"
        headers={['Unidad', 'lps', 'lpm', 'm³/hr', 'gpm']}
        rows={TABLAS_CAUDALES.map(([u, ...rest]) => [{ t: u, w: 600 }, ...rest])}
      />

      {/* ponytail: filas con color por red (span td-mono) — estructura extra, queda a mano */}
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
              red === 'AF / AC'
                ? 'var(--acc2)'
                : red === 'SAN'
                  ? 'var(--san)'
                  : red === 'LL'
                    ? 'var(--ll)'
                    : red === 'GAS'
                      ? 'var(--gas)'
                      : red === 'VEN'
                        ? 'var(--txt3)'
                        : '#F87171';
            return (
              <tr key={i}>
                <td>
                  <span
                    className="td-mono"
                    style={{
                      color: col,
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {red}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{param}</td>
                <td className="c">{crit}</td>
                <td className="c td-mono" style={{ fontSize: 12 }}>
                  {norm}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 style={h4}>7.4 Altitudes y presiones atmosféricas</h3>
      <RegTable
        caption="Altitudes y presiones atmosféricas"
        headers={['Ciudad', 'Altitud (msnm)', 'P atm (kPa)', 'Densidad GN (kg/m³)']}
        rows={TABLAS_ALTITUDES}
      />
    </div>
  );
}
