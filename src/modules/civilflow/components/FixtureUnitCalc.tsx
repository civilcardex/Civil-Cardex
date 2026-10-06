import React, { useMemo } from 'react';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { useTramos } from '../context/TramosContext';
import { useApparatus } from '../context/ApparatusContext';
import { usePlans } from '../context/PlansContext';
import { APARATOS_DEF, SAN_UC_IDS, pisoCorto } from '../constants';
import { buildSanConnectivity } from '../utils/sanitaryRows';
const FixtureUnitCalc_S1: React.CSSProperties = {
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

/** Descendientes transitivos de una clave de tramo en fullChildrenMap (DFS iterativo;
 *  visited evita ciclos en grafos con co-sumideros). */
function descendientesDe(fullChildrenMap: Record<string, string[]>, start: string): string[] {
  const visited = new Set<string>([start]);
  const stack = [...(fullChildrenMap[start] || [])];
  const out: string[] = [];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    out.push(cur);
    for (const child of fullChildrenMap[cur] || []) if (!visited.has(child)) stack.push(child);
  }
  return out;
}

function CalculoUD() {
  const tablaRef = useStickyThead2Offset();
  const { tramosSan } = useTramos();
  const { aps } = useApparatus();
  const { plans } = usePlans();

  const mergedBase = useMemo(() => {
    return SAN_UC_IDS.map((id) => {
      const fromAps = aps.find((p) => p.id === id);
      const def = APARATOS_DEF.find((x) => x.id === id);
      return {
        id,
        nombre: def?.nombre || id,
        ud: fromAps?.ud || def?.ud || 0,
        _disabled: (def?.ud || 0) === 0,
      };
    });
  }, [aps]);

  const { componentTotalMap, fullChildrenMap } = useMemo(() => {
    return buildSanConnectivity(tramosSan, plans, mergedBase);
  }, [plans, tramosSan, mergedBase]);

  // Orig. #12: la tabla incluye ramales y bajantes — primero los ramales del piso, después los
  // bajantes del piso.
  const displayTramos = useMemo(() => {
    return tramosSan
      .filter((t) => (t.tipo === 'ramal' && !t.esBajante) || t.esBajante)
      .sort((a, b) => {
        if ((a.piso || 0) !== (b.piso || 0)) return (a.piso || 0) - (b.piso || 0);
        if (a.esBajante !== b.esBajante) return a.esBajante ? 1 : -1;
        return 0;
      });
  }, [tramosSan]);

  const tramosCount = useMemo(
    () => displayTramos.filter((t) => !t.esBajante).length,
    [displayTramos],
  );

  // Índice clave→tramo: el desglose de abajo consulta O(1) en vez de tramosSan.find() por
  // descendiente (era O(n²·m), visible con tablas grandes).
  const tramosByKey = useMemo(() => {
    const m = new Map<string, (typeof tramosSan)[number]>();
    for (const x of tramosSan) m.set(x._key || `${x.id}-${x.piso}`, x);
    return m;
  }, [tramosSan]);

  // Descendientes + desglose por aparato (tooltip diagnóstico) precalculados UNA vez por
  // render: cuánto es propio del tramo y qué tributarios hereda — expone el origen de
  // cualquier conteo de más. Las celdas solo consultan el memo.
  const detallePorTramo = useMemo(() => {
    const desc = new Map<string, string[]>();
    const detalle = new Map<string, Record<string, string>>();
    for (const t of displayTramos) {
      const tKey = t._key || `${t.id}-${t.piso}`;
      const descendantKeys = descendientesDe(fullChildrenMap, tKey);
      desc.set(tKey, descendantKeys);
      const fila: Record<string, string> = {};
      for (const d of mergedBase) {
        const propia = t.fixtures[d.id] || 0;
        const partes = descendantKeys
          .map((ck) => {
            const ct = tramosByKey.get(ck);
            return ct && !ct.esBajante && (ct.tipo === 'ramal' || ct.tipo === 'tributario')
              ? { ct, v: ct.fixtures[d.id] || 0 }
              : null;
          })
          .filter((x): x is { ct: (typeof tramosSan)[number]; v: number } => !!x && x.v > 0);
        const heredada = partes.reduce((s, x) => s + x.v, 0);
        fila[d.id] = `Propia: ${propia}${
          partes.length
            ? ` · Heredada: ${heredada} (${partes.map((x) => `${x.ct.id}-${pisoCorto(x.ct.piso)}: ${x.v}`).join(', ')})`
            : ''
        }`;
      }
      detalle.set(tKey, fila);
    }
    return { desc, detalle };
  }, [displayTramos, fullChildrenMap, mergedBase, tramosByKey]);
  const bajantesCount = useMemo(
    () => displayTramos.filter((t) => t.esBajante).length,
    [displayTramos],
  );

  const totales = useMemo(() => {
    return mergedBase.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      ud: d.ud,
      cant: tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0),
    }));
  }, [mergedBase, tramosSan]);

  const totalUD = useMemo(() => {
    return totales.reduce((s, d) => s + (d.cant || 0) * (d.ud || 0), 0);
  }, [totales]);

  return (
    <>
      <section className="card">
        <div className="card-h">
          <h3 className="card-t">
            <img
              src="/iconos_civilflow/diseno_redes/sanitaria/RS_Calculo_UC.webp"
              alt="Cálculo unidades de descarga"
              width={24}
              height={24}
              style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
              loading="lazy"
            />{' '}
            Cálculo de unidades de descarga
          </h3>
          <span className="card-s">
            {tramosCount} tramos / {bajantesCount} bajantes
          </span>
        </div>
        <div className="scroll-top" style={{ padding: '16px' }}>
          <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
            <table ref={tablaRef} className="tbl" style={{ minWidth: 900 }}>
              <caption style={FixtureUnitCalc_S1}>Cálculo de unidades de descarga</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="col-h"
                    rowSpan={2}
                    style={{ minWidth: 90, textAlign: 'center' }}
                    title="Identificador del tramo con su nivel (ej. RAC1-P1 · S1 = sótano · C = cubierta)"
                  >
                    Ramal/Bajante
                  </th>
                  <th
                    scope="col"
                    className="col-h"
                    rowSpan={2}
                    style={{ minWidth: 60, textAlign: 'center' }}
                    title="Punto de inicio del tramo (nudo o bajante de origen)."
                  >
                    Inicio
                  </th>
                  <th
                    scope="col"
                    className="col-h"
                    rowSpan={2}
                    style={{ minWidth: 60, textAlign: 'center' }}
                    title="Punto donde termina el tramo (nudo o bajante de destino)."
                  >
                    Fin
                  </th>
                  <th
                    scope="col"
                    className="col-h san"
                    colSpan={mergedBase.length}
                    style={{ textAlign: 'center', borderBottom: '2px solid var(--line)' }}
                    title="Conteo de aparatos por tipo del tramo y sus tributarios (UD por aparato debajo)."
                  >
                    Aparatos
                  </th>
                  <th
                    scope="col"
                    className="col-h ok"
                    rowSpan={2}
                    style={{ minWidth: 90, textAlign: 'center' }}
                    title="Suma de unidades de descarga del tramo: aparatos × UD, acumulando sus tributarios."
                  >
                    Unidades de descarga totales
                  </th>
                </tr>
                <tr>
                  {mergedBase.map((d) => (
                    <th
                      key={d.id}
                      className="col-h san"
                      title={`${d.nombre}: ${d.ud} UD por aparato (NTC 1500).`}
                      style={{ minWidth: 52, fontSize: 12, textAlign: 'center' }}
                    >
                      {d.nombre}
                      <br />
                      <span style={{ fontSize: 12, fontWeight: 400 }}>{d.ud} UD</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTramos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3 + mergedBase.length + 1}
                      style={{
                        padding: '24px 0',
                        textAlign: 'center',
                        color: 'var(--txt3)',
                        fontSize: 12,
                      }}
                    >
                      No hay tramos. Dibuja ramales en el visor para que aparezcan aquí.
                    </td>
                  </tr>
                ) : (
                  displayTramos.map((t) => {
                    const tKey = t._key || `${t.id}-${t.piso}`;
                    const acum = componentTotalMap[tKey] || 0;
                    const descendantKeys = detallePorTramo.desc.get(tKey) ?? [];
                    // Desglose de aparatos: incluye tributarios y ramales que llegan vía fullChildrenMap transitivo
                    const detalleUd = detallePorTramo.detalle.get(tKey);
                    const extraFixtures: Record<string, number> = { ...t.fixtures };
                    for (const ck of descendantKeys) {
                      const ct = tramosByKey.get(ck);
                      if (!ct || ct.esBajante) continue;
                      if (ct.tipo !== 'ramal' && ct.tipo !== 'tributario') continue;
                      for (const d of mergedBase)
                        extraFixtures[d.id] = (extraFixtures[d.id] || 0) + (ct.fixtures[d.id] || 0);
                    }
                    return (
                      <tr key={tKey}>
                        <td className="c">
                          <span
                            className="sigla"
                            style={{ fontSize: 12, fontWeight: 600 }}
                            title={`Tramo ${t.id} — nivel ${pisoCorto(t.piso)}`}
                          >
                            {t.id}
                            {t.piso != null ? `-${pisoCorto(t.piso)}` : ''}
                          </span>
                        </td>
                        <td className="c">
                          <span
                            style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--txt)' }}
                          >
                            {t.ini && typeof t.ini === 'object'
                              ? `${t.ini.x},${t.ini.y}`
                              : t.ini || '—'}
                          </span>
                        </td>
                        <td className="c">
                          <span
                            style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--txt)' }}
                          >
                            {t.fin && typeof t.fin === 'object'
                              ? `${t.fin.x},${t.fin.y}`
                              : t.fin || '—'}
                          </span>
                        </td>
                        {mergedBase.map((d) => (
                          <td key={d.id} className="c" style={{ padding: '2px 3px' }}>
                            <span
                              title={`${d.nombre}: ${detalleUd?.[d.id] || 'Propia: 0'}`}
                              style={{
                                fontSize: 12,
                                fontFamily: 'var(--mono)',
                                color: d._disabled ? 'var(--txt3)' : 'var(--txt)',
                              }}
                            >
                              {extraFixtures[d.id] ?? 0}
                            </span>
                          </td>
                        ))}
                        <td
                          className="c"
                          style={{
                            fontFamily: 'var(--mono)',
                            fontWeight: 700,
                            color: 'var(--txt)',
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
                      color: 'var(--txt3)',
                      textAlign: 'center',
                      borderTop: '2px solid var(--line)',
                    }}
                  >
                    ∑
                  </td>
                  <td style={{ borderTop: '2px solid var(--line)' }}></td>
                  <td style={{ borderTop: '2px solid var(--line)' }}></td>
                  {totales.map((d) => {
                    const subtotal = (d.cant || 0) * (d.ud || 0);
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
                            fontFamily: 'var(--mono)',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--txt)', fontSize: 12 }}>
                            {d.cant}
                          </span>
                          <span style={{ color: 'var(--txt3)', fontSize: 12 }}>× {d.ud} UD</span>
                          <span style={{ fontWeight: 700, color: 'var(--san)', fontSize: 12 }}>
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
                      color: 'var(--txt)',
                      fontFamily: 'var(--mono)',
                      textAlign: 'center',
                      borderTop: '2px solid var(--line)',
                    }}
                  >
                    {totalUD} UD
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

export default React.memo(CalculoUD);
