/** Sección 5 del diseño RCI (Red Contra Incendio): gabinetes y siamesa NFPA 14 — el resumen de
 *  la demanda de montantes (franja encima) y los bloques "Ruta del montante" (ancla
 *  rci-montantes del «Ir al dato», desde la salida más remota hasta el cuarto de bombas con el
 *  estado de cada tramo) y "Siamesa" (chequeo de la conexión de bomberos). Sin local.exigeSP la
 *  pestaña es un card simple con el salto a Entradas. Ej: Clase III pide 500 gpm @ 100 psi en
 *  la salida más remota y cierra con 127.36 psi en la brida de la bomba. */
import type { CSSProperties } from 'react';
import { SecRci, SubTabsRci, KvTabla, useNavRci, type RciCtx, type SubItemRci } from './RCIUI.tsx';
import { TH, TD } from '../../styles/sharedTableStyles.ts';
import { kvSiamesa } from '../../utils/rci/RCIRowsModel.ts';
import { SUBS_POR_TAB } from '../../utils/rci/RCIRowsModelExtras.ts';
import { filasGabinete, fmt } from '../../utils/rci/RCIRowsModel2.ts';
import { ResumenRci, type MetricaRci } from './RCISummary.tsx';
import { num } from '../../lib/rci/hydraulics.ts';

const TH10 = { ...TH, fontSize: 12 } as const;
const TDC = { ...TD, fontSize: 14, padding: '2px 4px' } as const;

const BTN: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--bg4)',
  color: 'var(--txt2)',
  borderRadius: 5,
  fontSize: 11,
  padding: '4px 10px',
  cursor: 'pointer',
};

/** Color del estado de cada tramo de la ruta: OK verde; P baja/P alta/V alta rojo; reguladora ámbar. */
const COLOR_GAB: Record<string, string> = {
  OK: 'var(--succ, #5DBB83)',
  'P baja': 'var(--err, #F04545)',
  'P alta': 'var(--err, #F04545)',
  'Válv. reguladora': '#E0A400',
  'V alta': 'var(--err, #F04545)',
  Incompleto: 'var(--txt3)',
};

/** "Gab P3" → "P3": el prefijo del HTML no aporta en las etiquetas cortas. */
const gabPiso = (ni: unknown): string => String(ni || '').replace(/^Gab\s+/, '');

/** Sub-pestañas de Gabinetes: la de SUBS_POR_TAB (destino de «Ir al dato») más la siamesa. */
const SUBS_GAB: SubItemRci[] = [
  ...SUBS_POR_TAB['gabinetes'].map((s) => ({
    id: s.id,
    titulo: s.id === 'ruta' ? 'Ruta del montante' : s.l,
  })),
  { id: 'siamesa', titulo: 'Siamesa' },
];

/** Cuerpo de la Sección 5: franja de demanda de montantes encima y las 2 subs (SUBS_GAB):
 *  'ruta' (estado de cada tramo al cuarto de bombas) y 'siamesa' (conexión de bomberos).
 *  Ej: <RciGabinetes ctx={ctx} /> con exigeSP 'No' muestra solo el salto a Entradas. */
