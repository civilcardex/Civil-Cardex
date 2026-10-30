/** Sección NTC 1500 (Norma Técnica Colombiana de instalaciones sanitarias): dotaciones por
 *  aparato y kg UH de consulta. Ej: vivienda -> 120 L/hab·día y sus UD por aparato. */
import {
  NTC1500_DOTACIONES,
  NTC1500_UC,
  NTC1500_HAZEN_C,
  NTC1500_VELOCIDADES,
  NTC1500_UD,
  NTC1500_PENDIENTES,
  NTC1500_CAPACIDAD,
  NTC1500_VENTILACION,
} from '../regulationsData.ts';
import { subHeadingStyle as h4, RegTable } from '../shared.tsx';

export function NTC1500() {
  return (
    <div className="card-b" style={{ padding: '18px' }}>
      <h3 style={h4}>1.1 Dotaciones de diseño (§4)</h3>
      <RegTable
        caption="Dotaciones de diseño NTC 1500"
        headers={['Uso', 'Dotación mínima', 'Dotación máxima']}
        rows={NTC1500_DOTACIONES}
      />

      <h3 style={h4}>1.2 Unidades de consumo UC (Tabla 1 — §5)</h3>
      <RegTable
        caption="Unidades de consumo NTC 1500"
        headers={['Aparato', 'Sigla', 'UC AF', 'UC AC', 'P mín (mca)', 'P máx (mca)']}
        rows={NTC1500_UC.map(([nom, sig, uca, ucac, pmin, pmax]) => [
          nom,
          { t: sig, c: false, sigla: true },
          uca,
          ucac,
          pmin,
          pmax,
        ])}
      />

      <h3 style={h4}>1.4 Cálculo hidráulico — Hazen-Williams (§5.4)</h3>
      <div className="ib info" style={{ fontSize: 14, padding: '10px 14px', color: 'var(--txt)' }}>
        <span>∑</span>
        <span>
          <b>Hf = 10.67 × L × Q¹·⁸⁵² / (C¹·⁸⁵² × D⁴·⁸⁷)</b>
        </span>
      </div>

      <h3 style={h4}>Coeficientes C de Hazen-Williams</h3>
      <RegTable
        caption="Coeficientes C Hazen-Williams"
        headers={['Material', 'C']}
        rows={NTC1500_HAZEN_C}
      />

      <h3 style={h4}>Velocidades permisibles</h3>
      <RegTable
        caption="Velocidades permisibles NTC 1500"
        headers={['Condición', 'Velocidad']}
        rows={NTC1500_VELOCIDADES}
      />

      <h3 style={h4}>1.7 Unidades de desagüe UD (Tabla 2 — §8)</h3>
      <RegTable
        caption="Unidades de desagüe NTC 1500"
        headers={['Aparato', 'UD', 'D mín ramal', 'D mín bajante']}
        rows={NTC1500_UD}
      />

      <h3 style={h4}>1.8 Pendientes mínimas (§8.3)</h3>
      <RegTable
        caption="Pendientes mínimas NTC 1500"
        headers={['Diámetro', 'Pendiente mínima', 'Pendiente recomendada']}
        rows={NTC1500_PENDIENTES.map(([d, min, rec]) => [{ t: d, c: true }, min, rec])}
      />
      <div className="ib warn" style={{ fontSize: 12, padding: '8px 12px', marginTop: 6 }}>
        <span>⚠</span>
        <span>NTC 1500 permite S = 1% para D ≥ 2" con justificación hidráulica.</span>
      </div>

      <h3 style={h4}>1.9 Capacidad máxima de desagüe por diámetro (Tabla 3 — §8.4)</h3>
      <RegTable
        caption="Capacidad máxima de desagüe NTC 1500"
        headers={[
          'D (pulg)',
          'UD máx ramal horizontal',
          'UD máx bajante 1 piso',
          'UD máx bajante ≥ 3 pisos',
        ]}
        rows={NTC1500_CAPACIDAD.map(([d, rh, b1, b3]) => [{ t: `${d}"`, c: true }, rh, b1, b3])}
      />

      <h3 style={h4}>1.10 Ventilación (§9)</h3>
      <RegTable
        caption="Ventilación NTC 1500"
        headers={['Parámetro', 'Valor', 'Artículo']}
        rows={NTC1500_VENTILACION}
      />
    </div>
  );
}
