/** Sección NTC 3096 (Norma Técnica Colombiana de vent (Ventilación sanitaria)): parámetros
 *  de ventilación de consulta (dimensionado de rejillas y tuberías de ventilación). */
import { NTC3096_PARAMS } from '../regulationsData.ts';
import { RegTable } from '../shared.tsx';

export function NTC3096() {
  return (
    <div className="card-b" style={{ padding: '18px' }}>
      <RegTable
        caption="Parámetros NTC 3096"
        headers={['Parámetro', 'Valor']}
        rows={NTC3096_PARAMS}
      />
      <div
        className="ib info"
        style={{ fontSize: 13, padding: '8px 12px', marginTop: 8, color: 'var(--txt)' }}
      >
        <span>ℹ</span>
        <span>CPVC RDE 11: relación D externo / espesor = 11</span>
      </div>
    </div>
  );
}
