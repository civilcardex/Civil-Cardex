/** Sección NFPA 13 (norma de rci (Red Contra Incendio)): riesgos, densidades y tipos de
 *  rociador de consulta. Ej: riesgo ligero 4.1 L/min·m² -> referencia para el diseño. */
import { NFPA13_RIESGOS, NFPA13_DENSIDADES, NFPA13_ROCIADORES } from '../regulationsData.ts';
import { subHeadingStyle as h4, RegTable } from '../shared.tsx';

export function NFPA13() {
  return (
    <div className="card-b" style={{ padding: '18px' }}>
      <h3 style={h4}>5.1 Clasificación de riesgos (§5.2)</h3>
      <RegTable
        caption="Clasificación de riesgos NFPA 13"
        headers={['Grupo', 'Descripción', 'Ejemplos']}
        rows={NFPA13_RIESGOS.map(([g, d, e]) => [g, { t: d, c: false }, { t: e, c: false }])}
      />

      <h3 style={h4}>5.2 Densidades y áreas de operación (§11.2.3)</h3>
      <RegTable
        caption="Densidades y áreas de operación NFPA 13"
        headers={['Clasificación', 'Densidad (gpm/pie²)', 'Área operación (m²)']}
        rows={NFPA13_DENSIDADES}
      />

      <h3 style={h4}>5.3 Rociadores (§7)</h3>
      <RegTable
        caption="Rociadores NFPA 13"
        headers={['Parámetro', 'Valor']}
        rows={NFPA13_ROCIADORES}
      />
    </div>
  );
}
