/** Sección RAS 2000 (Reglamento de Agua y Saneamiento de Colombia): dotaciones y fórmulas de
 *  consulta por estrato. Ej: estrato 4 -> 150 L/hab·día para el diseño af (Agua Fría). */
import {
  RAS2000_DOTACIONES,
  RAS2000_VELOCIDADES,
  RAS2000_LLENADO,
  RAS2000_ESCORRENTIA,
  RAS2000_TR,
} from '../regulationsData.ts';
import { subHeadingStyle as h4, RegTable } from '../shared.tsx';

export function RAS2000() {
  return (
    <div className="card-b" style={{ padding: '18px' }}>
      <h3 style={h4}>2.1 Dotaciones por nivel de complejidad (Tabla B.2.1)</h3>
      <RegTable
        caption="Dotaciones por nivel de complejidad RAS 2000"
        headers={['Nivel de complejidad', 'Dotación neta mínima', 'Dotación neta máxima']}
        rows={RAS2000_DOTACIONES}
      />

      <h3 style={h4}>2.3 Ecuación de Manning (§D.4.3)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: '10px 14px', color: 'var(--txt)' }}>
        <span>∑</span>
        <span>
          <b>V = (1/n) × R²⸍³ × S¹⸍² &nbsp;·&nbsp; Q = V × A</b>
        </span>
      </div>

      <h3 style={h4}>Velocidades en tuberías sanitarias</h3>
      <RegTable
        caption="Velocidades en tuberías sanitarias RAS 2000"
        headers={['Condición', 'Velocidad']}
        rows={RAS2000_VELOCIDADES}
      />

      <h3 style={h4}>Llenado máximo de la sección</h3>
      <RegTable
        caption="Llenado máximo de la sección RAS 2000"
        headers={['Condición', 'y/D']}
        rows={RAS2000_LLENADO}
      />

      <h3 style={h4}>2.5 Aguas lluvias — Método Racional (§D.2)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: '10px 14px', color: 'var(--txt)' }}>
        <span>∑</span>
        <span>
          <b>Q = C × I × A / 360.000</b> &nbsp;—&nbsp; Válido para A &lt; 2 km²
        </span>
      </div>

      <h3 style={h4}>Coeficientes de escorrentía C (Tabla D.2.1)</h3>
      <RegTable
        caption="Coeficientes de escorrentía RAS 2000"
        headers={['Superficie', 'C mínimo', 'C máximo']}
        rows={RAS2000_ESCORRENTIA}
      />

      <h3 style={h4}>Períodos de retorno Tr (Tabla D.2.2)</h3>
      <RegTable
        caption="Períodos de retorno RAS 2000"
        headers={['Tipo de proyecto', 'Tr (años)']}
        rows={RAS2000_TR}
      />
    </div>
  );
}
