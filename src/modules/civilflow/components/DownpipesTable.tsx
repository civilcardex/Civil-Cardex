import { memo, useMemo, useCallback, useState, useEffect } from 'react';
import EditButton from './shared/EditButton';
import { useStickyThead2Offset } from './shared/useStickyThead2Offset';
import { useTramos } from '../context/TramosContext';
import type { Tramo } from '../context/tramosReducer';
import { usePisos } from '../context/ProjectContext';
import { usePlans } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { maxSanRamalDiamPulg } from '../utils/bajanteVentRows';
import { avisarDiametroInvalido } from '../utils/diametroValidation';
import { renderStatus, calcUDparcial } from '../utils/componentHelpers';
import { fmtPiso, DIAM_BAN, DIAM_BAN_SAN, DIAM_VENT, pisoCorto } from '../constants';
import { fmt } from '../utils/formatUtils';
import { parseDescargaEnId } from '../utils/parseDescargaEnId';
import { buildBajanteGraph } from '../utils/buildBajanteGraph';
import { buildSanConnectivity } from '../utils/sanitaryRows';
import { APARATOS_DEF, SAN_UC_IDS } from '../constants';
import type { DrawingData, RawElement } from '../utils/drawingSync';
import { ventBajPulg, calculateVentStack } from '../utils/ventStackCalc';
import {
  writeBajantePropToDrawing,
  writeDiametroToDrawing,
  writeDiametroToDrawingBatch,
} from '../utils/writeDiameterToDrawing';

interface RamalWithDiam extends RawElement {
  diamPulg?: number;
}

