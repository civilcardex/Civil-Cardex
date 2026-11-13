/** Paso 1 «Clasifica el riesgo» de la Guía de diseño RCI: la tabla de criterios NFPA 13 por
 *  riesgo (catálogo fijo, fila de ejemplo resaltada) y la explicación de cómo elegirlo.
 *  GENERAL/ILUSTRATIVA (ped. usuario): sin datos del proyecto — usa el ejemplo fijo ROC_GUIA.
 *  Ej: <PasoRiesgo /> pinta la tabla con la fila "Leve" resaltada. */
import { HZ } from '../../../lib/rci/tables.ts';
import { GCAP, TXT, UL, RIESGO_GUIA, type PropsPasoGuia } from './shared.ts';

/** Filas de la tabla de criterios por riesgo (catálogo fijo NFPA 13, resuelto una vez). */
const FILAS_HZ = Object.entries(HZ);

/** Quita "Riesgo " y capitaliza: "Riesgo ordinario G1" → "Ordinario G1". */
const etiquetaRiesgo = (k: string): string => {
  const s = k.replace('Riesgo ', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* 1 · Clasifica el riesgo */
export function PasoRiesgo(_props: PropsPasoGuia) {
  const tabla = (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: 8,
        background: 'var(--bg2)',
        minWidth: 0,
      }}
    >
      <div style={GCAP}>Criterios por riesgo · NFPA 13 (2025), Tabla 19.2.3.1.1 y cap. 10</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th scope="col">Riesgo</th>
              <th scope="col">
                Densidad
                <br />
                gpm/ft²
              </th>
              <th scope="col">
                Área
                <br />
                ft²
              </th>
              <th scope="col">
                Cobertura
                <br />
                máx. ft²
              </th>
              <th scope="col">
                S, L máx.
                <br />m
              </th>
              <th scope="col">
                Mangueras
                <br />
                gpm
              </th>
              <th scope="col">
                Duración
                <br />
                min
              </th>
            </tr>
          </thead>
          <tbody>
            {FILAS_HZ.map(([k, v]) => (
              <tr
                key={k}
                style={k === RIESGO_GUIA ? { background: 'rgba(240,69,69,0.10)' } : undefined}
              >
                <td style={{ fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                  {etiquetaRiesgo(k)}
                </td>
                <td style={{ textAlign: 'center' }}>{v.d}</td>
                <td style={{ textAlign: 'center' }}>{v.a}</td>
                <td style={{ textAlign: 'center' }}>
                  {v.cco !== v.cnc ? `${v.cnc} / ${v.cco} / 130` : String(v.cnc)}
                </td>
                <td style={{ textAlign: 'center' }}>{fmtH(v.s)}</td>
                <td style={{ textAlign: 'center' }}>{v.hose}</td>
                <td style={{ textAlign: 'center' }}>
                  {v.dmax !== v.dmin ? `${v.dmin}–${v.dmax}` : String(v.dmin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={GCAP}>
        Cobertura en riesgo leve (NFPA 13, Tabla 10.2.4.2.1(a)): <b>225 ft²</b> no combustible o
        combustible sin obstrucción; <b>168 ft²</b> combustible obstruido con elementos a 0,91 m o
        más entre ejes; y <b>130 ft²</b> combustible con elementos a menos de 0,91 m. La aplicación
        usa el que corresponda al elegido en <b>Construcción del techo</b>.
      </p>
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {tabla}
      <div>
        <p style={TXT}>
          La clasificación del riesgo (NFPA 13 cap. 4) define todo lo que sigue: cuánta agua por
          metro cuadrado, sobre qué área, cuánto puede cubrir cada rociador y cuánto pueden
          separarse. Hazla antes de dibujar un solo rociador.
        </p>
        <ul style={UL}>
          <li>
            El código de tu país define <b>si</b> el sistema es obligatorio (regístralo en Normativa
            local); NFPA 13 define <b>cómo</b> diseñarlo.
          </li>
          <li>
            Con almacenamiento hasta 3,66 m usa como mínimo riesgo ordinario G2; por encima, NFPA 13
            cap. 20–25 (fuera del alcance).
          </li>
          <li>
            Respuesta rápida (QR): reduce el área solo en sistema húmedo, riesgo leve u ordinario y
            techo ≤ 6,1 m (20 ft); área mínima 768 ft².
          </li>
          <li>
            Sistema seco o techo con pendiente mayor que 2:12: área de diseño +30 % (cada uno).
          </li>
          <li>Presión mínima por rociador: 7 psi o la del listado.</li>
        </ul>
        <p style={TXT}>
          La fila resaltada (<b>{etiquetaRiesgo(RIESGO_GUIA)}</b>) es el ejemplo que ilustran los
          esquemas de esta guía: el riesgo lo eliges tú por piso en{' '}
          <b>Tipologías → Pisos del edificio</b>.
        </p>
      </div>
    </div>
  );
}

/** fmt propio de esta tabla (un decimal). */
function fmtH(v: number): string {
  return String(Math.round(v * 100) / 100);
}