export default function RciGabinetes({ ctx }: { ctx: RciCtx }) {
  const { estado, R } = ctx;
  const navGab = useNavRci();
  const { irA } = navGab;
  const activa = navGab.sub ?? 'ruta';
  const spOn = estado.local.exigeSP === 'Sí';

  /* Sin gabinetes dibujados (ped. usuario: la ruta nace del plano) — aviso en vez de filas
     fabricadas. La siamesa sigue visible (es del diseñador). */
  if (spOn && !(estado.gabinetes || []).length) {
    return (
      <section className="card">
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'var(--txt2)',
          }}
        >
          <span>
            Sin gabinetes dibujados: la ruta de montantes y gabinetes nace del plano. Use la
            herramienta Gabinete (tecla J) en la red RCI y confirme el dibujo.
          </span>
          <button type="button" onClick={() => irA('hidraulica', 'ramales')} style={BTN}>
            Ir a Hidráulica
          </button>
        </div>
      </section>
    );
  }

  if (!spOn) {
    return (
      /* Card simple sin header: la pestaña entera es el aviso (montantes no exigidos). */
      <section className="card">
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'var(--txt2)',
          }}
        >
          <span>
            Sin gabinetes: el código local no exige montantes (salidas de manguera). Actívelo en
            Entradas → Normativa local.
          </span>
          <button
            type="button"
            onClick={() => irA('entradas', 'normativa', 'local.exigeSP')}
            style={BTN}
          >
            Ir al dato
          </button>
        </div>
      </section>
    );
  }

  /* Resumen del renderGab del HTML: qué pide la demanda de montantes y qué cierra en la brida. */
  const r0 = R.sp.rows[0];
  const outs = R.sp.rows.filter((r) => r.salida);
  const g = R.gab;
  const items: MetricaRci[] = [
    {
      k: r0
        ? `Presión mínima · salida más remota (${gabPiso(r0.ni)}, cota ${fmt(num(r0.zi))} m)`
        : 'Presión mínima · salida más remota',
      v: `${fmt(R.sp.Preq, 1)} psi`,
      ayuda:
        'NFPA 14: solo en la salida hidráulicamente más remota; abajo llega más presión por diferencia de cota.',
    },
    {
      k:
        outs.length > 1
          ? `Caudal · dos salidas más remotas (${outs.map((r) => gabPiso(r.ni)).join(' + ')})`
          : 'Caudal · salida más remota',
      v: `${fmt(R.sp.Qreq, 0)} gpm`,
    },
    { k: 'Duración', v: `${fmt(R.sp.dur, 0)} min` },
    {
      k: 'Requerido en la brida de la bomba (cuarto de bombas)',
      v: g && g.valid ? `${fmt(g.Qend, 1)} gpm @ ${fmt(g.Pend, 1)} psi` : 'Ruta incompleta',
      peligro: !(g && g.valid),
    },
  ];

  const filas = filasGabinete(R.edif, g);
  const sia = R.sia;
  const pasosSia = sia?.res ? sia.res.rows : [];

  return (
    <>
      <ResumenRci items={items} />
      <SubTabsRci subs={SUBS_GAB} sub={activa} setSub={(id) => irA('gabinetes', id)} ancho={190}>
        {activa === 'ruta' ? (
          filas.length ? (
            /* Ancla rci-montantes: destino del «Ir al dato» de las verificaciones de montantes. */
            <SecRci
              id="montantes"
              titulo="Ruta del montante"
              nota={`Clase ${estado.sp.clase} (NFPA 14)`}
              icono="/iconos/montantes_nfpa14.webp"
            >
              <div style={{ overflowX: 'auto' }}>
                <table
                  className="tbl"
                  style={{ fontSize: 12, borderCollapse: 'collapse', minWidth: 980 }}
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
                    Ruta del montante
                  </caption>
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        style={TH10}
                        title="Gab = gabinete del piso; Base = base del montante; CB = cuarto de bombas"
                      >
                        Tramo
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Salida que descarga en el cálculo: las dos más remotas (Clase I y III) o la más remota (Clase II)"
                      >
                        Salida
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Caudal que descarga la salida de manguera en ese piso (250 gpm por salida en Clase I y III)"
                      >
                        q salida (gpm)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Diámetro nominal del tramo según el plano"
                      >
                        Ø
                      </th>
                      <th scope="col" style={TH10} title="Diámetro con el que se calculó">
                        Ø usado
                      </th>
                      <th scope="col" style={TH10} title="Longitud del tramo en metros">
                        L (m)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="En la primera fila: presión mínima de NFPA 14 en la salida más remota"
                      >
                        P inicio (psi)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Caudal que descarga la salida del nudo inicial"
                      >
                        q entra (gpm)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Caudal acumulado que transporta el tramo hacia la bomba"
                      >
                        Q (gpm)
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Coeficiente de Hazen-Williams del material del tramo"
                      >
                        C
                      </th>
                      <th
                        scope="col"
                        style={TH10}
                        title="Longitud acumulada desde la salida más remota hasta el final de este tramo"
                      >
                        L total (m)
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
                      <th
                        scope="col"
                        style={TH10}
                        title="OK verde; P baja / P alta / V alta rojo; válvula reguladora ámbar"
                      >
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={`${f.desde}-${f.hasta}-${i}`}>
                        <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                          {(f.desde || '—') + ' → ' + (f.hasta || '—')}
                        </td>
                        <td className="c" style={TDC}>
                          {f.salida ? '✓' : ''}
                        </td>
                        <td className="c" style={TDC}>
                          {f.qSalida !== null ? fmt(f.qSalida, 0) : ''}
                        </td>
                        <td className="c" style={TDC}>
                          {f.dn || '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.dnUsado || '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.L !== null ? fmt(f.L) : '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: i === 0 ? 700 : 400 }}>
                          {f.Pini !== null ? fmt(f.Pini) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.qEntra !== null ? fmt(f.qEntra) : '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                          {f.Q !== null ? fmt(f.Q) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.C !== null ? fmt(f.C, 0) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.Ltotal !== null ? fmt(f.Ltotal) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.Pf !== null ? fmt(f.Pf) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.Pe !== null ? fmt(f.Pe) : '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                          {f.Pfin !== null ? fmt(f.Pfin) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.V !== null ? fmt(f.V) : '—'}
                        </td>
                        <td
                          className="c"
                          style={{
                            ...TDC,
                            fontWeight: 700,
                            color: COLOR_GAB[f.estado] || 'var(--txt2)',
                          }}
                          title={f.err || undefined}
                        >
                          {f.estado}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SecRci>
          ) : (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--txt2)' }}>
              La ruta aparece al marcar salidas de manguera en Tipologías y completar el cuarto de
              bombas (Entradas → Montantes).
            </div>
          )
        ) : null}
        {activa === 'siamesa' ? (
          <SecRci id="siamesa" titulo="Siamesa" icono="/iconos/siamesa.webp">
            <KvTabla filas={kvSiamesa(sia)} />
            {sia && pasosSia.length ? (
              <div style={{ marginTop: 8 }}>
                <h5 style={{ margin: '0 0 4px', fontSize: 11.5, color: 'var(--txt2)' }}>
                  Ruta de la salida más remota a la siamesa
                </h5>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    className="tbl"
                    style={{ fontSize: 12, borderCollapse: 'collapse', minWidth: 560 }}
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
                      Ruta a la siamesa
                    </caption>
                    <thead>
                      <tr>
                        <th
                          scope="col"
                          style={TH10}
                          title="Del nudo de la salida más remota a la siamesa (carro de bomberos)"
                        >
                          Tramo
                        </th>
                        <th
                          scope="col"
                          style={TH10}
                          title="Caudal del carro de bomberos que pasa por el tramo"
                        >
                          Q (gpm)
                        </th>
                        <th scope="col" style={TH10} title="Diámetro del tramo de la ruta">
                          Ø
                        </th>
                        <th scope="col" style={TH10} title="Longitud del tramo en metros">
                          L (m)
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
                      </tr>
                    </thead>
                    <tbody>
                      {pasosSia.map((o, i) => {
                        const r = sia.rows[i] || {};
                        return (
                          <tr key={i}>
                            <td className="c" style={{ ...TDC, textAlign: 'left' }}>
                              {gabPiso(r.ni)} → {gabPiso(r.nf)}
                            </td>
                            <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                              {o.ok ? fmt(o.Q, 0) : '—'}
                            </td>
                            <td className="c" style={TDC}>
                              {o.ok ? o.dnUsed || r.dn || '—' : r.dn || '—'}
                            </td>
                            <td className="c" style={TDC}>
                              {fmt(num(r.L))}
                            </td>
                            <td className="c" style={TDC}>
                              {o.ok ? fmt(o.Pf) : '—'}
                            </td>
                            <td className="c" style={TDC}>
                              {o.ok ? fmt(o.Pe) : '—'}
                            </td>
                            <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                              {o.ok ? fmt(o.Pfin, 1) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p
                  style={{
                    margin: '6px 2px 0',
                    fontSize: 11,
                    color: 'var(--txt3)',
                    lineHeight: 1.45,
                  }}
                >
                  P fin del último tramo = presión requerida en las entradas de la siamesa. El carro
                  de bomberos alimenta el montante sin la bomba del edificio; se supone la siamesa
                  conectada en la base del montante (si entra en otro punto, ajuste longitud y
                  accesorios en Entradas → Siamesa).
                </p>
              </div>
            ) : (
              <p style={{ margin: '8px 2px 0', fontSize: 11.5, color: 'var(--txt3)' }}>
                La ruta del carro de bomberos aparece al completar la siamesa en Entradas → Siamesa
                (material, Ø y longitud).
              </p>
            )}
          </SecRci>
        ) : null}
      </SubTabsRci>
    </>
  );
}