const DownpipesTable_S1: React.CSSProperties = {
  width: 40,
  padding: 2,
  textAlign: 'center',
  fontFamily: 'var(--mono)',
  fontSize: 9.5,
  background: 'var(--bg2)',
  border: '1px solid var(--line)',
  color: 'var(--txt)',
};

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
    window.addEventListener('civilflow_san_sync_changed', h);
    return () => window.removeEventListener('civilflow_san_sync_changed', h);
  }, []);

  const storageByPlan = useMemo(() => {
    const cache: Record<string, DrawingData> = {};
    for (const p of plans || []) {
      const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + p.id, null);
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

  const getBajanteTotalUD = useCallback(
    (bKey: string): number => {
      if (!bKey) return 0;
      // primary key is _key (id-planId). Fallback to id-planId split variants
      if (componentTotalMap[bKey] !== undefined) return componentTotalMap[bKey];
      // try alternate planId resolution via tramosSan
      const tr = tramosSan.find((x) => x._key === bKey);
      if (tr?.planId) {
        const alt = `${tr.id}-${tr.planId}`;
        if (componentTotalMap[alt] !== undefined) return componentTotalMap[alt];
      }
      // last fallback: sum propias if no connectivity entry
      return componentTotalMap[bKey] ?? 0;
    },
    [componentTotalMap, tramosSan],
  );

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
          style={{ fontSize: 9.5, tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}
        >
          <caption className="visually-hidden">Bajantes de aguas negras y ventilación</caption>
          <thead>
            <tr>
              <th
                title="Identificación, unidades de descarga y parámetros comunes."
                scope="col"
                className="col-h san"
                colSpan={9}
                style={{ textAlign: 'center', padding: '1px 2px', fontSize: 9.5 }}
              >
                INFORMACIÓN
                <br />
                COMÚN
              </th>
              <th
                title="Chequeo de capacidad del bajante de aguas negras."
                scope="col"
                className="col-h ok"
                colSpan={7}
                style={{ textAlign: 'center', padding: '1px 2px', fontSize: 9.5 }}
              >
                BAJANTES
                <br />
                AGUAS NEGRAS
              </th>
              <th
                title="Dimensionamiento de la tubería de ventilación del edificio."
                scope="col"
                className="col-h ven"
                colSpan={7}
                style={{ textAlign: 'center', padding: '1px 2px', fontSize: 9.5 }}
              >
                TUBERÍA DE
                <br />
                VENTILACIÓN
              </th>
            </tr>
            <tr>
              <th
                title="Bajante de aguas negras (BAN) según el dibujo."
                scope="col"
                className="col-h san"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                No.
              </th>
              <th
                title="Piso de origen y de destino de la descarga."
                scope="col"
                className="col-h san"
                colSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Nivel
              </th>
              <th
                title="Ramales sanitarios que drenan a este bajante."
                scope="col"
                className="col-h san"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Ramales
                <br />
                Asociados
              </th>
              <th
                title="Unidades de descarga (Hunter): propias del bajante y acumuladas."
                scope="col"
                className="col-h san"
                colSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Unidades
                <br />
                Descarga
              </th>
              <th
                title="Fracción de la sección del tubo ocupada por el agua (flujo anular)."
                scope="col"
                className="col-h san"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Llenado
                <br />
              </th>
              <th
                title="Caudal de diseño por unidades de descarga (L/s). Unidad: L/s."
                scope="col"
                className="col-h san"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Caudal
              </th>
              <th
                title="Rugosidad del material de la bajante."
                scope="col"
                className="col-h san"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Manning
                <br />
              </th>
              <th
                title="Diámetro del bajante: calculado vs propuesto."
                scope="col"
                className="col-h ok"
                colSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Diámetro
              </th>
              <th
                title="Estado del chequeo de diámetros."
                scope="col"
                className="col-h ok"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Chequeo
              </th>
              <th
                title="Capacidad máxima del diámetro propuesto (L/s). Unidad: L/s."
                scope="col"
                className="col-h ok"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Caudal <br /> máximo
              </th>
              <th
                title="Velocidad terminal del flujo en el tubo (m/s). Unidad: m/s."
                scope="col"
                className="col-h ok"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Velocidad <br /> terminal
              </th>
              <th
                title="Longitud terminal: calculada y la mínima recomendada (m)."
                scope="col"
                className="col-h ok"
                colSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Longitud
                <br />
                terminal
              </th>
              <th
                title="Velocidad del aire en el núcleo de la ventilación (m/s). Unidad: m/s."
                scope="col"
                className="col-h ven"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Velocidad
                <br />
                aire
              </th>
              <th
                title="Fricción usada para el cálculo de la ventilación."
                scope="col"
                className="col-h ven"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Fricción
                <br />
                (ƒ)
              </th>
              <th
                title="Caudal de aire que transporta la ventilación (L/s). Unidad: L/s."
                scope="col"
                className="col-h ven"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Caudal <br /> Aire
              </th>
              <th
                title="Longitud desarrollada de la ventilación (m) — editable. Unidad: m."
                scope="col"
                className="col-h ven"
                rowSpan={2}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Longitud <br /> Bajante
              </th>
              <th
                title="Diámetro de ventilación: calculado, propuesto y su chequeo."
                scope="col"
                className="col-h ven"
                colSpan={3}
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Diámetro
                <br />
                Ventilación
              </th>
            </tr>
            <tr>
              <th
                title="Piso donde nace el bajante."
                scope="col"
                className="col-h san"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Origen
              </th>
              <th
                title="Bajante o ramal donde descarga."
                scope="col"
                className="col-h san"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Destino
              </th>
              <th
                title="Unidades de descarga generadas en el propio bajante."
                scope="col"
                className="col-h san"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Parcial
              </th>
              <th
                title="Unidades de descarga totales acumuladas."
                scope="col"
                className="col-h san"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Acumulada
              </th>
              <th
                title="Diámetro que exige el caudal de diseño (pulg). Unidad: ″."
                scope="col"
                className="col-h ok"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Calculado
              </th>
              <th
                title="Diámetro comercial propuesto (pulg). Unidad: ″."
                scope="col"
                className="col-h ok"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Propuesto
              </th>
              <th
                title="Longitud terminal calculada con la velocidad (m). Unidad: m."
                scope="col"
                className="col-h ok"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Calculada
              </th>
              <th
                title="Longitud terminal mínima recomendada (m). Unidad: m."
                scope="col"
                className="col-h ok"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Mínima
              </th>
              <th
                title="Diámetro de ventilación que exige el caudal de aire (pulg). Unidad: ″."
                scope="col"
                className="col-h ven"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Calculado
              </th>
              <th
                title="Diámetro comercial de ventilación propuesto (pulg). Unidad: ″."
                scope="col"
                className="col-h ven"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Propuesto
              </th>
              <th
                title="Estado del chequeo de la ventilación."
                scope="col"
                className="col-h ven"
                style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9.5 }}
              >
                Chequeo
              </th>
            </tr>
          </thead>
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
                        fontSize: 9.5,
                      }}
                    >
                      No hay bajantes definidos. Marque un tramo como bajante en la tabla de Cálculo
                      de unidades de descarga.
                    </td>
                  </tr>
                );

              const tramoById: Record<string, Tramo> = {};
              for (const tr of tramosSan) {
                const k = tr._key || `${tr.id}-${tr.planId}`;
                if (k) tramoById[k] = tr;
              }

              return banTramos.map((t) => {
                const rVal = t.bajR;
                const rStr =
                  rVal != null ? (Math.abs(rVal - 7 / 24) < 0.001 ? '7/24' : '1/4') : null;

                const propiasUD = calcUDparcial(t, mergedBase);
                const planIdStr = t.planId || (t._key ? t._key.split('-')[1] : '');

                let targetPiso = '';
                let destinoVal = '—';
                if (t.descargaEnId) {
                  const parts = parseDescargaEnId(t.descargaEnId, '');
                  const dPlanId = parts[0];
                  const targetRamal = parts[1] || '';
                  const targetPlan = plans?.find((p) => String(p.id) === String(dPlanId));
                  if (targetPlan && targetPlan.nivel != null) {
                    targetPiso = targetPlan.nivel.toString();
                    const targetPisoVal = fmtPiso(targetPiso, pisos);
                    // Etiqueta corta ramal-piso (ej. BAN1-P1), mismo estilo que los
                    // ramales recibidos (ped. usuario: sin prefijo 'Bajante: '/'Ramal: ').
                    destinoVal = targetRamal ? `${targetRamal}-${targetPisoVal}` : targetPisoVal;
                  } else {
                    destinoVal = targetRamal || '—';
                  }
                }

                const ramalesIds = (t.recibeDeIds || []).filter(
                  // Solo ramales del MISMO piso del bajante (orig. usuario): el id debe
                  // existir entre los tramos san de ese piso.
                  (rid) =>
                    !!tramosSan.find(
                      (x) => x.id === rid && String(x.planId ?? '') === String(t.planId ?? ''),
                    ),
                );
                const ramalesAsocVal =
                  ramalesIds.length > 0
                    ? ramalesIds.map((rid) => `${rid}-${pisoCorto(t.piso)}`).join(', ')
                    : '—';

                let totalUD = getBajanteTotalUD(t._key || `${t.id}-${planIdStr}`);
                let ramalesUD = totalUD - propiasUD;

                if (t._net === 'vent' || t.net === 'vent') {
                  const sanKeys = ventToSanMap[t._key || `${t.id}-${planIdStr}`] || [];
                  totalUD = 0;
                  for (const sk of sanKeys) {
                    totalUD += getBajanteTotalUD(sk);
                  }
                  ramalesUD = totalUD;
                }

                const n = t.nmaning || 0.009;
                const origenVal = fmtPiso(t.piso?.toString() || '', pisos);
                const pisosRange = targetPiso ? `${t.piso}-${targetPiso}` : `${t.piso}-${t.piso}`;

                const tKey = t._key || `${t.id}-${planIdStr}`;
                const tComp = components.find((c) => c.includes(tKey)) || [tKey];

                const isVent = t.net === 'vent' || t._net === 'vent';

                // Buscar claves de Bajante de Ventilación asociadas (desde vMap)
                const ventBajKeys: string[] = [];
                for (const [vKey, sanKeys] of Object.entries(ventToSanMap || {})) {
                  if (sanKeys.some((sk) => tComp.includes(sk))) {
                    if (!ventBajKeys.includes(vKey)) ventBajKeys.push(vKey);
                  }
                }

                // Buscar claves de Bajante Sanitario asociadas
                const sanBajKeys: string[] = [];
                if (isVent) {
                  const sanKeys = ventToSanMap[tKey] || [];
                  for (const sk of sanKeys) {
                    const comp = components.find((c) => c.includes(sk)) || [sk];
                    for (const k of comp) {
                      const x = tramoById[k];
                      if (x && x.esBajante && x.net !== 'vent' && x._net !== 'vent') {
                        if (!sanBajKeys.includes(k)) sanBajKeys.push(k);
                      }
                    }
                  }
                } else {
                  for (const k of tComp) {
                    const x = tramoById[k];
                    if (x && x.esBajante && x.net !== 'vent' && x._net !== 'vent') {
                      if (!sanBajKeys.includes(k)) sanBajKeys.push(k);
                    }
                  }
                }

                // 1. Resolver el diámetro propuesto sanitario
                let resolvedSanDprop = 0;
                let sanBajKey = '';
                if (!isVent) {
                  resolvedSanDprop = t.bajDprop || 0;
                  sanBajKey = tKey;
                } else {
                  for (const sk of sanBajKeys) {
                    const st = tramosSan.find((x) => x._key === sk);
                    if (st) {
                      resolvedSanDprop = st.bajDprop || 0;
                      sanBajKey = sk;
                      break;
                    }
                  }
                }
                const ventRamalDiamPulg = (() => {
                  let vKey = t.ventRamalKey;
                  if (!vKey) {
                    for (const vk of ventBajKeys) {
                      const vt = tramosSan.find((x) => x._key === vk);
                      if (vt && vt.ventRamalKey) {
                        vKey = vt.ventRamalKey;
                        break;
                      }
                    }
                  }
                  if (!vKey) return 0;
                  const fromMap = ventRamalDiamMap[vKey];
                  if (fromMap && fromMap > 0) return fromMap;
                  const parts = vKey.split('-');
                  const vrId = parts[0];
                  const vPlanId = parts.slice(1).join('-');
                  const raw = storageByPlan[vPlanId];
                  if (!raw) return 0;
                  for (const vr of (raw.ramales || []) as RamalWithDiam[]) {
                    if (vr.id === vrId && (vr._net === 'vent' || vr.net === 'vent')) {
                      return (
                        vr.diamPulg ||
                        (vr.diametro ? parseFloat(String(vr.diametro).replace(/[^0-9.]/g, '')) : 0)
                      );
                    }
                  }
                  return 0;
                })();

                // 2. Resolver el diámetro propuesto de ventilación — el MAYOR del D vent
                // propuesto de los bajantes de ventilación conectados (Item 2: mismo
                // diámetro para todos); si no hay, el del propio BAN (ventDprop) y como
                // última opción el del ramal de ventilación conectado (BREV), que antes
                // quedaba como vacío (orig. usuario).
                let resolvedVentDprop = 0;
                let ventBajKey = '';
                if (isVent) {
                  resolvedVentDprop = t.bajDprop || 0;
                  ventBajKey = tKey;
                } else {
                  // Los tramos vent NO existen en tramosSan (buildTramos los salta) — leer
                  // el BREV directamente del storage: diamPulg (sincronizado por el
                  // autosave) o parse del dNominal.
                  let maxVPulg = 0;
                  for (const vk of ventBajKeys) {
                    if (!ventBajKey) ventBajKey = vk;
                    const vp = vk.split('-');
                    const vId = vp[0];
                    const vPlan = vp.slice(1).join('-');
                    const doc = storageByPlan[vPlan];
                    const vb = (doc?.bajantes || []).find(
                      (x) => x.id === vId && (x.net === 'vent' || x._net === 'vent'),
                    );
                    if (!vb) continue;
                    const vPulg = ventBajPulg(vb);
                    if (vPulg > maxVPulg) maxVPulg = vPulg;
                  }
                  resolvedVentDprop =
                    maxVPulg > 0 ? maxVPulg : t.ventDprop || 0 || ventRamalDiamPulg || 0;
                }

                const ventDiamWarn =
                  ventRamalDiamPulg > 0 &&
                  resolvedVentDprop > 0 &&
                  resolvedVentDprop < ventRamalDiamPulg;

                // Mayor diámetro san de los ramales conectados — helper compartido con la
                // memoria de bajantes (bajanteVentRows).
                const maxSanConectDiam = maxSanRamalDiamPulg(
                  t.recibeDeIds,
                  t.planId || (t._key ? t._key.split('-')[1] : ''),
                  storageByPlan,
                );

                const sanDiamWarn =
                  maxSanConectDiam > 0 &&
                  resolvedSanDprop > 0 &&
                  resolvedSanDprop < maxSanConectDiam;

                // Por defecto el bajante toma el mayor diámetro de sus ramales conectados.
                const effSanDprop = resolvedSanDprop > 0 ? resolvedSanDprop : maxSanConectDiam;

                const res = calculateVentStack({
                  bajante: t.id,
                  pisos: pisosRange,
                  UD_propias: propiasUD,
                  UD_otros: ramalesUD,
                  UD_acum: totalUD,
                  r: t.bajR,
                  n: t.nmaning || 0.009,
                  bajDprop: effSanDprop || 0,
                  bajLong: t.bajLong || 3,
                  bajFDarcy: t.bajFDarcy || 0.025,
                  ventDprop: resolvedVentDprop || 0,
                });

                const Q = res.Q_Ls;
                const DcalcPulg = res.Dcalc_pulg;
                const chequeo = res.chequeoDiam;
                const QmaxB = res.QmaxBajante;
                const Vt = res.Vt;
                const Ltcalc = res.Lt_calc;
                const Ltmin = res.Lt_min;
                const fDarcy = t.bajFDarcy ?? 0;
                const Vair = res.V_aire;
                const Qair = res.Q_aire_Ls;
                const DventCalcPulg = res.D_vent_calc_pulg;
                const DventPropPulg = res.D_vent_prop_pulg;

                return (
                  <tr key={t._key || `${t.id}-${t.piso}`}>
                    <td className="c">
                      <span className="sigla" style={{ fontSize: 9.5 }}>
                        {t.code || t.id}
                      </span>
                    </td>
                    <td
                      className="c"
                      style={{
                        padding: '1px 1px',
                        fontSize: 9.5,
                        fontFamily: 'var(--mono)',
                        color: 'var(--txt)',
                      }}
                    >
                      {origenVal}
                    </td>
                    <td
                      className="c"
                      style={{
                        padding: '1px 1px',
                        fontSize: 9.5,
                        fontFamily: 'var(--mono)',
                        color: 'var(--txt)',
                      }}
                    >
                      {destinoVal}
                    </td>
                    <td
                      className="c"
                      style={{
                        fontSize: 9.5,
                        color: 'var(--txt2)',
                        fontFamily: 'var(--mono)',
                        padding: '1px 1px',
                      }}
                    >
                      {/* Mismo estilo de chips que "Ramales asociados" de diseño de redes:
                            borde y texto con el color de la red san. */}
                      {ramalesAsocVal === '—' ? (
                        <span style={{ fontSize: 9.5, color: 'var(--txt3)' }}>—</span>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          {Array.from(new Set(ramalesAsocVal.split(', '))).map((rid) => (
                            <span
                              key={rid}
                              style={{
                                fontSize: 9,
                                padding: '1px 1px',
                                border: '1px solid var(--san)',
                                borderRadius: 3,
                                color: 'var(--san)',
                                fontFamily: 'var(--mono)',
                                lineHeight: 1.3,
                              }}
                            >
                              {rid}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td
                      className="c"
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        fontSize: 9.5,
                        padding: '1px 1px',
                      }}
                    >
                      {propiasUD > 0 ? propiasUD : '—'}
                    </td>
                    <td
                      className="c"
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        fontSize: 9.5,
                        padding: '1px 1px',
                      }}
                    >
                      {totalUD > 0 ? totalUD : '—'}
                    </td>
                    <td className="c" style={{ padding: '1px 1px' }}>
                      <select
                        value={rStr || '7/24'}
                        aria-label="Llenado (R)"
                        disabled={!edit}
                        onChange={(e) => {
                          const num = e.target.value === '1/4' ? 0.25 : 7 / 24;
                          // Bidireccional (orig. usuario): escribe el bajante en el dibujo
                          // (engine vivo o storage) y refleja el valor en el tramo.
                          const targetKey = t._key || `${t.id}-${planIdStr}`;
                          writeBajantePropToDrawing(targetKey, t.net || 'san', 'bajR', num, plans);
                          updTramoSan(targetKey, 'bajR', num);
                        }}
                        style={{
                          fontSize: 9.5,
                          padding: '1px 2px',
                          background: 'var(--bg2)',
                          border: '1px solid var(--line)',
                          borderRadius: 2,
                          color: 'var(--txt)',
                          fontFamily: 'var(--mono)',
                          maxWidth: 64,
                          opacity: edit ? 1 : 0.6,
                        }}
                      >
                        <option value="7/24">7/24</option>
                        <option value="1/4">1/4</option>
                      </select>
                    </td>
                    <td
                      className="c"
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 600,
                        fontSize: 9.5,
                        padding: '1px 1px',
                      }}
                    >
                      {Q > 0 ? Q.toFixed(2) : '—'}
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontSize: 9.5, padding: '1px 1px' }}
                    >
                      {n > 0 ? n.toFixed(3) : '—'}
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontSize: 9.5, padding: '1px 1px' }}
                    >
                      {DcalcPulg > 0 ? DcalcPulg.toFixed(2) + '"' : '—'}
                    </td>
                    <td className="c" style={{ padding: '1px 1px' }}>
                      <select
                        aria-label="Diámetro Bajante Propuesto"
                        value={resolvedSanDprop || ''}
                        disabled={!edit}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const matched = DIAM_BAN.find((d) => d.pulg === val);
                          let nom = matched ? matched.nom : '';
                          if (val > 0 && maxSanConectDiam > 0 && val < maxSanConectDiam) {
                            avisarDiametroInvalido(
                              `El diámetro del bajante no puede ser inferior al del ramal sanitario (${maxSanConectDiam}")`,
                            );
                            nom = '';
                          }
                          if (!nom && val > 0) return;
                          const targetKey = sanBajKey || tKey;
                          writeBajantePropToDrawing(targetKey, 'san', 'dNominal', nom, plans);
                          // #6: immediate local state for real-time chequeo
                          updTramoSan(targetKey, 'bajDprop', nom ? val : 0);
                        }}
                        style={{
                          fontSize: 9.5,
                          padding: '2px 4px',
                          background: 'var(--bg2)',
                          border: sanDiamWarn ? '1px solid var(--err)' : '1px solid var(--line)',
                          color: sanDiamWarn ? 'var(--err)' : 'var(--txt)',
                          fontWeight: sanDiamWarn ? 'bold' : 'normal',
                          borderRadius: 2,
                          width: '100%',
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">—</option>
                        {DIAM_BAN_SAN.map((d) => (
                          <option key={d.pulg} value={d.pulg}>
                            {d.nom}
                          </option>
                        ))}
                      </select>
                      {sanDiamWarn && (
                        <div
                          style={{
                            fontSize: 9.5,
                            color: 'var(--err)',
                            marginTop: 2,
                            lineHeight: 1.2,
                          }}
                        >
                          Debe ser mayor o igual al &oslash; del ramal san. ({maxSanConectDiam}
                          &quot;)
                        </div>
                      )}
                    </td>
                    <td className="c" style={{ fontSize: 9.5, padding: '1px 1px' }}>
                      {renderStatus(chequeo)}
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontSize: 9.5, padding: '1px 1px' }}
                    >
                      {QmaxB > 0 ? QmaxB.toFixed(2) : '—'}
                    </td>
                    <td className="c" style={{ fontSize: 9.5, padding: '1px 1px' }}>
                      {Vt > 0 ? Vt.toFixed(2) : '—'}
                    </td>
                    <td className="c" style={{ fontSize: 9.5, padding: '1px 1px' }}>
                      {Ltcalc > 0 ? Ltcalc.toFixed(2) : '—'}
                    </td>
                    <td className="c" style={{ fontSize: 9.5, padding: '1px 1px' }}>
                      {Ltmin > 0 ? Ltmin.toFixed(2) : '—'}
                    </td>
                    <td className="c" style={{ fontSize: 9.5, padding: '1px 1px' }}>
                      {Vair > 0 ? Vair.toFixed(2) : '—'}
                    </td>
                    <td className="c" style={{ padding: '1px 1px' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5 }}>
                        {fDarcy > 0 ? fDarcy.toFixed(3) : '—'}
                      </span>
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontSize: 9.5, padding: '1px 1px' }}
                    >
                      {Qair > 0 ? Qair.toFixed(2) : '—'}
                    </td>
                    <td className="c" style={{ padding: '1px 1px' }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Longitud del bajante (m)"
                        style={DownpipesTable_S1}
                        disabled={!edit}
                        value={
                          t.bajLong != null
                            ? !edit
                              ? fmt(Number(t.bajLong), 2)
                              : String(t.bajLong)
                            : ''
                        }
                        placeholder="—"
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, '.');
                          // Permitir vacío y solo números + punto
                          if (raw === '') {
                            const tk = t._key || `${t.id}-${planIdStr}`;
                            writeBajantePropToDrawing(
                              tk,
                              t._net || t.net || 'san',
                              'bajLong',
                              '',
                              plans,
                            );
                            updTramoSan(tk, 'bajLong', '');
                            return;
                          }
                          if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;
                          const tk = t._key || `${t.id}-${planIdStr}`;
                          // Guardar como string para permitir "5." intermedio, convertir a número en blur
                          writeBajantePropToDrawing(
                            tk,
                            t._net || t.net || 'san',
                            'bajLong',
                            raw,
                            plans,
                          );
                          updTramoSan(tk, 'bajLong', raw as unknown as number);
                        }}
                        onBlur={(e) => {
                          const raw = e.target.value.replace(/,/g, '.').trim();
                          const tk = t._key || `${t.id}-${planIdStr}`;
                          if (raw === '') {
                            writeBajantePropToDrawing(
                              tk,
                              t._net || t.net || 'san',
                              'bajLong',
                              '',
                              plans,
                            );
                            updTramoSan(tk, 'bajLong', '');
                            return;
                          }
                          const val = parseFloat(raw);
                          if (!isNaN(val)) {
                            writeBajantePropToDrawing(
                              tk,
                              t._net || t.net || 'san',
                              'bajLong',
                              val,
                              plans,
                            );
                            updTramoSan(tk, 'bajLong', val);
                          }
                        }}
                      />
                    </td>
                    <td
                      className="c"
                      style={{ fontFamily: 'var(--mono)', fontSize: 9.5, padding: '1px 1px' }}
                    >
                      {DventPropPulg > 0
                        ? DventCalcPulg > 0
                          ? DventCalcPulg.toFixed(2) + '"'
                          : '--'
                        : '--'}
                    </td>
                    <td className="c" style={{ padding: '1px 1px' }}>
                      <select
                        aria-label="Diámetro Ventilación Propuesto"
                        value={resolvedVentDprop || ''}
                        disabled={!edit}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const matched = DIAM_VENT.find((d) => d.pulg === val);
                          let nom = matched ? matched.nom : '';
                          if (val > 0 && ventRamalDiamPulg > 0 && val < ventRamalDiamPulg) {
                            avisarDiametroInvalido(
                              `El diámetro de la ventilación no puede ser inferior al del ramal de ventilación (${ventRamalDiamPulg}")`,
                            );
                            nom = '';
                          }
                          if (!nom && val > 0) return;
                          if (ventBajKey) {
                            // Item 1: cambiar el "D vent propuesto" debe actualizar
                            // TODOS los bajantes de ventilación conectados al mismo
                            // bajante sanitario (no solo uno).
                            for (const vk of ventBajKeys.length ? ventBajKeys : [ventBajKey]) {
                              writeBajantePropToDrawing(vk, 'vent', 'dNominal', nom, plans);
                              // #6: immediate local state for real-time chequeo
                              updTramoSan(vk, 'bajDprop', nom ? val : 0);
                            }
                            // Bidireccional: TODO ramal de ventilación conectado a los
                            // brevs (ini/fin/code) adopta el mismo diámetro — sin depender
                            // de ventRamalKey (los extremos del ramal apuntan al brev).
                            // Ramales vent conectados a los brevs → UN batch write
                            // (antes: writeDiametroToDrawing por ramal = N parses + N RPCs).
                            const ventRamalKeys: string[] = [];
                            for (const vk of ventBajKeys.length ? ventBajKeys : [ventBajKey]) {
                              const vp = vk.split('-');
                              const vId = vp[0];
                              const vPlan = vp.slice(1).join('-');
                              const vdoc = storageByPlan[vPlan];
                              if (!vdoc) continue;
                              const vBaj = (vdoc.bajantes || []).find((x) => x.id === vId);
                              for (const vr of vdoc.ramales || []) {
                                if (vr.net !== 'vent' && vr._net !== 'vent') continue;
                                if (
                                  vr.ini !== vId &&
                                  vr.fin !== vId &&
                                  vr.ini !== vBaj?.code &&
                                  vr.fin !== vBaj?.code
                                )
                                  continue;
                                ventRamalKeys.push(`${String(vr.id)}-${vPlan}`);
                              }
                            }
                            writeDiametroToDrawingBatch(ventRamalKeys, 'vent', nom, plans);
                          } else if (t.ventRamalKey) {
                            const res = writeDiametroToDrawing(t.ventRamalKey, 'vent', nom, plans);
                            if (!res.ok && res.reason === 'accessory-larger') {
                              if (
                                avisarDiametroInvalido(
                                  `El diámetro del ramal no puede ser menor al del accesorio conectado en el extremo ${res.accessoryEnd} (${res.accessoryDiam}). Reduce el diámetro del accesorio o selecciona un ramal mayor.`,
                                )
                              )
                                return;
                            }
                          }
                          writeBajantePropToDrawing(
                            tKey,
                            t._net || t.net || 'san',
                            'ventDprop',
                            nom ? val : 0,
                            plans,
                          );
                          // #6: immediate local state for vent chequeo
                          updTramoSan(tKey, 'ventDprop', nom ? val : 0);
                        }}
                        style={{
                          fontSize: 9.5,
                          padding: '2px 4px',
                          background: 'var(--bg2)',
                          border:
                            DventPropPulg < DventCalcPulg || ventDiamWarn
                              ? '1px solid var(--err)'
                              : '1px solid var(--line)',
                          color:
                            DventPropPulg < DventCalcPulg || ventDiamWarn
                              ? 'var(--err)'
                              : 'var(--txt)',
                          fontWeight:
                            DventPropPulg < DventCalcPulg || ventDiamWarn ? 'bold' : 'normal',
                          borderRadius: 2,
                          width: '100%',
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">—</option>
                        {DIAM_VENT.map((d) => (
                          <option key={d.pulg} value={d.pulg}>
                            {d.nom}
                          </option>
                        ))}
                      </select>
                      {ventDiamWarn && (
                        <div
                          style={{
                            fontSize: 9.5,
                            color: 'var(--err)',
                            marginTop: 2,
                            lineHeight: 1.2,
                          }}
                        >
                          Debe ser mayor o igual al &oslash; del ramal de vent. ({ventRamalDiamPulg}
                          &quot;)
                        </div>
                      )}
                    </td>
                    <td
                      className="c"
                      style={{
                        padding: '1px 1px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        minWidth: 60,
                      }}
                    >
                      {renderStatus(res.chequeoVent)}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </section>
  );
});
export default BajantesTable;
