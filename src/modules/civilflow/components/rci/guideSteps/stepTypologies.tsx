/** Paso 6 «Clasifique los pisos» de la Guía de diseño RCI: el alzado del edificio con sus
 *  franjas de tipología y la tabla de tipologías (pisos, representativo ★ y estado de su red).
 *  Ej: <PasoTipologias ctx={ctx} /> pinta "3 pisos · 1 tipología(s) = 1 red(es) por dibujar". */
import type { ReactNode } from 'react';
import { COLOR_ESTADO } from '../RCIUI.tsx';
import { ElevSvg } from '../RCISvgBuilding.tsx';
import { rangoTipologia } from '../../../utils/rci/RCIRowsModelExtras.ts';
import { fmt } from '../../../utils/rci/RCIRowsModel2.ts';
import { num } from '../../../lib/rci/hydraulics.ts';
import { colorTip } from '../RCISvgSchemas.tsx';
import type { Tipologia } from '../../../lib/rci/types.ts';
import { BLOQUE_COMPACTO, GST, TXT, UL, type PropsPasoGuia } from './shared.ts';

/* 6 · Clasifique los pisos */
export function PasoTipologias({ ctx }: PropsPasoGuia) {
  const { estado, R, tips } = ctx;
  const rows = estado.pisos.rows;
  const n = rows.length;
  /** Pisos sin tipología (no se calcula red): una pasada, fuera de bucles (G8). */
  const sinR = rows.filter((_p, i) => !tips.tipOf[i]).length;

  /** Chip de red por tipología (el red() del HTML paso 6): Calculada / Sin red / Incompleta. */
  const chipRed = (g: Tipologia): ReactNode => {
    const t = R.edif.typ[g.id];
    if (!t) return <span style={{ color: 'var(--txt3)' }}>—</span>;
    const st = t.ok ? 'CUMPLE' : t.pend ? 'PENDIENTE' : 'NO CUMPLE';
    const lbl = t.ok ? 'Calculada' : t.pend ? 'Sin red' : 'Incompleta';
    return (
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          fontFamily: 'var(--mono)',
          padding: '1px 5px',
          borderRadius: 8,
          border: `1px solid ${COLOR_ESTADO[st]}`,
          color: COLOR_ESTADO[st],
          whiteSpace: 'nowrap',
        }}
      >
        {lbl}
      </span>
    );
  };

  return (
    /* Alzado arriba (ancho completo) y la tabla de tipologías debajo, sin scroll. */
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={BLOQUE_COMPACTO}>
        <ElevSvg pisos={rows} groups={tips} zBomba={estado.pisos.zBomba} compact={n > 8} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={GST}>
          {n ? (
            <span>
              <b>
                {n} pisos · {tips.groups.length} tipología(s)
              </b>{' '}
              = {tips.groups.length} red(es) por dibujar y calcular.
            </span>
          ) : (
            <span>
              <b>Aún no hay pisos registrados.</b> Para una sola planta basta con un piso.
            </span>
          )}
        </div>
        {n ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th scope="col">Tipología</th>
                  <th scope="col">Pisos</th>
                  <th scope="col">N.º</th>
                  <th scope="col">Representativo ★</th>
                  <th scope="col">Planta</th>
                  <th scope="col">Red</th>
                </tr>
              </thead>
              <tbody>
                {tips.groups.map((g) => {
                  const rep = rows[g.rep];
                  return (
                    <tr key={g.id}>
                      <td>
                        <span
                          style={{
                            background: colorTip(g.id),
                            color: '#fff',
                            borderRadius: 4,
                            padding: '1px 7px',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'var(--mono)',
                          }}
                        >
                          {g.id}
                        </span>
                      </td>
                      <td style={{ color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                        {rangoTipologia(g, rows)}
                      </td>
                      <td style={{ textAlign: 'center' }}>{g.pisos.length}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {rep ? `${rep.nombre} · ${fmt(num(rep.npt))} m` : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{g.planta || '—'}</td>
                      <td>{chipRed(g)}</td>
                    </tr>
                  );
                })}
                {sinR ? (
                  <tr>
                    <td>
                      <span
                        style={{
                          background: 'var(--bg3)',
                          color: 'var(--txt)',
                          borderRadius: 4,
                          padding: '1px 7px',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        —
                      </span>
                    </td>
                    <td>Sin rociadores</td>
                    <td style={{ textAlign: 'center' }}>{sinR}</td>
                    <td style={{ color: 'var(--txt3)' }}>No se calcula red</td>
                    <td />
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
        <p style={TXT}>
          En un edificio no se calcula cada piso: se agrupan los pisos cuya red de rociadores se
          calcula igual. Cada grupo es una <b>tipología</b>; se dibuja y se calcula una red por
          tipología, en su piso representativo ★ (por defecto el más alto, que recibe menos
          presión).
        </p>
        <ul style={UL}>
          <li>
            Cambian la tipología: riesgo, sistema húmedo o seco, altura del techo, QR, construcción
            y pendiente del techo, espacios ocultos, K, S × L y la planta arquitectónica
            (distribución de rociadores y tuberías).
          </li>
          <li>
            La cota <b>no</b> cambia la tipología: la diferencia de altura entre pisos la resuelve
            el perfil de presiones.
          </li>
          <li>
            Pisos sin rociadores (cubiertas, cuartos técnicos) se registran igual: cuentan para el
            montante y el perfil.
          </li>
          {n > 8 ? (
            <li>
              En el corte, los pisos consecutivos de la misma tipología se agrupan en una franja
              (sin escala); el representativo se muestra aparte. Los puntos rojos son salidas del
              montante.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
