import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import type { UDBase } from './componentHelpers';
import { calcUDparcial } from './componentHelpers';
import { buildBajanteGraph } from './buildBajanteGraph';
import { DIAM_BAN, DIAM_VENT } from '../constants';
import { manning_SAN, caudalHunterLPS } from './calcSanitaryCore';
import { parseDescargaEnId } from './parseDescargaEnId';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { DrawingData } from './drawingSync';
import type { MemoriaTable, MemoriaHeaderGroup } from './exportMemoriaFinal';
import { fmtPiso } from '../constants';

function calculateVentStack(params: {
  UD_acum: number;
  r: number;
  n: number;
  bajDprop: number;
  bajLong: number;
  bajFDarcy: number;
  ventDprop: number;
}) {
  const { UD_acum, r, bajDprop, bajLong, bajFDarcy, ventDprop } = params;
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

  const D_vent_calc_pulg =
    bajLong > 0 && Q_aire > 0 ? Math.pow((bajLong * fDarcy * Q_aire * Q_aire) / 3.25, 1 / 5) : 0;
  const D_vent_calc_mm = D_vent_calc_pulg * 25.4;

  const DventProp =
    ventDprop > 0
      ? DIAM_VENT.find((d) => Number(d.pulg) === Number(ventDprop))
      : D_vent_calc_mm > 0
        ? DIAM_VENT.find((d) => d.mm > D_vent_calc_mm) || DIAM_VENT[DIAM_VENT.length - 1]
        : null;
  const DventPropPulg = DventProp ? DventProp.pulg : 0;

  return {
    Q_Ls: parseFloat(Q.toFixed(4)),
    Dcalc_pulg: parseFloat(DcalcPulg.toFixed(2)),
    Dprop_pulg: DpropPulg,
    chequeoDiam,
    QmaxBajante: parseFloat(QmaxBajante.toFixed(2)),
    Vt: parseFloat(Vt.toFixed(2)),
    Lt_calc: parseFloat(Lt_calc.toFixed(2)),
    Lt_min: parseFloat(Lt_min.toFixed(2)),
    V_aire: parseFloat(V_aire.toFixed(2)),
    Q_aire_Ls: parseFloat(Q_aire.toFixed(2)),
    D_vent_calc_pulg: parseFloat(D_vent_calc_pulg.toFixed(2)),
    D_vent_prop_pulg: DventPropPulg,
  };
}

