import { memo, useMemo, useCallback, useState } from 'react';
import EditButton from './shared/EditButton';
import { useTramos } from '../context/TramosContext';
import type { Tramo } from '../context/tramosReducer';
import { usePisos } from '../context/PisosContext';
import { usePlans } from '../context/PlansContext';
import { useApparatus } from '../context/ApparatusContext';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import { renderStatus, calcUDparcial } from '../utils/componentHelpers';
import { fmtPiso, DIAM_BAN, DIAM_VENT } from '../constants';
import { diamPulgFromLabel } from '../utils/diamPulgFromLabel';
import { manning_SAN, caudalHunterLPS } from '../utils/calcSanitaryCore';
import { parseDescargaEnId } from '../utils/parseDescargaEnId';
import { buildBajanteGraph } from '../utils/buildBajanteGraph';
import type { DrawingData, RawElement } from '../utils/drawingSync';

interface RamalWithDiam extends RawElement {
  diamPulg?: number;
}

interface BajanteVentilacionParams {
  bajante?: string;
  pisos?: string;
  UD_propias?: number;
  UD_otros?: number;
  UD_acum?: number;
  r?: number;
  n?: number;
  bajDprop?: number;
  bajLong?: number;
  bajFDarcy?: number;
  ventDprop?: number;
}

interface BajanteVentilacionResult {
  bajante: string;
  pisos: string;
  UD_propias: number;
  UD_otros: number;
  UD_acum: number;
  r: number;
  Q_Ls: number;
  n: number;
  Dcalc_pulg: number;
  Dprop_pulg: number;
  Dprop_nominal: string;
  Dprop_mm: number;
  chequeoDiam: string;
  QmaxBajante: number;
  Vt: number;
  Lt_calc: number;
  Lt_min: number;
  V_aire: number;
  Q_aire_Ls: number;
  fDarcy: number;
  longBajante_m: number;
  D_vent_calc_pulg: number;
  D_vent_prop_pulg: number;
  D_vent_nominal: string;
  cumple: boolean;
}

function calculateVentStack(params: BajanteVentilacionParams): BajanteVentilacionResult {
  const {
    bajante = '',
    pisos = '2-1',
    UD_propias = 0,
    UD_otros = 0,
    UD_acum = 0,
    r = 7 / 24,
    n = manning_SAN,
    bajDprop = 0,
    bajLong = 3,
    bajFDarcy = 0.025,
    ventDprop = 0,
  } = params;

  const Q = caudalHunterLPS(UD_acum, 1);

  const DcalcPulg = Q > 0 ? Math.pow(Q / (1.754 * Math.pow(r, 5 / 3)), 3 / 8) : 0;
  const DcalcMm = DcalcPulg * 25.4;

  const Dprop =
    bajDprop > 0
      ? DIAM_BAN.find((d) => Number(d.pulg) === Number(bajDprop))
      : DcalcMm > 0
        ? DIAM_BAN.find((d) => d.mm > DcalcMm) || DIAM_BAN[DIAM_BAN.length - 1]
        : null;
  const DpropPulg = Dprop ? Dprop.pulg : 0;
  const DpropMm = Dprop ? Dprop.mm : 0;

  const chequeoDiam =
    DcalcPulg > 0 && DpropPulg > 0 ? (DcalcPulg <= DpropPulg ? 'Ok' : 'No cumple') : '—';

  const QmaxBajante = DpropPulg > 0 ? 1.754 * Math.pow(r, 5 / 3) * Math.pow(DpropPulg, 8 / 3) : 0;
  const Vt =
    DpropPulg > 0 && Q > 0 ? Math.round(2.76 * Math.pow(Q / DpropPulg, 0.4) * 100) / 100 : 0;
  const Lt_calc = Vt > 0 ? 0.17 * Vt * Vt : 0;
  const Lt_min = DpropPulg > 0 ? Math.max(Lt_calc, (10 * DpropPulg * 2.54) / 100) : 0;

  const V_aire = Vt;
  const Q_aire =
    DpropPulg > 0
      ? 1000 * V_aire * (1 - r) * (Math.PI / 4) * Math.pow((DpropPulg * 2.54) / 100, 2)
      : 0;
  const fDarcy = bajFDarcy;
  const Lbajante = bajLong;

  const D_vent_calc_pulg =
    Lbajante > 0 && Q_aire > 0 ? Math.pow((Lbajante * fDarcy * Q_aire * Q_aire) / 3.25, 1 / 5) : 0;
  const D_vent_calc_mm = D_vent_calc_pulg * 25.4;

  const DventProp =
    ventDprop > 0
      ? DIAM_VENT.find((d) => Number(d.pulg) === Number(ventDprop))
      : D_vent_calc_mm > 0
        ? DIAM_VENT.find((d) => d.mm > D_vent_calc_mm) || DIAM_VENT[DIAM_VENT.length - 1]
        : null;
  const DventPropPulg = DventProp ? DventProp.pulg : 0;

  return {
    bajante,
    pisos,
    UD_propias,
    UD_otros,
    UD_acum,
    r: parseFloat(r.toFixed(4)),
    Q_Ls: parseFloat(Q.toFixed(4)),
    n,
    Dcalc_pulg: parseFloat(DcalcPulg.toFixed(2)),
    Dprop_pulg: DpropPulg,
    Dprop_nominal: Dprop ? DpropPulg + '"' : '—',
    Dprop_mm: DpropMm,
    chequeoDiam,
    QmaxBajante: parseFloat(QmaxBajante.toFixed(2)),
    Vt: parseFloat(Vt.toFixed(2)),
    Lt_calc: parseFloat(Lt_calc.toFixed(2)),
    Lt_min: parseFloat(Lt_min.toFixed(2)),
    V_aire: parseFloat(V_aire.toFixed(2)),
    Q_aire_Ls: parseFloat(Q_aire.toFixed(2)),
    fDarcy: fDarcy,
    longBajante_m: parseFloat(Lbajante.toFixed(1)),
    D_vent_calc_pulg: parseFloat(D_vent_calc_pulg.toFixed(2)),
    D_vent_prop_pulg: DventPropPulg,
    D_vent_nominal: DventProp ? DventPropPulg + '"' : '—',
    cumple: chequeoDiam === 'Ok',
  };
}

