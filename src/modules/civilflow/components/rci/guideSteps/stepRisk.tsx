/** Paso 1 «Clasifique el riesgo» de la Guía de diseño RCI: la tabla de criterios NFPA 13 por
 *  riesgo (con la fila del proyecto resaltada) y la explicación de cómo elegirlo.
 *  Ej: <PasoRiesgo ctx={ctx} chk={chk} /> pinta la tabla y "Tu proyecto: Riesgo leve". */
import { ChipEstado } from '../RCIUI.tsx';
import { fmt } from '../../../utils/rci/RCIRowsModel2.ts';
import { n2 } from '../RCISvgSchemas.tsx';
import { HZ } from '../../../lib/rci/tables.ts';
import { BLOQUE, GCAP, GST, TXT, UL, type PropsPasoGuia } from './shared.ts';

/** Filas de la tabla de criterios por riesgo (catálogo fijo NFPA 13, resuelto una vez). */
const FILAS_HZ = Object.entries(HZ);

/** Quita "Riesgo " y capitaliza: "Riesgo ordinario G1" → "Ordinario G1". */
const etiquetaRiesgo = (k: string): string => {
  const s = k.replace('Riesgo ', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* 1 · Clasifique el riesgo */
export function PasoRiesgo({ ctx, chk }: PropsPasoGuia) {
  const { estado, R } = ctx;
  const ro = R.roc;
  const pais =
    estado.meta.pais && estado.meta.pais !== 'Internacional' && estado.meta.pais !== 'Otro'
      ? `de ${estado.meta.pais}`
      : 'local';
  const tabla = (
    <div style={BLOQUE}>
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
                style={
                  k === estado.clas.riesgo ? { background: 'rgba(240,69,69,0.10)' } : undefined
                }
              >
                <td style={{ fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                  {etiquetaRiesgo(k)}
                </td>
                <td style={{ textAlign: 'center' }}>{fmt(v.d)}</td>
                <td style={{ textAlign: 'center' }}>{v.a}</td>
                <td style={{ textAlign: 'center' }}>
                  {v.cco !== v.cnc ? `${v.cnc} / ${v.cco} / 130` : String(v.cnc)}
                </td>
                <td style={{ textAlign: 'center' }}>{fmt(v.s, 1)}</td>
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
        Cobertura en riesgo leve según el techo: no combustible o sin obstrucción / combustible
        obstruido (elementos ≥ 0,91 m) / elementos a &lt; 0,91 m. NFPA 13-2025 eliminó las curvas
        densidad/área: se usa el punto único de la tabla.
      </p>
    </div>
  );
  return (
    /* Tabla a ancho completo (sin scroll horizontal); la explicación, debajo. */
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
            El código {pais} define <b>si</b> el sistema es obligatorio (regístralo en Normativa
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
          Tu proyecto: <b>{estado.clas.riesgo}</b> (fila resaltada), área de diseño{' '}
          {fmt(ro.Adis, 0)} ft² ({n2(ro.Adis * 0.092903)} m²).
        </p>
        <div style={GST}>
          <span>Riesgo frente a almacenamiento:</span>{' '}
          <ChipEstado st={chk('Riesgo NFPA 13 compatible')} />
          <span>Altura de arrume:</span> <ChipEstado st={chk('Altura de arrume')} />
        </div>
      </div>
    </div>
  );
}
