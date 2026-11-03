/** Sección 6 del diseño RCI (Red Contra Incendio): perfil de presiones del edificio — franja
 *  de resumen encima y dos bloques titulados (SecRci): "Gráfico del perfil" (el esquema del
 *  montante piso a piso, curvas requerida/disponible/estática y franja del jockey en reposo,
 *  con su panel lateral de diagnóstico) y "Presiones piso a piso" (la tabla con la acción
 *  sugerida en cada piso). Ej: en el ejemplo P3 gobierna la bomba y P1 pide válvulas por su
 *  estática de 170.62 psi cerca de los 175 psi de los componentes. */
import { SecRci, SubTabsRci, type RciCtx, type SubItemRci, useNavRci } from './uiRci.tsx';
import { TH, TD } from '../../styles/sharedTableStyles.ts';
import { SUBS_POR_TAB } from '../../utils/rci/rowsModelExtras.ts';
import {
  accionPerfil,
  filasPerfilPiso,
  fmt,
  txt,
  type ChipPerfil,
} from '../../utils/rci/rowsModelRci2.ts';
import { PERFIL_SIDE_INFO, PF_NOTAS, perfilSideFilas } from './rciSvgEdificio.tsx';
import { PerfilSvg } from './rciSvgPerfil.tsx';
import { colorTip } from './rciSvgEsquemas.tsx';
import { ResumenRci, type MetricaRci } from './rciSummary.tsx';

const TH10 = { ...TH, fontSize: 11 } as const;
const TDC = { ...TD, fontSize: 13, padding: '2px 4px' } as const;

/** Color de cada chip de acción (OK verde / NO rojo / REVISAR ámbar / PENDIENTE gris). */
const COLOR_ACC: Record<string, string> = {
  OK: 'var(--succ, #5DBB83)',
  NO: 'var(--err, #F04545)',
  REVISAR: '#E0A400',
  PENDIENTE: 'var(--txt3)',
};

/** Texto corto del chip cuando no se pasa el texto largo de la acción. */
const TXT_ACC: Record<string, string> = {
  OK: 'OK',
  NO: 'Corregir',
  REVISAR: 'Revisar',
  PENDIENTE: 'Pendiente',
};

/** Chip de acción del perfil: el color del estado y el texto (largo o corto). */
function ChipAccion({ c, txt: t }: { c: string; txt?: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '1px 6px',
        borderRadius: 8,
        border: `1px solid ${COLOR_ACC[c] || 'var(--line)'}`,
        color: COLOR_ACC[c] || 'var(--txt2)',
        whiteSpace: 'nowrap',
      }}
    >
      {t || TXT_ACC[c] || c}
    </span>
  );
}

/** Sub-pestañas del Perfil: la de SUBS_POR_TAB (destino de «Ir al dato») más la tabla piso a piso. */
const SUBS_PERFIL: SubItemRci[] = [
  ...SUBS_POR_TAB['perfil'].map((s) => ({
    id: s.id,
    titulo: s.id === 'grafico' ? 'Gráfico del perfil' : s.l,
  })),
  { id: 'pisos', titulo: 'Presiones piso a piso' },
];

/** Cuerpo de la Sección 6 "Perfil": sub 'grafico' (PerfilSvg + diagnóstico lateral) y sub
 *  'pisos' (tabla de presiones piso a piso con la acción sugerida). Ej: <RciPerfil ctx={ctx} />
 *  con Pc 175 psi marca las VRP (Válvula Reductora de Presión) por piso en el resumen. */
