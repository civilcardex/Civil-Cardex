/** Sección NSR-10 (Norma Sismo Resistente): clasificación de edificaciones y altura según
 *  uso — requisitos de consulta para el diseño. */
import { NSR10_CLASIFICACION, NSR10_ALTURA } from '../regulationsData.ts';
import { subHeadingStyle as h4, RegTable } from '../shared.tsx';

export function NSR10() {
  return (
    <div className="card-b" style={{ padding: '18px' }}>
      <h3 style={h4}>4.1 Clasificación por tipo de ocupación (J.2)</h3>
      <RegTable
        caption="Clasificación por tipo de ocupación NSR-10"
        headers={['Tipo', 'Clasificación', 'Ejemplos']}
        rows={NSR10_CLASIFICACION.map(([tipo, clas, ej]) => [
          { t: tipo, c: true, w: 600 },
          { t: clas, c: false },
          { t: ej, c: false },
        ])}
      />

      <h3 style={h4}>4.2 Requisitos según altura y ocupación (J.4)</h3>
      <RegTable
        caption="Requisitos según altura y ocupación NSR-10"
        headers={['Altura edificación', 'Tipo A', 'Tipo B', 'Tipo C']}
        rows={NSR10_ALTURA}
      />
    </div>
  );
}
