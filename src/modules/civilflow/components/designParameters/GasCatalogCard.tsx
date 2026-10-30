/** Tarjeta del catálogo de gas en Parámetros de Diseño: aparatos con su Q (Caudal) en m³/h
 *  editable. Ej: subir el caudal de la estufa -> todas las tablas gas lo usan al recalcular. */
// Card "Catálogo de gasodomésticos" de Parámetros de diseño: tabla read-only sobre el
// catálogo NTC 3728 (Norma Técnica Colombiana de gasodomésticos). Sin estado ni handlers —
// el ＋/− de edición no la toca.
import { CAT_GAS } from '../../constants';

/** Formato de tabla NTC: 2 decimales, '—' si el catálogo no trae el valor. */
const fmtNTC = (x: number | null) => (x == null ? '—' : x.toFixed(2));

/**
 * Card del catálogo de gasodomésticos: consumo (m³/h) y potencia (kW) por aparato para
 * gas natural y GLP (gas licuado de petróleo), según NTC 3728. Solo lectura.
 */
export function GasCatalogCard() {
  return (
    <section
      className="card"
      data-tour="datos-gas"
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
    >
      <div className="card-h" style={{ padding: '6px 10px', flexShrink: 0 }}>
        <h3 className="card-t" style={{ fontSize: 13 }}>
          <img
            src="/iconos_civilflow/parametros_de_diseno/catalogo_gasodomesticos.webp"
            alt="Catálogo de gasodomésticos"
            width={20}
            height={20}
            style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 2 }}
            loading="lazy"
          />
          Catálogo de gasodomésticos
        </h3>
        <span className="card-s" style={{ fontSize: 12 }}>
          NTC 3728 · m³/hr
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <table className="tbl" style={{ fontSize: 12, width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th title="Aparato de gas del proyecto." scope="col" style={{ padding: '4px 8px' }}>
                Aparato
              </th>
              <th
                title="Sigla con la que se identifica el aparato."
                scope="col"
                style={{ width: 58, padding: '4px 6px' }}
              >
                Sigla
              </th>
              <th
                title="Consumo de gas natural por hora (m³/h) — tabla gas natural NTC 3728."
                scope="col"
                className="c"
                style={{ width: 106, padding: '4px 6px', whiteSpace: 'normal' }}
              >
                Consumo gas
                <br />
                natural (m³/h)
              </th>
              <th
                title="Potencia según la tabla de gas natural (kW)."
                scope="col"
                className="c"
                style={{ width: 94, padding: '4px 6px', whiteSpace: 'normal' }}
              >
                Potencia gas
                <br />
                natural (kW)
              </th>
              <th
                title="Consumo de GLP por hora (m³/h) — tabla GLP NTC 3728."
                scope="col"
                className="c"
                style={{ width: 76, padding: '4px 6px', whiteSpace: 'normal' }}
              >
                Consumo
                <br />
                GLP (m³/h)
              </th>
              <th
                title="Potencia según la tabla GLP (kW)."
                scope="col"
                className="c"
                style={{ width: 76, padding: '4px 6px', whiteSpace: 'normal' }}
              >
                Potencia
                <br />
                GLP (kW)
              </th>
              <th
                title="Tipo de control del aparato."
                scope="col"
                style={{ width: 68, padding: '4px 6px', whiteSpace: 'normal' }}
              >
                Tipo de
                <br />
                control
              </th>
            </tr>
          </thead>
          <tbody>
            {CAT_GAS.map((g, ix) => (
              <tr key={g.id} style={{ background: ix % 2 === 0 ? 'var(--bg3)' : 'var(--bg2)' }}>
                <td style={{ padding: '3px 8px', fontWeight: 500 }}>
                  <span
                    title={g.n}
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {g.n}
                  </span>
                </td>
                <td style={{ padding: '3px 6px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--txt2)',
                      padding: '0',
                    }}
                  >
                    {g.s.toUpperCase()}
                  </span>
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '3px 6px',
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--txt)',
                  }}
                >
                  {fmtNTC(g.q)}
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '3px 6px',
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--txt)',
                  }}
                >
                  {fmtNTC(g.kw)}
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '3px 6px',
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--txt)',
                  }}
                >
                  {fmtNTC(g.qglp)}
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '3px 6px',
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--txt)',
                  }}
                >
                  {fmtNTC(g.kwglp)}
                </td>
                <td style={{ padding: '3px 6px', fontSize: 12, color: 'var(--txt2)' }}>Llave</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
