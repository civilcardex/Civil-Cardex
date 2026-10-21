import type { Tramo } from '../context/tramosReducer';
import { leerDocDePlan } from './readPlanDrawing.ts';
import type { PlanItem } from '../context/PlansContext.tsx';
import type { UDBase } from './componentHelpers.tsx';
import { calcUDparcial } from './componentHelpers.tsx';
import { buildBajanteGraph } from './buildBajanteGraph.ts';
import { diamPulgFromLabel } from './diamPulgFromLabel.ts';
import { manning_SAN } from './calcSanitaryCore.ts';
import { calculateVentStack } from './ventStackCalc.ts';
import { parseDescargaEnId } from './parseDischargeInId.ts';
import { splitPtr, splitTramo } from './keys.ts';
import type { DrawingData } from './drawingSync.ts';
import type { MemoriaTable, MemoriaHeaderGroup } from './exportMemoryFinal.ts';
import { fmtPiso } from '../constants';
import { planIdDeKey } from './formatUtils.ts';
/** Mayor diámetro san (Sanitaria) (pulg) entre ramales del recibeDeIds/alimentaIds (ramales que llegan/salen del bajante). */
export function maxSanRamalDiamPulg(
  recibeDeIds: string[] | undefined,
  planId: string | number | undefined,
  storageByPlan: Record<string, DrawingData>,
): number {
  let maxD = 0;
  const rIds = recibeDeIds || [];
  if (rIds.length === 0) return 0;
  const raw = planId !== undefined && planId !== '' ? storageByPlan[String(planId)] : undefined;
  if (!raw) return 0;
  // Vista suelta de los ramales persistidos: RawElement no declara diamPulg pero los datos
  // guardados por writeBajantePropToDrawing sí lo traen.
  const planRamales = (raw.ramales || []) as Array<{
    id: string;
    net?: string;
    _net?: string;
    diamPulg?: number;
    diametro?: string;
  }>;
  // Índice id→ramal san del plano: el .find por cada rId era O(n) por id buscado.
  const sanPorId = new Map<string, (typeof planRamales)[number]>();
  for (const r of planRamales) {
    if (r.net === 'san' || r._net === 'san') {
      if (!sanPorId.has(r.id)) sanPorId.set(r.id, r);
    }
  }
  for (const rId of rIds) {
    const ram = sanPorId.get(rId);
    if (!ram) continue;
    const dVal = ram.diamPulg || diamPulgFromLabel(ram.diametro || '');
    if (dVal > maxD) maxD = dVal;
  }
  return maxD;
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
      storageByPlan[String(p.id)] = d;
    }
  }
  const [conexiones, ventToSanMap, , components] = buildBajanteGraph(plans, tramosSan, udBase);
  const tramoById: Record<string, Tramo> = {};
  // Índice por _key: los .find repetidos (por children, por sanKeys) eran O(n) por consulta.
  const tramoPorClave = new Map<string, Tramo>();
  for (const tr of tramosSan) {
    const k = tr._key || `${tr.id}-${tr.planId}`;
    if (k) tramoById[k] = tr;
    if (tr._key) tramoPorClave.set(tr._key, tr);
  }
  const getDescendantsUD = (tKey: string, visited = new Set<string>()): number => {
    if (visited.has(tKey)) return 0;
    visited.add(tKey);
    const children = conexiones[tKey] || [];
    let sum = 0;
    for (const childKey of children) {
      const childTramo = tramoPorClave.get(childKey);
      if (childTramo)
        sum += calcUDparcial(childTramo, udBase) + getDescendantsUD(childKey, visited);
    }
    return sum;
  };
  const getBajanteTotalUD = (bKey: string, visited = new Set<string>()): number => {
    if (visited.has(bKey)) return 0;
    visited.add(bKey);
    const [bId, planId] = splitTramo(bKey);
    const planData = storageByPlan[planId];
    const bObj = planData?.bajantes?.find((b) => b.id === bId);
    const tr = tramoPorClave.get(bKey);
    const propiasUD = tr ? calcUDparcial(tr, udBase) : 0;
    let sum = propiasUD + getDescendantsUD(bKey);
    for (const otherB of tramosSan) {
      if (!otherB.esBajante || otherB._key === bKey) continue;
      if (otherB.descargaEnId) {
        const [oPlanId, oTgtId] = splitPtr(otherB.descargaEnId, '');
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
    const planIdStr = t.planId || planIdDeKey(t._key);
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
    const ramalesIds = (t.recibeDeIds || []).filter(
      // Solo ramales del MISMO piso del bajante: el id debe existir en el doc de ese piso.
      (rid) => !!storageByPlan[planIdStr]?.ramales?.some((r) => r.id === rid),
    );
    const ramalesAsocVal = ramalesIds.length > 0 ? ramalesIds.join(', ') : '—';
    let totalUD = getBajanteTotalUD(t._key || `${t.id}-${planIdStr}`);
    const isVentTramo = t._net === 'vent' || t.net === 'vent';
    if (isVentTramo) {
      const sanKeys = [...(ventToSanMap.get(t._key || `${t.id}-${planIdStr}`) ?? [])];
      totalUD = 0;
      for (const sk of sanKeys) totalUD += getBajanteTotalUD(sk);
    }
    const origenVal = fmtPiso(t.piso?.toString() || '', pisos);
    const tKey = t._key || `${t.id}-${planIdStr}`;
    const tComp = components.find((c) => c.includes(tKey)) || [tKey];
    const isVent = t.net === 'vent' || t._net === 'vent';
    const ventBajKeys: string[] = [];
    const ventBajKeysSet = new Set<string>();
    for (const [vKey, sanKeys] of ventToSanMap) {
      if ([...sanKeys].some((sk) => tComp.includes(sk))) {
        if (!ventBajKeysSet.has(vKey)) {
          ventBajKeysSet.add(vKey);
          ventBajKeys.push(vKey);
        }
      }
    }
    const sanBajKeys: string[] = [];
    const sanBajKeysSet = new Set<string>();
    if (isVent) {
      const sanKeys = [...(ventToSanMap.get(tKey) ?? [])];
      for (const sk of sanKeys) {
        const comp = components.find((c) => c.includes(sk)) || [sk];
        for (const k of comp) {
          const x = tramoById[k];
          if (x && x.esBajante && x.net !== 'vent' && x._net !== 'vent') {
            if (!sanBajKeysSet.has(k)) {
              sanBajKeysSet.add(k);
              sanBajKeys.push(k);
            }
          }
        }
      }
    } else {
      for (const k of tComp) {
        const x = tramoById[k];
        if (x && x.esBajante && x.net !== 'vent' && x._net !== 'vent') {
          if (!sanBajKeysSet.has(k)) {
            sanBajKeysSet.add(k);
            sanBajKeys.push(k);
          }
        }
      }
    }
    let resolvedSanDprop = 0;
    if (!isVent) {
      resolvedSanDprop = t.bajDprop || 0;
      // Por defecto el bajante toma el mayor diámetro de sus ramales conectados
      // (misma regla compartida que la tabla en pantalla).
      if (!resolvedSanDprop) {
        const planIdStr = t.planId || planIdDeKey(t._key);
        resolvedSanDprop = maxSanRamalDiamPulg(t.recibeDeIds, planIdStr, storageByPlan);
      }
    } else {
      for (const sk of sanBajKeys) {
        const st = tramoPorClave.get(sk);
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
      // Item 2: el diámetro propuesto de ventilación es el MAYOR de todos los
      // bajantes de ventilación conectados al mismo bajante sanitario (no el
      // primero). Si todos los vent bajantes conectados se sincronizan al mismo
      // diámetro (ver PlanoEngineSelection), esto recoge ese valor único.
      let maxVentPulg = 0;
      for (const vk of ventBajKeys) {
        const vt = tramoPorClave.get(vk);
        if (vt) {
          const vPulg = vt.bajDprop || 0;
          if (vPulg > maxVentPulg) maxVentPulg = vPulg;
        }
      }
      resolvedVentDprop = maxVentPulg > 0 ? maxVentPulg : t.ventDprop || 0;
    }
    const res = calculateVentStack({
      UD_acum: totalUD,
      // `??` NO captura el 0: un radio 0 explícito (o legacy) debe caer al valor por
      // defecto, no propagar Infinity al PDF.
      r: Number.isFinite(t.bajR) && (t.bajR as number) > 0 ? (t.bajR as number) : 7 / 24,
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
