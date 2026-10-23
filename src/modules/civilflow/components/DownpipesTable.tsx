import { memo, useMemo, useState, useEffect } from 'react';
import { leerDocDePlan } from '../utils/readPlanDrawing.ts';
import EditButton from './shared/EditButton.tsx';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { useTramos } from '../context/TramosContext.tsx';
import type { Tramo } from '../context/tramosReducer';
import { usePisos } from '../context/ProjectContext.tsx';
import { usePlans } from '../context/PlansContext.tsx';
import { useApparatus } from '../context/ApparatusContext.tsx';
import { calculaFilaBajante } from '../utils/bajanteRowModel.ts';
import { buildBajanteGraph } from '../utils/buildBajanteGraph.ts';
import { buildSanConnectivity } from '../utils/sanitaryRows.ts';
import { APARATOS_DEF, SAN_UC_IDS } from '../constants';
import type { DrawingData } from '../utils/drawingSync.ts';
import { EV_SAN_SYNC } from '../utils/fixtureEvents.ts';
import { DownpipesHeader } from './downpipes/DownpipesHeader.tsx';
import { DownpipesRow } from './downpipes/DownpipesRow.tsx';

const BajantesTable = memo(function BajantesTable_() {
  const [edit, setEdit] = useState(false);
  const tablaRef = useStickyThead2Offset();
  const { tramosSan, updTramoSan } = useTramos();
  const { aps, udBase } = useApparatus();
  const { pisos } = usePisos();
  const { plans } = usePlans();
  // ponytail: tick forces storageByPlan refresh after writeBajantePropToDrawing sync event
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    const h = () => setSyncTick((v) => v + 1);
    window.addEventListener(EV_SAN_SYNC, h);
    return () => window.removeEventListener(EV_SAN_SYNC, h);
  }, []);
  const storageByPlan = useMemo(() => {
    const cache: Record<string, DrawingData> = {};
    for (const p of plans || []) {
      const raw = leerDocDePlan<DrawingData | string | null>(p.id);
      if (raw) {
        let d: DrawingData = raw as DrawingData;
        if (typeof raw === 'string') {
          try {
            d = JSON.parse(raw);
          } catch {
            continue;
          }
        }
        cache[String(p.id)] = d;
      }
    }
    return cache;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, syncTick]);
  /** Respaldo geométrico por bajante (pedido del cliente: valen todos los del dibujo):
   *  ramales san (Sanitaria) del mismo plano cuyo extremo toca el bajante (≤0.5, la misma
   *  tolerancia de la poda), aunque recibeDeIds (ramales que llegan al bajante) no los registre. */
  const geoAsocByBaj = useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const t of tramosSan) {
      if (!t.esBajante || t.net === 'vent' || t._net === 'vent') continue;
      const rawDoc = storageByPlan[String(t.planId ?? '')];
      const rawBaj = rawDoc?.bajantes?.find((b) => b.id === t.id);
      const bx = Number(rawBaj?.x);
      const by = Number(rawBaj?.y);
      if (rawDoc == null || !Number.isFinite(bx) || !Number.isFinite(by)) continue;
      const ids: string[] = [];
      for (const r of rawDoc.ramales || []) {
        if (r.net !== 'san' || r.id.startsWith('LD_')) continue;
        const pts = r.pts || [];
        if (pts.length === 0) continue;
        const head = pts[0];
        const tail = pts[pts.length - 1];
        if (
          Math.hypot(head[0] - bx, head[1] - by) <= 0.5 ||
          Math.hypot(tail[0] - bx, tail[1] - by) <= 0.5
        )
          ids.push(r.id);
      }
      if (ids.length) mapa[`${t.id}-${String(t.planId ?? '')}`] = ids;
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramosSan, storageByPlan]);
  // Keep buildBajanteGraph only for vent mapping + components (UD now from sanitaryRows)
  const [, ventToSanMap, ventRamalDiamMap, components] = useMemo(
    () => buildBajanteGraph(plans, tramosSan, udBase),
    [plans, tramosSan, udBase],
  );
  // #5: Unidades de descarga from drawing same source as SanitaryDesign (componentTotalMap)
  const mergedBase = useMemo(() => {
    const defMap = new Map(APARATOS_DEF.map((d) => [d.id, d]));
    return SAN_UC_IDS.map((id) => {
      const fromAps = aps.find((p) => p.id === id);
      const def = defMap.get(id);
      return { id, nombre: def?.nombre || id, ud: fromAps?.ud ?? def?.ud ?? 0 };
    });
  }, [aps]);
  const { componentTotalMap } = useMemo(
    () => buildSanConnectivity(tramosSan, plans, mergedBase),
    [plans, tramosSan, mergedBase],
  );
  // Contexto de cálculo de cada fila (índices ya construidos: sin búsquedas lineales
  // por fila en el render).
  const ctxBajante = useMemo(() => {
    const tramoPorClave = new Map<string, Tramo>();
    const tramoPorClaveExacta = new Map<string, Tramo>();
    for (const tr of tramosSan) {
      const k = tr._key || `${tr.id}-${tr.planId}`;
      if (k) tramoPorClave.set(k, tr);
      if (tr._key) tramoPorClaveExacta.set(tr._key, tr);
    }
    const udPorBajante = new Map<string, number>();
    for (const [k, v] of Object.entries(componentTotalMap)) udPorBajante.set(k, v);
    for (const tr of tramosSan) {
      const k = tr._key;
      if (!k || udPorBajante.has(k) || !tr.planId) continue;
      const alt = `${tr.id}-${tr.planId}`;
      if (componentTotalMap[alt] !== undefined) udPorBajante.set(k, componentTotalMap[alt]);
    }
    return {
      tramosSan,
      plans,
      pisos,
      tramoPorClave,
      tramoPorClaveExacta,
      storageByPlan,
      components,
      ventToSanMap,
      ventRamalDiamMap,
      geoAsocByBaj,
      udPorBajante,
      udBase: mergedBase,
    };
  }, [
    tramosSan,
    plans,
    pisos,
    storageByPlan,
    components,
    ventToSanMap,
    ventRamalDiamMap,
    geoAsocByBaj,
    componentTotalMap,
    mergedBase,
  ]);
  return (
    <section className="card">
      <div className="card-h">
        <h3 className="card-t">
          <img
            src="/iconos_civilflow/diseno_redes/sanitaria/RS_Bajantes.webp"
            alt="Bajantes"
            width={24}
            height={24}
            style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
            loading="lazy"
          />{' '}
          Bajantes de aguas negras y ventilación
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span className="card-s">{tramosSan.filter((t) => t.esBajante).length} bajantes</span>
          <EditButton edit={edit} setEdit={setEdit} />
        </div>
      </div>
      <div style={{ padding: '12px' }}>
        <table
          ref={tablaRef}
          className="tbl"
          style={{ fontSize: 11, tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}
        >
          <caption className="visually-hidden">Bajantes de aguas negras y ventilación</caption>
          <DownpipesHeader />
          <tbody>
            {(() => {
              const banTramos = tramosSan.filter(
                (t) => t.esBajante && t.net !== 'vent' && t._net !== 'vent',
              );
              if (banTramos.length === 0)
                return (
                  <tr>
                    <td
                      colSpan={23}
                      style={{
                        textAlign: 'center',
                        color: 'var(--txt3)',
                        padding: '24px 0',
                        fontSize: 11,
                      }}
                    >
                      No hay bajantes definidos. Marque un tramo como bajante en la tabla de Cálculo
                      de unidades de descarga.
                    </td>
                  </tr>
                );
              return banTramos.map((t) => (
                <DownpipesRow
                  key={t._key || `${t.id}-${t.piso}`}
                  t={t}
                  fila={calculaFilaBajante(t, ctxBajante)}
                  edit={edit}
                  plans={plans}
                  updTramoSan={updTramoSan}
                  storageByPlan={storageByPlan}
                />
              ));
            })()}
          </tbody>
        </table>
      </div>
    </section>
  );
});
export default BajantesTable;