export function computeBajanteVentTable(
  tramosSan: Tramo[],
  plans: PlanItem[],
  udBase: UDBase[],
  pisos: { n: number }[],
): MemoriaTable | null {
  const banTramos = tramosSan.filter((t) => t.esBajante && t.net !== 'vent' && t._net !== 'vent');
  if (banTramos.length === 0) return null;

  const storageByPlan: Record<string, DrawingData> = {};
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
      storageByPlan[String(p.id)] = d;
    }
  }

  const [conexiones, ventToSanMap, , components] = buildBajanteGraph(plans, tramosSan, udBase);

  const tramoById: Record<string, Tramo> = {};
  for (const tr of tramosSan) {
    const k = tr._key || `${tr.id}-${tr.planId}`;
    if (k) tramoById[k] = tr;
  }

  const getDescendantsUD = (tKey: string, visited = new Set<string>()): number => {
    if (visited.has(tKey)) return 0;
    visited.add(tKey);
    const children = conexiones[tKey] || [];
    let sum = 0;
    for (const childKey of children) {
      const childTramo = tramosSan.find((x) => x._key === childKey);
      if (childTramo)
        sum += calcUDparcial(childTramo, udBase) + getDescendantsUD(childKey, visited);
    }
    return sum;
  };

  const getBajanteTotalUD = (bKey: string, visited = new Set<string>()): number => {
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
    for (const otherB of tramosSan) {
      if (!otherB.esBajante || otherB._key === bKey) continue;
      if (otherB.descargaEnId) {
        const oParts = otherB.descargaEnId.split('|');
        const oPlanId = oParts[0];
        const oTgtId = oParts[1];
        const matches =
          String(oPlanId) === String(planId) &&
          (oTgtId === bId || (bObj && bObj.code && oTgtId === bObj.code));
        if (matches)
          sum += getBajanteTotalUD(otherB._key || `${otherB.id}-${otherB.planId}`, visited);
      }
    }
    return sum;
  };

  const headers = [
    'No.',
    'Origen',
    'Destino',
    'Ramales asociados',
    'Unidades descarga',
    'Llenado',
    'Caudal (LPS)',
    'Manning',
    'D calculado (")',
    'D propuesto (")',
    'Chequeo',
    'Caudal máximo (LPS)',
    'Vel. terminal (m/s)',
    'L terminal calc (m)',
    'L terminal mín (m)',
    'Vel. aire (m/s)',
    'Fricción (f)',
    'Caudal aire (LPS)',
    'Longitud bajante (m)',
    'D vent calc (")',
    'D vent propuesto (")',
  ];
  const headerGroups: (string | MemoriaHeaderGroup)[] = [
    { label: 'Información común', span: 8 },
    { label: 'Bajantes aguas negras', span: 7 },
    { label: 'Tubería de ventilación', span: 6 },
  ];

  const rows = banTramos.map((t) => {
    const rVal = t.bajR;
    const rStr = rVal != null ? (Math.abs(rVal - 7 / 24) < 0.001 ? '7/24' : '1/4') : null;
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
        const isTgtBajante = targetRamal.startsWith('B') || targetRamal.startsWith('M');
        const prefix = isTgtBajante ? 'Bajante: ' : 'Ramal: ';
        destinoVal = targetRamal ? `${prefix}${targetPisoVal}-${targetRamal}` : targetPisoVal;
      } else {
        destinoVal = targetRamal || '—';
      }
    }

    const ramalesIds = t.recibeDeIds || [];
    const ramalesAsocVal = ramalesIds.length > 0 ? ramalesIds.join(', ') : '—';

    let totalUD = getBajanteTotalUD(t._key || `${t.id}-${planIdStr}`);

    const isVentTramo = t._net === 'vent' || t.net === 'vent';
    if (isVentTramo) {
      const sanKeys = ventToSanMap[t._key || `${t.id}-${planIdStr}`] || [];
      totalUD = 0;
      for (const sk of sanKeys) totalUD += getBajanteTotalUD(sk);
    }

    const origenVal = fmtPiso(t.piso?.toString() || '', pisos);
    const tKey = t._key || `${t.id}-${planIdStr}`;
    const tComp = components.find((c) => c.includes(tKey)) || [tKey];
    const isVent = t.net === 'vent' || t._net === 'vent';

    const ventBajKeys: string[] = [];
    for (const [vKey, sanKeys] of Object.entries(ventToSanMap || {})) {
      if (sanKeys.some((sk) => tComp.includes(sk))) {
        if (!ventBajKeys.includes(vKey)) ventBajKeys.push(vKey);
      }
    }

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

    let resolvedSanDprop = 0;
    if (!isVent) {
      resolvedSanDprop = t.bajDprop || 0;
    } else {
      for (const sk of sanBajKeys) {
        const st = tramosSan.find((x) => x._key === sk);
        if (st) {
          resolvedSanDprop = st.bajDprop || 0;
          break;
        }
      }
    }

    let resolvedVentDprop = 0;
    if (isVent) {
      resolvedVentDprop = t.bajDprop || 0;
    } else {
      let foundVentVt = null;
      for (const vk of ventBajKeys) {
        const vt = tramosSan.find((x) => x._key === vk);
        if (vt) {
          foundVentVt = vt;
          break;
        }
      }
      resolvedVentDprop = foundVentVt ? foundVentVt.bajDprop || 0 : t.ventDprop || 0;
    }

    const res = calculateVentStack({
      UD_acum: totalUD,
      r: t.bajR ?? 7 / 24,
      n: t.nmaning || manning_SAN,
      bajDprop: resolvedSanDprop || 0,
      bajLong: t.bajLong || 3,
      bajFDarcy: t.bajFDarcy || 0.025,
      ventDprop: resolvedVentDprop || 0,
    });

    const n = t.nmaning || manning_SAN;

    return [
      t.code || t.id,
      origenVal,
      destinoVal,
      ramalesAsocVal,
      totalUD > 0 ? totalUD : '—',
      rStr || '—',
      res.Q_Ls > 0 ? res.Q_Ls.toFixed(2) : '—',
      n > 0 ? n.toFixed(3) : '—',
      res.Dcalc_pulg > 0 ? res.Dcalc_pulg.toFixed(2) + '"' : '—',
      res.Dprop_pulg > 0 ? res.Dprop_pulg + '"' : '—',
      res.chequeoDiam,
      res.QmaxBajante > 0 ? res.QmaxBajante.toFixed(2) : '—',
      res.Vt > 0 ? res.Vt.toFixed(2) : '—',
      res.Lt_calc > 0 ? res.Lt_calc.toFixed(2) : '—',
      res.Lt_min > 0 ? res.Lt_min.toFixed(2) : '—',
      res.V_aire > 0 ? res.V_aire.toFixed(2) : '—',
      (t.bajFDarcy ?? 0) > 0 ? (t.bajFDarcy ?? 0).toFixed(3) : '—',
      res.Q_aire_Ls > 0 ? res.Q_aire_Ls.toFixed(2) : '—',
      t.bajLong ?? 3,
      res.D_vent_calc_pulg > 0 ? res.D_vent_calc_pulg.toFixed(2) + '"' : '—',
      res.D_vent_prop_pulg > 0 ? res.D_vent_prop_pulg + '"' : '—',
    ];
  });

  return { title: 'Bajantes de aguas negras y ventilación', headerGroups, headers, rows };
}
