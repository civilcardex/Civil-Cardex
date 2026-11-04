/** Paneles "Nudos: equilibrio de presiones" y "Detalle nudo a nudo" de la hidráulica RCI (Red
 *  Contra Incendio). En cada nudo gobierna la mayor presión requerida y los demás aportes
 *  descargan más (Q = K·√P, el "Q equilibrado"); el detalle muestra ramal por ramal el paso
 *  nudo a nudo con presiones, caudales y pérdidas. Ej: en el ejemplo el nudo A gobierna R1
 *  (20.29 psi) y R2 se equilibra a 56.51 gpm. */
import type { CSSProperties } from 'react';
import { SecRci } from './RCIUI.tsx';
import { TH, TD } from '../../styles/sharedTableStyles.ts';
import { filasDetalleNudo, filasNudos, fmt } from '../../utils/rci/RCIRowsModel2.ts';
import type { RedResult } from '../../lib/rci/types.ts';

const TH10 = { ...TH, fontSize: 11 } as const;
const TDC = { ...TD, fontSize: 13, padding: '1px 3px' } as const;

const VACIO: CSSProperties = { padding: '10px 12px', fontSize: 12, color: 'var(--txt2)' };

/** Texto de un valor numérico opcional ('—' si no cerró el cálculo). */
const n = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : fmt(x));

/** Texto de un nudo opcional del row de tubería. */
const nud = (x: string | undefined): string => (x ? x : '—');

/** Bloque "Nudos: equilibrio de presiones" (SecRci): qué llega a cada nudo, quién gobierna y
 *  con qué presión. Ej: <PanelNudosRci rd={tip.rd} />. */
export function PanelNudosRci({ rd }: { rd: RedResult }) {
  const filas = filasNudos(rd);
  return (
    <SecRci
      id="nudos"
      titulo="Nudos: equilibrio de presiones"
      icono="/iconos/nudos_equilibrio_presiones.webp"
    >
      {!filas.length ? (
        <div style={VACIO}>
          La tabla de equilibrio aparece cuando la red llega completa a la derivación del montante:
          revise los avisos de Ramales y Tramos.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              className="tbl"
              style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 760 }}
            >
              <caption
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                }}
              >
                Equilibrio de nudos
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={TH10}
                    title="Letra del nudo en el plano: uniones de ramales/tramos y cambios de Ø o cota"
                  >
                    Nudo
                  </th>
                  <th
                    scope="col"
                    style={TH10}
                    title="Ramales y tramos que este nudo alimenta, con su caudal y presión requeridos y el caudal ya equilibrado (→)"
                  >
                    Alimenta a
                  </th>
                  <th
                    scope="col"
                    style={TH10}
                    title="Aporte con la mayor presión requerida: es el que fija la presión del nudo"
                  >
                    Gobierna
                  </th>
                  <th
                    scope="col"
                    style={TH10}
                    title="La mayor presión requerida entre los aportes del nudo"
                  >
                    P requerida (psi)
                  </th>
                  <th
                    scope="col"
                    style={TH10}
                    title="Suma de los caudales equilibrados que salen del nudo"
                  >
                    Q total (gpm)
                  </th>
                  <th
                    scope="col"
                    style={TH10}
                    title="Presión con la que se equilibran los demás aportes (Q = K·√P)"
                  >
                    P equilibrada (psi)
                  </th>
                  <th
                    scope="col"
                    style={TH10}
                    title="Nudo desde el que se alimenta este nudo (hacia la derivación)"
                  >
                    Se alimenta de
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.nudo} style={f.esRaiz ? { background: 'var(--bg3)' } : undefined}>
                    <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                      {f.nudo}
                    </td>
                    <td style={{ ...TDC, textAlign: 'left' }}>
                      {f.alimenta.map((a, i) => (
                        <span key={`${a.nombre}${i}`} style={{ display: 'block' }}>
                          {a.nombre}{' '}
                          <span style={{ color: 'var(--txt3)' }}>
                            ({n(a.Q)} gpm @ {n(a.P)} psi → {a.Qb !== null ? n(a.Qb) : '—'} gpm)
                          </span>
                        </span>
                      ))}
                    </td>
                    <td style={{ ...TDC, textAlign: 'left' }}>{f.gobierna}</td>
                    <td className="c" style={TDC}>
                      {n(f.Preq)}
                    </td>
                    <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                      {n(f.Qtotal)}
                    </td>
                    <td className="c" style={TDC}>
                      {n(f.Pequilibrada)}
                    </td>
                    <td className="c" style={TDC}>
                      {f.seAlimentaDe}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '6px 2px 0', fontSize: 11, color: 'var(--txt3)', lineHeight: 1.45 }}>
            En cada nudo gobierna la mayor presión requerida. Los demás aportes reciben esa presión
            y descargan más: Q = K eq · √P. Por eso el «Q equilibrado» de un ramal puede ser mayor
            que su «Q ramal».
          </p>
        </>
      )}
    </SecRci>
  );
}