import { writeBajantePropToDrawing, writeDiametroToDrawing } from '../utils/writeDiameterToDrawing';
const DownpipesTable_S1: React.CSSProperties = {
  width: 40,
  padding: 2,
  textAlign: 'center',
  fontFamily: 'var(--mono)',
  fontSize: 9,
  background: 'var(--bg2)',
  border: '1px solid var(--line)',
  color: 'var(--txt)',
};

const BajantesTable = memo(function BajantesTable_() {
  const [edit, setEdit] = useState(false);
  const { tramosSan } = useTramos();
  const { udBase } = useApparatus();
  const { pisos } = usePisos();
  const { plans } = usePlans();

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
  }, [plans]);

  const [conexiones, ventToSanMap, ventRamalDiamMap, components] = useMemo(
    () => buildBajanteGraph(plans, tramosSan, udBase),
    [plans, tramosSan, udBase],
  );

  const getDescendantsUD = useCallback(
    (tKey: string, visited = new Set<string>()): number => {
      if (visited.has(tKey)) return 0;
      visited.add(tKey);
      const children = conexiones[tKey] || [];
      let sum = 0;
      for (const childKey of children) {
        const childTramo = tramosSan.find((x) => x._key === childKey);
        if (childTramo) {
          sum += calcUDparcial(childTramo, udBase) + getDescendantsUD(childKey, visited);
        }
      }
      return sum;
    },
    [conexiones, tramosSan, udBase],
  );

  const getBajanteTotalUD = useCallback(
    (bKey: string, visited = new Set<string>()): number => {
      if (visited.has(bKey)) return 0;
      visited.add(bKey);

      const parts = bKey.split('-');
      const bId = parts[0];
      const planId = parts[1];

      const planData = storageByPlan[planId];
      const bObj = planData?.bajantes?.find((b) => b.id === bId);

      const tr = tramosSan.find((x) => x._key === bKey);
      const propiasUD = tr ? calcUDparcial(tr, udBase) : 0;

      let sum = propiasUD + getDescendantsUD(bKey);

      // Buscar otras bajantes que descargan en esta bajante
      for (const otherB of tramosSan) {
        if (!otherB.esBajante || otherB._key === bKey) continue;

        if (otherB.descargaEnId) {
          const oParts = otherB.descargaEnId.split('|');
          const oPlanId = oParts[0];
          const oTgtId = oParts[1];

          // Coincidir ya sea por ID exacto o por código/etiqueta personalizado
          const matches =
            String(oPlanId) === String(planId) &&
            (oTgtId === bId || (bObj && bObj.code && oTgtId === bObj.code));
          if (matches) {
            sum += getBajanteTotalUD(otherB._key || `${otherB.id}-${otherB.planId}`, visited);
          }
        }
      }

      return sum;
    },
    [storageByPlan, tramosSan, udBase, getDescendantsUD],
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
        <EditButton edit={edit} setEdit={setEdit} />
      </div>
      <div className="scroll-top" style={{ padding: '16px' }}>
        <div className="scroll-inner" style={{ minWidth: 'max-content' }}>
          <table className="tbl" style={{ fontSize: 9 }}>
            <caption className="visually-hidden">Bajantes de aguas negras y ventilación</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="col-h san"
                  colSpan={8}
                  style={{ textAlign: 'center', padding: '1px 2px', fontSize: 9 }}
                >
                  INFORMACIÓN COMÚN
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '1px 2px', fontSize: 9 }}
                >
                  BAJANTES AGUAS NEGRAS
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  colSpan={6}
                  style={{ textAlign: 'center', padding: '1px 2px', fontSize: 9 }}
                >
                  TUBERÍA DE VENTILACIÓN
                </th>
              </tr>
              <tr>
                <th
                  scope="col"
                  className="col-h san"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  No.
                </th>
                <th
                  scope="col"
                  className="col-h san"
                  colSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Nivel
                </th>
                <th
                  scope="col"
                  className="col-h san"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Ramales
                  <br />
                  Asociados
                </th>
                <th
                  scope="col"
                  className="col-h san"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Unidades
                  <br />
                  Descarga
                </th>
                <th
                  scope="col"
                  className="col-h san"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Llenado
                  <br />
                </th>
                <th
                  scope="col"
                  className="col-h san"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Caudal
                  <br />
                  <small>(LPS)</small>
                </th>
                <th
                  scope="col"
                  className="col-h san"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Manning
                  <br />
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  colSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Diámetro
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Chequeo
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Caudal máximo
                  <br />
                  <small>(LPS)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Velocidad terminal
                  <br />
                  <small>(m/s)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  colSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Longitud terminal
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Vel. Aire
                  <br />
                  <small>(m/s)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Fricción
                  <br />
                  (ƒ)
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Caudal Aire
                  <br />
                  <small>(LPS)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  rowSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Longitud Bajante
                  <br />
                  <small>(m)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  colSpan={2}
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Diámetro Ventilación
                </th>
              </tr>
              <tr>
                <th
                  scope="col"
                  className="col-h san"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Origen
                </th>
                <th
                  scope="col"
                  className="col-h san"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Destino
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Calculado
                  <br />
                  <small>(″)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Propuesto
                  <br />
                  <small>(″)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Calculada
                  <br />
                  <small>(m)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ok"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Mínima
                  <br />
                  <small>(m)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Calculado
                  <br />
                  <small>(″)</small>
                </th>
                <th
                  scope="col"
                  className="col-h ven"
                  style={{ textAlign: 'center', padding: '1px 1px', fontSize: 9 }}
                >
                  Propuesto
                  <br />
                  <small>(″)</small>
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
                        colSpan={21}
                        style={{
                          textAlign: 'center',
                          color: 'var(--txt3)',
                          padding: '24px 0',
                          fontSize: 9,
                        }}
                      >
                        No hay bajantes definidos. Marque un tramo como bajante en la tabla de
                        Cálculo de unidades de descarga.
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

                  const propiasUD = calcUDparcial(t, udBase);
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
                      const isTgtBajante =
                        targetRamal.startsWith('B') || targetRamal.startsWith('M');
                      const prefix = isTgtBajante ? 'Bajante: ' : 'Ramal: ';
                      destinoVal = targetRamal
                        ? `${prefix}${targetPisoVal}-${targetRamal}`
                        : targetPisoVal;
                    } else {
                      destinoVal = targetRamal || '—';
                    }
                  }

                  const ramalesIds = t.recibeDeIds || [];
                  const ramalesAsocVal = ramalesIds.length > 0 ? ramalesIds.join(', ') : '—';

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

                  // 2. Resolver el diámetro propuesto de ventilación
                  let resolvedVentDprop = 0;
                  let ventBajKey = '';
                  if (isVent) {
                    resolvedVentDprop = t.bajDprop || 0;
                    ventBajKey = tKey;
                  } else {
                    let foundVentVt = null;
                    for (const vk of ventBajKeys) {
                      const vt = tramosSan.find((x) => x._key === vk);
                      if (vt) {
                        foundVentVt = vt;
                        ventBajKey = vk;
                        break;
                      }
                    }
                    if (foundVentVt) {
                      resolvedVentDprop = foundVentVt.bajDprop || 0;
                    } else {
                      resolvedVentDprop = t.ventDprop || 0;
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
                          (vr.diametro
                            ? parseFloat(String(vr.diametro).replace(/[^0-9.]/g, ''))
                            : 0)
                        );
                      }
                    }
                    return 0;
                  })();

                  const ventDiamWarn =
                    ventRamalDiamPulg > 0 &&
                    resolvedVentDprop > 0 &&
                    resolvedVentDprop < ventRamalDiamPulg;

                  const maxSanRamalDiamPulg = (() => {
                    let maxD = 0;
                    const planIdStr = t.planId || (t._key ? t._key.split('-')[1] : '');
                    const rIds = t.recibeDeIds || [];
                    if (rIds.length === 0) return 0;

                    const raw = storageByPlan[planIdStr];
                    if (!raw) return 0;

                    const planRamales = (raw.ramales || []) as RamalWithDiam[];
                    for (const rId of rIds) {
                      const ram = planRamales.find(
                        (r) => r.id === rId && (r.net === 'san' || r._net === 'san'),
                      );
                      if (ram) {
                        const dVal = ram.diamPulg || diamPulgFromLabel(ram.diametro);
                        if (dVal > maxD) {
                          maxD = dVal;
                        }
                      }
                    }
                    return maxD;
                  })();

                  const sanDiamWarn =
                    maxSanRamalDiamPulg > 0 &&
                    resolvedSanDprop > 0 &&
                    resolvedSanDprop < maxSanRamalDiamPulg;

                  const res = calculateVentStack({
                    bajante: t.id,
                    pisos: pisosRange,
                    UD_propias: propiasUD,
                    UD_otros: ramalesUD,
                    UD_acum: totalUD,
                    r: t.bajR,
                    n: t.nmaning || 0.009,
                    bajDprop: resolvedSanDprop || 0,
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
                        <span className="sigla" style={{ fontSize: 9 }}>
                          {t.code || t.id}
                        </span>
                      </td>
                      <td
                        className="c"
                        style={{
                          padding: '1px 1px',
                          fontSize: 9,
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
                          fontSize: 9,
                          fontFamily: 'var(--mono)',
                          color: 'var(--txt)',
                        }}
                      >
                        {destinoVal}
                      </td>
                      <td
                        className="c"
                        style={{
                          fontSize: 9,
                          color: 'var(--txt2)',
                          fontFamily: 'var(--mono)',
                          padding: '1px 1px',
                        }}
                      >
                        {ramalesAsocVal}
                      </td>
                      <td
                        className="c"
                        style={{
                          fontFamily: 'var(--mono)',
                          fontWeight: 700,
                          fontSize: 9,
                          padding: '1px 1px',
                        }}
                      >
                        {totalUD > 0 ? totalUD : '—'}
                      </td>
                      <td className="c" style={{ padding: '1px 1px' }}>
                        <span
                          style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--txt2)' }}
                        >
                          {rStr || '—'}
                        </span>
                      </td>
                      <td
                        className="c"
                        style={{
                          fontFamily: 'var(--mono)',
                          fontWeight: 600,
                          fontSize: 9,
                          padding: '1px 1px',
                        }}
                      >
                        {Q > 0 ? Q.toFixed(2) : '—'}
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 1px' }}
                      >
                        {n > 0 ? n.toFixed(3) : '—'}
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 1px' }}
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
                            if (val > 0 && maxSanRamalDiamPulg > 0 && val < maxSanRamalDiamPulg) {
                              alert(
                                `El diámetro del bajante no puede ser inferior al del ramal sanitario (${maxSanRamalDiamPulg}")`,
                              );
                              nom = '';
                            }
                            const targetKey = sanBajKey || tKey;
                            writeBajantePropToDrawing(targetKey, 'san', 'dNominal', nom, plans);
                          }}
                          style={{
                            fontSize: 9,
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
                          {DIAM_BAN.map((d) => (
                            <option key={d.pulg} value={d.pulg}>
                              {d.nom}
                            </option>
                          ))}
                        </select>
                        {sanDiamWarn && (
                          <div
                            style={{
                              fontSize: 9,
                              color: 'var(--err)',
                              marginTop: 2,
                              lineHeight: 1.2,
                            }}
                          >
                            Debe ser mayor o igual al &oslash; del ramal san. ({maxSanRamalDiamPulg}
                            &quot;)
                          </div>
                        )}
                      </td>
                      <td className="c" style={{ fontSize: 9, padding: '1px 1px' }}>
                        {renderStatus(chequeo)}
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 1px' }}
                      >
                        {QmaxB > 0 ? QmaxB.toFixed(2) : '—'}
                      </td>
                      <td className="c" style={{ fontSize: 9, padding: '1px 1px' }}>
                        {Vt > 0 ? Vt.toFixed(2) : '—'}
                      </td>
                      <td className="c" style={{ fontSize: 9, padding: '1px 1px' }}>
                        {Ltcalc > 0 ? Ltcalc.toFixed(2) : '—'}
                      </td>
                      <td className="c" style={{ fontSize: 9, padding: '1px 1px' }}>
                        {Ltmin > 0 ? Ltmin.toFixed(2) : '—'}
                      </td>
                      <td className="c" style={{ fontSize: 9, padding: '1px 1px' }}>
                        {Vair > 0 ? Vair.toFixed(2) : '—'}
                      </td>
                      <td className="c" style={{ padding: '1px 1px' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>
                          {fDarcy > 0 ? fDarcy.toFixed(3) : '—'}
                        </span>
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 1px' }}
                      >
                        {Qair > 0 ? Qair.toFixed(2) : '—'}
                      </td>
                      <td className="c" style={{ padding: '1px 1px' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          aria-label="Longitud del bajante (m)"
                          style={DownpipesTable_S1}
                          disabled={!edit}
                          value={t.bajLong ?? 5}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 5;
                            const tKey = t._key || `${t.id}-${t.piso}`;
                            writeBajantePropToDrawing(
                              tKey,
                              t._net || t.net || 'san',
                              'bajLong',
                              val,
                              plans,
                            );
                          }}
                        />
                      </td>
                      <td
                        className="c"
                        style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '1px 1px' }}
                      >
                        {DventCalcPulg > 0 ? DventCalcPulg.toFixed(2) + '"' : '—'}
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
                              alert(
                                `El diámetro de la ventilación no puede ser inferior al del ramal de ventilación (${ventRamalDiamPulg}")`,
                              );
                              nom = '';
                            }
                            if (ventBajKey) {
                              writeBajantePropToDrawing(ventBajKey, 'vent', 'dNominal', nom, plans);
                            } else if (t.ventRamalKey) {
                              const res = writeDiametroToDrawing(
                                t.ventRamalKey,
                                'vent',
                                nom,
                                plans,
                              );
                              if (!res.ok && res.reason === 'accessory-larger') {
                                window.dispatchEvent(
                                  new CustomEvent('civilflow_diametro_validation', {
                                    detail: {
                                      title: 'Diámetro no permitido',
                                      message: `El diámetro del ramal no puede ser menor al del accesorio conectado (${res.accessoryDiam}).`,
                                    },
                                  }),
                                );
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
                          }}
                          style={{
                            fontSize: 9,
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
                              fontSize: 9,
                              color: 'var(--err)',
                              marginTop: 2,
                              lineHeight: 1.2,
                            }}
                          >
                            Debe ser mayor o igual al &oslash; del ramal de vent. (
                            {ventRamalDiamPulg}&quot;)
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
});
export default BajantesTable;
