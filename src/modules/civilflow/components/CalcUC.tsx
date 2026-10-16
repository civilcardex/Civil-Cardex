import React, { useMemo } from 'react';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import EmptyRow from './shared/EmptyRow';
import { useTramos } from '../context/TramosContext';
import { useApparatus } from '../context/ApparatusContext';
import { APARATOS_DEF, AF_UC_IDS, AC_UC_IDS, pisoCorto } from '../constants';
import { calcUCparcial } from '../utils/componentHelpers';
import { leerLibrosPresion, udPropiaDe } from '../utils/aparatosPresion';
const CalculoUC_S1: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

interface CalculoUCProps {
  tipo: 'af' | 'ac';
}

import { useState, useEffect } from 'react';
import { EV_STORAGE } from '../utils/fixtureEvents';

const monof = 'var(--mono)';
const txt2 = '#94a3b8';
const txt = '#e2e8f0';

function CalculoUC({ tipo }: CalculoUCProps) {
  const tablaRef = useStickyThead2Offset();
  const { tramosAf, tramosAc } = useTramos();
  const { aps } = useApparatus();
  const TIPO_CFG = {
    af: {
      tramos: tramosAf,
      ucIds: AF_UC_IDS,
      field: 'uc_af',
      apField: 'ucaf',
      colorVar: 'var(--af)',
      clsHeader: 'af',
      icon: '/iconos_civilflow/diseno_redes/hidraulica/RAF_Calculo_UC.webp',
      title: 'agua fr\u00EDa',
    },
    ac: {
      tramos: tramosAc,
      ucIds: AC_UC_IDS,
      field: 'uc_ac',
      apField: 'ucac',
      colorVar: 'var(--ac)',
      clsHeader: 'ac',
      icon: '/iconos_civilflow/diseno_redes/hidraulica/RAC_Calculo_UC.webp',
      title: 'agua caliente',
    },
  } as const;
  const { tramos, ucIds, field, apField, colorVar, clsHeader, icon, title } = TIPO_CFG[tipo];

  const AP = useMemo(() => {
    return ucIds
      .map((id) => {
        const a = APARATOS_DEF.find((x) => x.id === id);
        if (!a) return null;
        const fromAps = aps.find((p) => p.id === id);
        const merged = fromAps ? { ...a, [field]: fromAps[apField] || a[field] } : a;
        return { ...merged, _disabled: (a[field] || 0) === 0 };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [ucIds, aps, field, apField]);

  // Herencia de aparatos af/ac (libro aparatos_heredados_v1): se re-lee con cada evento
  // EV_STORAGE (los escritores la despachan al propagar).
  const [heredTick, setHeredTick] = useState(0);
  useEffect(() => {
    const h = () => setHeredTick((x) => x + 1);
    window.addEventListener(EV_STORAGE, h);
    return () => window.removeEventListener(EV_STORAGE, h);
  }, []);
  // Llaveada por clave de conteos (`_aparatosKey ?? _key ?? id`): el id se repite
  // entre pisos y el libro es por clave compuesta (auditoría #3).
  const heredKeyOf = (t: { id: string; _aparatosKey?: string; _key?: string }): string =>
    t._aparatosKey ?? t._key ?? t.id;
  // Heredado + plegado por tramo con UNA sola lectura por store (antes: un JSON.parse
  // completo por tramo y por libro). Mismo tick: ambos libros los escribe la propagación.
  const { heredMap, foldMap } = useMemo(() => {
    const { her, fold } = leerLibrosPresion();
    const hm: Record<string, Record<string, number>> = {};
    const fm: Record<string, Record<string, number>> = {};
    for (const t of tramos) {
      if (!t._aparatosKey) continue;
      hm[heredKeyOf(t)] = her[t._aparatosKey] || {};
      fm[heredKeyOf(t)] = fold[t._aparatosKey] || {};
    }
    return { heredMap: hm, foldMap: fm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramos, heredTick]);

  const totales = useMemo(() => {
    return AP.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      uc: d[field],
      // Σ vertical (orig. usuario): cada aparato cuenta UNA vez — en el tramo que lo sirve
      // (UD propia = clave − heredado − plegado). Los tributarios SÍ suman lo suyo: el de
      // plegado lateral ya vive en el padre (se descuenta vía fold) y el de cadena/cascada
      // solo viaja por arista (sin él la Σ daba 0 con filas llenas, caso RAC5/RAC6-P2).
      cant: tramos.reduce((s, t) => {
        const k = heredKeyOf(t);
        const propia = udPropiaDe(t.fixtures || {}, heredMap[k] || {}, foldMap[k] || {});
        return s + (propia[d.id] || 0);
      }, 0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [AP, tramos, field, heredMap, foldMap]);

  // Celda final de la Σ (como sanitaria): Σ aparatos × UC contados una vez.
  const totalUC = useMemo(
    () => totales.reduce((s, d) => s + (d.cant || 0) * (d.uc || 0), 0),
    [totales],
  );

  const sortedTramos = useMemo(() => {
    return tramos
      .filter((t) => t.tipo !== 'tributario' && (!t.esBajante || t.tipo === 'montante'))
      .toSorted((a, b) => (a.piso || 0) - (b.piso || 0));
  }, [tramos]);

  return (
    <>
      <section className="card">
        <div className="card-h">
          <h3 className="card-t">
            <img
              src={icon}
              alt={`${title}`}
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            Cálculo de unidades de consumo {title}
          </h3>
          <span className="card-s">{tramos.length} tramos</span>
        </div>
        <div className="scroll-top" style={{ padding: '16px' }}>
          <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
            <table ref={tablaRef} className="tbl" style={{ minWidth: 800 }}>
              <caption style={CalculoUC_S1}>{`Cálculo de unidades de consumo ${title}`}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="col-h"
                    rowSpan={2}
                    style={{ minWidth: 84, textAlign: 'center' }}
                    title="Identificador del tramo con su nivel (ej. RAC1-P1 · S1 = sótano · C = cubierta)"
                  >
                    Ramal/Montante
                  </th>
                  <th
                    scope="col"
                    className="col-h"
                    rowSpan={2}
                    style={{ minWidth: 44, textAlign: 'center', padding: '4px' }}
                    title="Punto de inicio del tramo (nodo o bajante de origen)."
                  >
                    Inicio
                  </th>
                  <th
                    scope="col"
                    className="col-h"
                    rowSpan={2}
                    style={{ minWidth: 44, textAlign: 'center', padding: '4px' }}
                    title="Punto donde termina el tramo (nodo o bajante de destino)."
                  >
                    Fin
                  </th>
                  <th
                    scope="col"
                    className={`col-h ${clsHeader}`}
                    colSpan={AP.length}
                    style={{
                      textAlign: 'center',
                      padding: '4px',
                      borderBottom: '2px solid var(--line)',
                    }}
                    title="Conteo de aparatos por tipo del tramo (unidades de consumo por aparato)."
                  >
                    Aparatos
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    rowSpan={2}
                    style={{ minWidth: 90, textAlign: 'center', padding: '4px' }}
                    title="Suma de unidades de consumo del tramo: aparatos × UC (la carga ya incluye lo propagado)."
                  >
                    Unidades de consumo totales
                  </th>
                </tr>
                <tr>
                  {AP.map((d) => (
                    <th
                      key={d.id}
                      className={`col-h ${clsHeader}`}
                      title={`${d.nombre}: ${d[field]} UC por aparato.`}
                      style={{
                        minWidth: 70,
                        fontSize: 12,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        padding: '4px 2px',
                      }}
                    >
                      {d.nombre}
                      <br />
                      <span style={{ fontSize: 12, fontWeight: 400 }}>{d[field]} UC</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tramos.length === 0 ? (
                  <EmptyRow colSpan={3 + AP.length + 1} fontSize={12} />
                ) : (
                  sortedTramos.map((t) => {
                    const hered = heredMap[heredKeyOf(t)] || {};
                    const hUc = AP.reduce(
                      (s2, d2) => s2 + (hered[d2.id] || 0) * (Number(d2[field]) || 0),
                      0,
                    );
                    // Montante: muestra el espejo (propios + asociados); la Σ usa propios.
                    const tDisp =
                      t.fixturesAgg !== undefined ? { ...t, fixtures: t.fixturesAgg } : t;
                    // Celda única (como sanitaria): valor = carga; el desglose propio/heredado
                    // queda en el tooltip. Parcial = UD PROPIA (la clave ya trae la propagada).
                    const parcial = Math.max(0, calcUCparcial(tDisp, AP, field) - hUc);
                    const acum = calcUCparcial(tDisp, AP, field);
                    return (
                      <tr key={heredKeyOf(t)}>
                        <td className="c">
                          <span
                            className="sigla"
                            style={{ fontSize: 12 }}
                            title={`Tramo ${t.id} — nivel ${pisoCorto(t.piso)}`}
                          >
                            {t.label || t.id}
                            {t.piso != null ? `-${pisoCorto(t.piso)}` : ''}
                          </span>
                        </td>
                        <td
                          className="c"
                          style={{
                            fontFamily: monof,
                            fontSize: 12,
                            color: txt2,
                            padding: '2px 4px',
                          }}
                        >
                          {t.ini && typeof t.ini === 'object'
                            ? `${t.ini.x},${t.ini.y}`
                            : t.ini || '\u2014'}
                        </td>
                        <td
                          className="c"
                          style={{
                            fontFamily: monof,
                            fontSize: 12,
                            color: txt2,
                            padding: '2px 4px',
                          }}
                        >
                          {t.fin && typeof t.fin === 'object'
                            ? `${t.fin.x},${t.fin.y}`
                            : t.fin || '\u2014'}
                        </td>
                        {AP.map((d) => {
                          // Como sanitaria: la fila MUESTRA el conteo servido (propios +
                          // propagados según la conexión; el montante, su espejo); la Σ
                          // vertical cuenta una vez.
                          const v = (t.fixturesAgg ?? t.fixtures)?.[d.id] || 0;
                          return (
                            <td key={d.id} className="c" style={{ padding: '2px 3px' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontFamily: monof,
                                  color: d._disabled ? txt2 : txt,
                                }}
                              >
                                {v}
                              </span>
                            </td>
                          );
                        })}
                        <td
                          className="c"
                          title={`Propia: ${parcial} · Heredada: ${hUc} UC`}
                          style={{
                            fontFamily: monof,
                            fontWeight: 700,
                            color: colorVar,
                            fontSize: 14,
                          }}
                        >
                          {acum}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    className="c"
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: txt2,
                      textAlign: 'center',
                      borderTop: '2px solid var(--line)',
                    }}
                  >
                    &sum;
                  </td>
                  <td colSpan={2} style={{ borderTop: '2px solid var(--line)' }}></td>
                  {totales.map((d) => {
                    const subtotal = (d.cant || 0) * (d.uc || 0);
                    return (
                      <td
                        key={d.id}
                        className="c"
                        style={{ padding: '4px 3px', borderTop: '2px solid var(--line)' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1,
                            fontSize: 12,
                            fontFamily: monof,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: txt, fontSize: 12 }}>
                            {d.cant}
                          </span>
                          <span style={{ color: txt2, fontSize: 12 }}>&times; {d.uc} UC</span>
                          <span style={{ fontWeight: 700, color: colorVar, fontSize: 12 }}>
                            {subtotal}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td
                    className="c"
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: txt,
                      fontFamily: monof,
                      textAlign: 'center',
                      borderTop: '2px solid var(--line)',
                    }}
                  >
                    {totalUC} UC
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
export default React.memo(CalculoUC);