export default function RciPerfil({ ctx }: { ctx: RciCtx }) {
  const { estado, R, tips } = ctx;
  /* La sub abierta vive en la nav del shell (RciDesign). */
  const navPerf = useNavRci();
  const activa = navPerf.sub ?? 'grafico';
  const edif = R.edif;
  const b = R.bomba;
  const gov = edif.gov;
  const Pc = edif.Pc || 175;
  const filas = filasPerfilPiso(edif);
  /* Conteos del resumen: VRP (Válvula Reductora de Presión) y válvulas reguladoras 1½" por piso. */
  let nVrp = 0;
  let nReg = 0;
  for (const o of filas) {
    if (o.vrp) nVrp++;
    if (o.reg) nReg++;
  }
  const items: MetricaRci[] = [
    { k: 'Piso que gobierna la bomba', v: gov ? `${gov.f.nombre} (${txt(gov.tId) || '—'})` : '—' },
    {
      k: 'Demanda D1 (rociadores + mangueras)',
      v: `${fmt(b.D1.Q, 1)} gpm @ ${fmt(b.D1.P, 1)} psi netos`,
    },
    { k: 'Bomba', v: `${fmt(b.Qnom, 0)} gpm @ ${fmt(b.Pnom, 0)} psi` },
    {
      k: 'Estática máxima (punto más bajo)',
      v: `${fmt(edif.PstMax, 1)} psi`,
      peligro: (edif.PstMax ?? 0) > 350,
      ayuda: 'Sobre 350 psi se debe dividir el edificio en zonas de presión.',
    },
    { k: 'VRP / válvulas reguladoras', v: `${nVrp} / ${nReg}` },
  ];
  const ladoFilas = perfilSideFilas(edif.pf, Pc, edif.hmin || 0);
  /* La línea de 100 psi de la reguladora 1½" solo existe con montantes que llevan gabinete. */
  const spLinea = estado.local.exigeSP === 'Sí' && estado.sp.clase !== 'Clase I';

  return (
    <>
      <ResumenRci items={items} />
      <SubTabsRci
        subs={SUBS_PERFIL}
        sub={activa}
        setSub={(id) => navPerf.irA('perfil', id)}
        ancho={210}
      >
        {activa === 'grafico' ? (
          <SecRci id="perfil" titulo="Gráfico del perfil" icono="/iconos/grafico_perfil.webp">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 300px',
                gap: 14,
                alignItems: 'start',
              }}
            >
              <PerfilSvg edif={edif} bomba={b} tips={tips} sp={spLinea} />
              <aside style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5, minWidth: 0 }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--txt2)' }}>
                  Para qué sirve
                </h4>
                <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                  {PERFIL_SIDE_INFO(Pc).map((nn) => (
                    <li key={nn.t}>
                      <b>{nn.t}</b> {nn.d}
                    </li>
                  ))}
                </ul>
                <h4 style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--txt2)' }}>Qué hacer</h4>
                {ladoFilas.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {ladoFilas.map((f, i) => (
                      <li key={`${f.piso}-${i}`} style={{ marginBottom: 3 }}>
                        <ChipAccion c={f.st} /> <b>{f.piso}</b>: {f.txt}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0 }}>
                    <ChipAccion c="OK" /> Todos los pisos tienen holgura y quedan dentro de los
                    límites.
                  </p>
                )}
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--txt2)' }}>
                    Notas técnicas
                  </summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11.5 }}>
                    {PF_NOTAS(Pc).map((nn) => (
                      <li key={nn.t} style={{ marginBottom: 4 }}>
                        <b>{nn.t}:</b> {nn.d}
                      </li>
                    ))}
                  </ul>
                </details>
              </aside>
            </div>
          </SecRci>
        ) : null}
        {activa === 'pisos' ? (
          <SecRci
            id="pisos"
            titulo="Presiones piso a piso"
            icono="/iconos/presiones_piso_piso.webp"
          >
            <div style={{ overflowX: 'auto' }}>
              <table
                className="tbl"
                style={{ fontSize: 11, borderCollapse: 'collapse', minWidth: 980 }}
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
                  Presiones piso a piso
                </caption>
                <thead>
                  <tr>
                    <th scope="col" style={TH10}>
                      Piso
                    </th>
                    <th scope="col" style={TH10}>
                      NPT (m)
                    </th>
                    <th scope="col" style={TH10}>
                      Tipología
                    </th>
                    <th scope="col" style={TH10}>
                      Cota deriv. (m)
                    </th>
                    <th scope="col" style={TH10}>
                      Q piso (gpm)
                    </th>
                    <th scope="col" style={TH10}>
                      P requerida deriv. (psi)
                    </th>
                    <th scope="col" style={TH10}>
                      P disponible (psi)
                    </th>
                    <th scope="col" style={TH10}>
                      Holgura (psi)
                    </th>
                    <th
                      scope="col"
                      style={TH10}
                      title="Contra la presión de trabajo de los componentes (Pc)"
                    >
                      Estática deriv. (psi)
                    </th>
                    <th scope="col" style={TH10}>
                      Salida
                    </th>
                    <th scope="col" style={TH10}>
                      Estática salida (psi)
                    </th>
                    <th scope="col" style={TH10}>
                      Residual 1½" (psi)
                    </th>
                    <th scope="col" style={TH10}>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const acc: ChipPerfil[] = accionPerfil(f, Pc);
                    return (
                      <tr
                        key={`${f.nombre}-${f.i}`}
                        style={f.gobierna ? { background: 'rgba(93,187,131,0.08)' } : undefined}
                      >
                        <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                          {f.nombre}
                        </td>
                        <td className="c" style={TDC}>
                          {f.npt !== null ? fmt(f.npt, 2) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.tId !== '—' ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 8,
                                background: colorTip(f.tId),
                                color: '#fff',
                              }}
                            >
                              {f.tId}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="c" style={TDC}>
                          {f.zT !== null ? fmt(f.zT, 2) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.Q !== null ? fmt(f.Q, 1) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.Preq !== null ? fmt(f.Preq, 1) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.disp !== null ? fmt(f.disp, 1) : '—'}
                        </td>
                        <td className="c" style={{ ...TDC, fontWeight: 700 }}>
                          {f.holg !== null ? (
                            <span
                              style={{
                                color:
                                  f.okH === false ? 'var(--err, #F04545)' : 'var(--succ, #5DBB83)',
                              }}
                            >
                              {f.holg >= 0 ? '+' : ''}
                              {fmt(f.holg, 1)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td
                          className="c"
                          style={{
                            ...TDC,
                            color: (f.Pst ?? 0) > Pc ? 'var(--err, #F04545)' : undefined,
                          }}
                        >
                          {f.Pst !== null ? fmt(f.Pst, 1) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.salida === 'Ninguna' ? '—' : f.salida}
                        </td>
                        <td className="c" style={TDC}>
                          {f.salida !== 'Ninguna' && f.PstS !== null ? fmt(f.PstS, 1) : '—'}
                        </td>
                        <td className="c" style={TDC}>
                          {f.res15 !== null ? fmt(f.res15, 1) : '—'}
                        </td>
                        <td style={{ ...TDC, textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {acc.map((a, i2) => (
                            <span key={`${a.txt}-${i2}`} style={{ marginRight: 4 }}>
                              <ChipAccion c={a.c} txt={a.txt} />
                            </span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={13} style={TDC}>
                        El perfil aparece al ingresar los NPT de los pisos (Tipologías).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p
              style={{ margin: '6px 2px 0', fontSize: 11, color: 'var(--txt3)', lineHeight: 1.45 }}
            >
              Disponible: la bomba con el caudal de ese piso (más mangueras), menos las pérdidas del
              montante y del cuarto de bombas y el desnivel. Holgura = disponible − requerida.
              Estática: presión de cierre de la bomba más la succión máxima, menos el desnivel.
            </p>
          </SecRci>
        ) : null}
      </SubTabsRci>
    </>
  );
}