/** Bloque "Detalle nudo a nudo" (SecRci): el paso a paso de cada ramal con flujo (el redDetail
 *  del HTML), una tabla compacta por ramal bajo su subtítulo. Ej: el primer paso de R2 arranca
 *  en 8.51 psi con q = 16.34 gpm (rociador más remoto). */
export function PanelDetalleRci({ rd }: { rd: RedResult }) {
  const det = filasDetalleNudo(rd);
  return (
    <SecRci id="detalle" titulo="Detalle nudo a nudo" icono="/iconos/detalle_nudo_a_nudo.webp">
      {!det.length ? (
        <div style={VACIO}>Sin ramales con flujo.</div>
      ) : (
        <>
          {det.map((d) => (
            <div key={d.nombre} style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 3px', fontSize: 12, color: 'var(--txt2)' }}>
                {d.nombre} · rociador{d.rociadores.split('–').length > 1 ? 'es' : ''} {d.rociadores}{' '}
                · Ø {d.dn}
                {d.C !== null ? ` · C = ${d.C}` : ''}
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table
                  className="tbl"
                  style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 640 }}
                >
                  <caption
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                    }}
                  >
                    Detalle de {d.nombre}
                  </caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        style={TH10}
                        title="Nudo de inicio del tramo (letras del plano)"
                      >
                        Nudo ini
                      </th>
                      <th scope="col" style={TH10} title="Nudo de fin del tramo (letras del plano)">
                        Nudo fin
                      </th>
                      <th scope="col" style={TH10} title="Presión al inicio del tramo">
                        P ini (psi)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Caudal del rociador en el nudo inicial (q = K·√P)"
                      >
                        q rociador (gpm)
                      </th>
                      <th scope="col" style={TH10} title="Caudal acumulado que transporta el tramo">
                        Q (gpm)
                      </th>
                      <th scope="col" style={TH10} title="Longitud real del tramo">
                        L (m)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Longitud equivalente: L más los accesorios (tees, codos)"
                      >
                        Leq (m)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Pérdida por fricción del tramo (Hazen-Williams)"
                      >
                        Pf (psi)
                      </th>
                      <th scope="col" style={TH10} title="Pérdida por accesorios del tramo">
                        Pe (psi)
                      </th>
                      <th scope="col" style={TH10} title="Presión al final del tramo">
                        P fin (psi)
                      </th>
                      <th scope="col" style={TH10} title="Velocidad del agua en el tramo">
                        V (m/s)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.pasos.map((p, j) =>
                      p.ok ? (
                        <tr key={j}>
                          <td className="c" style={TDC}>
                            {nud(p.ni)}
                          </td>
                          <td className="c" style={TDC}>
                            {nud(p.nf)}
                          </td>
                          <td className="c" style={TDC}>
                            {n(p.Pini)}
                          </td>
                          <td className="c" style={TDC}>
                            {n(p.q)}
                          </td>
                          <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                            {n(p.Q)}
                          </td>
                          <td className="c" style={TDC}>
                            {n(p.L)}
                          </td>
                          <td className="c" style={TDC}>
                            {n(p.Leq)}
                          </td>
                          <td className="c" style={TDC}>
                            {n(p.Pf)}
                          </td>
                          <td className="c" style={TDC}>
                            {n(p.Pe)}
                          </td>
                          <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                            {n(p.Pfin)}
                          </td>
                          <td className="c" style={TDC}>
                            {n(p.V)}
                          </td>
                        </tr>
                      ) : (
                        <tr key={j}>
                          <td className="c" style={TDC}>
                            {nud(p.ni)}
                          </td>
                          <td className="c" style={TDC}>
                            {nud(p.nf)}
                          </td>
                          <td colSpan={9} style={{ ...TDC, color: 'var(--err, #F04545)' }}>
                            {p.err || 'incompleto'}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </SecRci>
  );
}
