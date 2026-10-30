/** Sección NTC 3728 (Norma Técnica Colombiana de gas): presiones, simultaneidad y caudales
 *  de consulta para el diseño gas. */
import { NTC3728_PRESIONES, NTC3728_SIMULTANEIDAD, NTC3728_CAUDALES } from '../regulationsData.ts';
import { subHeadingStyle as h4, RegTable } from '../shared.tsx';

export function NTC3728() {
  return (
    <div className="card-b" style={{ padding: '18px' }}>
      <h3 style={h4}>3.1 Presiones de diseño (§4)</h3>
      <RegTable
        caption="Presiones de diseño NTC 3728"
        headers={['Tipo de red', 'Presión mínima', 'Presión máxima']}
        rows={NTC3728_PRESIONES}
      />

      <h3 style={h4}>3.2 Ecuación de Renouard (§6.2)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: '10px 14px', color: 'var(--txt)' }}>
        <span>∑</span>
        <span>
          <b>ΔP (mbar) = 23200 × L × Q¹·⁸² × DR⁰·⁸² / Di⁴·⁸²</b>
        </span>
      </div>

      <h3 style={h4}>Velocidad máxima: V ≤ 10 m/s</h3>

      <h3 style={h4}>3.5 Factores de simultaneidad fs (§5.3)</h3>
      <RegTable
        caption="Factores de simultaneidad NTC 3728"
        headers={['N° aparatos (n)', 'fs']}
        rows={NTC3728_SIMULTANEIDAD.map(([n, fs]) => [{ t: n, c: true, w: false }, fs])}
      />
      <div
        className="ib info"
        style={{ fontSize: 13, padding: '8px 12px', marginTop: 6, color: 'var(--txt)' }}
      >
        <span>ℹ</span>
        <span>Q_diseño = Q_instalado × fs</span>
      </div>

      <h3 style={h4}>3.6 Caudales de aparatos a gas (Tabla 1 — §5.2)</h3>
      <RegTable
        caption="Caudales de aparatos a gas NTC 3728"
        headers={['Aparato', 'Q (m³/hr)']}
        rows={NTC3728_CAUDALES}
      />
    </div>
  );
}
