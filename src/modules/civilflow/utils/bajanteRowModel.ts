import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext.tsx';
import type { DrawingData, RawElement } from './drawingSync.ts';
import type { UDBase } from './componentHelpers.tsx';
import { calcUDparcial } from './componentHelpers.tsx';
import { fmtPiso, pisoCorto } from '../constants';
import { planIdDeKey, sectorDe } from './formatUtils.ts';
import { parseDescargaEnId } from './parseDescargaEnId.ts';
import { maxSanRamalDiamPulg } from './bajanteVentRows.ts';
import { ventBajPulg, calculateVentStack } from './ventStackCalc.ts';

/**
 * Modelo de fila de la tabla de bajantes (aguas negras y ventilación).
 *
 * Antes de la des-monolitización cada fila se calculaba dentro del JSX del componente, con
 * búsquedas lineales (`tramosSan.find`) por cada bajante y cada ramal: O(n²) en el render.
 * Aquí la cuenta vive en una función pura que recibe índices ya construidos y devuelve los
 * valores de la fila; el componente solo los pinta.
 */

interface RamalWithDiam extends RawElement {
  diamPulg?: number;
}

/** Índices y datos que la cuenta necesita (se construyen una vez por render). */
export interface ContextoBajanteRow {
  tramosSan: Tramo[];
  plans: PlanItem[];
  pisos: { n: number }[];
  /** Tramos de la red sanitaria por clave "id-planId". */
  tramoPorClave: Map<string, Tramo>;
  /** Tramos de la red sanitaria por su _key exacto (busqueda literal del original). */
  tramoPorClaveExacta: Map<string, Tramo>;
  /** Documento de cada plano (trazos y bajantes persistidos). */
  storageByPlan: Record<string, DrawingData>;
  /** Componentes (grupos de bajantes conectados) por clave. */
  components: string[][];
  /** Clave de bajante de ventilación → claves de bajantes sanitarios que ventila. */
  ventToSanMap: Map<string, Set<string>>;
  /** Diámetro (pulg) del ramal de ventilación por clave de bajante. */
  ventRamalDiamMap: Record<string, number>;
  /** Ramalesassociate por respaldo geométrico, por clave "id-planId" del bajante. */
  geoAsocByBaj: Record<string, string[]>;
  /** Unidades de descarga (UD) de cada bajante, acumuladas por conectividad. */
  udPorBajante: Map<string, number>;
  /** Base de UD (aparatos) para el cálculo de UD propias. */
  udBase: UDBase[];
}

/** Todos los valores que la fila de un bajante muestra. */
export interface FilaBajante {
  tramo: Tramo;
  /** Clave del tramo ("id-planId"). */
  clave: string;
  isVent: boolean;
  /** Relleno del tubo: '7/24' | '1/4' | null (sin valor). */
  rStr: string | null;
  /** Piso de origen, ya formateado ("P1"). */
  origenVal: string;
  /** Piso de destino (donde descarga), ya formateado. */
  destinoVal: string;
  /** Etiquetas de los ramales asociados al bajante. */
  ramalesAsoc: string[];
  propiasUD: number;
  totalUD: number;
  ramalesUD: number;
  /** Coeficiente de rugosidad de Manning. */
  n: number;
  /** Coeficiente de fricción de Darcy del bajante. */
  fDarcy: number;
  /** Diámetro interior calculado del bajante (pulg). */
  DcalcPulg: number;
  /** Diámetro propuesto del bajante sanitario (pulg). */
  resolvedSanDprop: number;
  /** Clave del bajante sanitario al que se escribe el diámetro. */
  sanBajKey: string;
  /** Mayor diámetro de los ramales sanitarios conectados (pulg). */
  maxSanConectDiam: number;
  /** El diámetro propuesto es menor que el de sus ramales → aviso. */
  sanDiamWarn: boolean;
  /** Diámetro propuesto de la tubería de ventilación (pulg). */
  resolvedVentDprop: number;
  /** Clave del bajante de ventilación al que se escribe el diámetro. */
  ventBajKey: string;
  /** Claves de los bajantes de ventilación conectados (se escriben juntos). */
  ventBajKeys: string[];
  /** Diámetro del ramal de ventilación conectado (pulg). */
  ventRamalDiamPulg: number;
  /** El diámetro de ventilación propuesto es menor que el de su ramal → aviso. */
  ventDiamWarn: boolean;
  /** Caudal de diseño (L/s). */
  Q: number;
  /** Caudal máximo del bajante (L/s). */
  QmaxB: number;
  /** Velocidad terminal (m/s). */
  Vt: number;
  /** Longitud terminal calculada (m). */
  Ltcalc: number;
  /** Longitud terminal mínima (m). */
  Ltmin: number;
  /** Velocidad del aire (m/s). */
  Vair: number;
  /** Caudal de aire (L/s). */
  Qair: number;
  /** Diámetro de ventilación calculado (pulg). */
  DventCalcPulg: number;
  /** Diámetro de ventilación propuesto (pulg). */
  DventPropPulg: number;
  /** Chequeo de diámetro del bajante: 'O.K.' | 'NO' | '—'. */
  chequeo: string;
  /** Chequeo de la tubería de ventilación. */
  chequeoVent: string;
  /** Rango de pisos del tramo, para el cálculo de la ventilación ("1-2"). */
  pisosRange: string;
}

/**
 * Calcula la fila de un bajante: lo que se muestra y lo que se puede editar.
 * @param t - el tramo (bajante) del dibujo.
 * @param ctx - índices y datos de la red sanitaria.
 */
export function calculaFilaBajante(t: Tramo, ctx: ContextoBajanteRow): FilaBajante {
  const planIdStr = t.planId || planIdDeKey(t._key);
  const tKey = t._key || `${t.id}-${planIdStr}`;
  const isVent = t.net === 'vent' || t._net === 'vent';

  // --- Relleno y origen/destino -------------------------------------------------
  const rVal = t.bajR;
  const rStr = rVal != null ? (Math.abs(rVal - 7 / 24) < 0.001 ? '7/24' : '1/4') : null;
  const propiasUD = calcUDparcial(t, ctx.udBase);
  let targetPiso = '';
  let destinoVal = '—';
  if (t.descargaEnId) {
    const parts = parseDescargaEnId(t.descargaEnId, '');
    const dPlanId = parts[0];
    const targetRamal = parts[1] || '';
    const targetPlan = ctx.plans?.find((p) => String(p.id) === String(dPlanId));
    if (targetPlan && targetPlan.nivel != null) {
      targetPiso = targetPlan.nivel.toString();
      const targetPisoVal = fmtPiso(targetPiso, ctx.pisos);
      // Etiqueta corta ramal-piso (ej. BAN1-P1), mismo estilo que los ramales recibidos
      // (ped. usuario: sin prefijo 'Bajante: '/'Ramal: ').
      destinoVal = targetRamal ? `${targetRamal}-${targetPisoVal}` : targetPisoVal;
    } else {
      destinoVal = targetRamal || '—';
    }
  }
  const origenVal = fmtPiso(t.piso?.toString() || '', ctx.pisos);
  const pisosRange = targetPiso ? `${t.piso}-${targetPiso}` : `${t.piso}-${t.piso}`;

  // --- Ramales asociados --------------------------------------------------------
  // Solo ramales del MISMO piso del bajante (orig. usuario): el id debe existir entre
  // los tramos san de ese piso.
  const idsDelPiso = new Set(
    ctx.tramosSan.filter((x) => String(x.planId ?? '') === String(t.planId ?? '')).map((x) => x.id),
  );
  const ramalesIds = (t.recibeDeIds || []).filter((rid) => idsDelPiso.has(rid));
  // Respaldo geométrico (ver geoAsocByBaj): ramales san del mismo plano cuyo extremo
  // toca el bajante, aunque recibeDeIds no los registre.
  const geoIds: string[] = ctx.geoAsocByBaj[`${t.id}-${String(t.planId ?? '')}`] || [];
  const todosIds = [...ramalesIds, ...geoIds.filter((id) => !ramalesIds.includes(id))];
  const ramalesAsoc = todosIds.map((rid) => `${rid}-${pisoCorto(t.piso)}`);

  // --- Unidades de descarga -----------------------------------------------------
  let totalUD = ctx.udPorBajante.get(tKey) ?? 0;
  let ramalesUD = totalUD - propiasUD;
  if (isVent) {
    const sanKeys = [...(ctx.ventToSanMap.get(tKey) ?? [])];
    totalUD = 0;
    for (const sk of sanKeys) totalUD += ctx.udPorBajante.get(sk) ?? 0;
    ramalesUD = totalUD;
  }

  // --- Componentes y bajantes conectados ----------------------------------------
  const tComp = ctx.components.find((c) => c.includes(tKey)) || [tKey];
  const ventBajKeys: string[] = [];
  for (const [vKey, sanKeys] of ctx.ventToSanMap) {
    if ([...sanKeys].some((sk) => tComp.includes(sk))) {
      if (!ventBajKeys.includes(vKey)) ventBajKeys.push(vKey);
    }
  }
  const sanBajKeys: string[] = [];
  if (isVent) {
    const sanKeys = [...(ctx.ventToSanMap.get(tKey) ?? [])];
    for (const sk of sanKeys) {
      const comp = ctx.components.find((c) => c.includes(sk)) || [sk];
      for (const k of comp) {
        const x = ctx.tramoPorClave.get(k);
        if (x && x.esBajante && x.net !== 'vent' && x._net !== 'vent') {
          if (!sanBajKeys.includes(k)) sanBajKeys.push(k);
        }
      }
    }
  } else {
    for (const k of tComp) {
      const x = ctx.tramoPorClave.get(k);
      if (x && x.esBajante && x.net !== 'vent' && x._net !== 'vent') {
        if (!sanBajKeys.includes(k)) sanBajKeys.push(k);
      }
    }
  }

  // --- Diámetro propuesto sanitario ---------------------------------------------
  let resolvedSanDprop = 0;
  let sanBajKey = '';
  if (!isVent) {
    resolvedSanDprop = t.bajDprop || 0;
    sanBajKey = tKey;
  } else {
    for (const sk of sanBajKeys) {
      const st = ctx.tramoPorClaveExacta.get(sk);
      if (st) {
        resolvedSanDprop = st.bajDprop || 0;
        sanBajKey = sk;
        break;
      }
    }
  }

  // --- Diámetro del ramal de ventilación ----------------------------------------
  const ventRamalDiamPulg = (() => {
    let vKey = t.ventRamalKey;
    if (!vKey) {
      for (const vk of ventBajKeys) {
        const vt = ctx.tramoPorClaveExacta.get(vk);
        if (vt && vt.ventRamalKey) {
          vKey = vt.ventRamalKey;
          break;
        }
      }
    }
    if (!vKey) return 0;
    const fromMap = ctx.ventRamalDiamMap[vKey];
    if (fromMap && fromMap > 0) return fromMap;
    const vrId = sectorDe(vKey);
    const vPlanId = planIdDeKey(vKey);
    const raw = ctx.storageByPlan[vPlanId];
    if (!raw) return 0;
    for (const vr of (raw.ramales || []) as RamalWithDiam[]) {
      if (vr.id === vrId && (vr._net === 'vent' || vr.net === 'vent')) {
        return (
          vr.diamPulg || (vr.diametro ? parseFloat(String(vr.diametro).replace(/[^0-9.]/g, '')) : 0)
        );
      }
    }
    return 0;
  })();

  // --- Diámetro propuesto de ventilación ----------------------------------------
  // El MAYOR del D vent propuesto de los bajantes de ventilación conectados (Item 2:
  // mismo diámetro para todos); si no hay, el del propio BAN (ventDprop) y como última
  // opción el del ramal de ventilación conectado (BREV).
  let resolvedVentDprop = 0;
  let ventBajKey = '';
  if (isVent) {
    resolvedVentDprop = t.bajDprop || 0;
    ventBajKey = tKey;
  } else {
    // Los tramos vent NO existen en tramosSan (buildTramos los salta) — leer el BREV
    // directamente del storage: diamPulg (sincronizado por el autosave) o parse del dNominal.
    let maxVPulg = 0;
    for (const vk of ventBajKeys) {
      if (!ventBajKey) ventBajKey = vk;
      const vId = sectorDe(vk);
      const vPlan = planIdDeKey(vk);
      const doc = ctx.storageByPlan[vPlan];
      const vb = (doc?.bajantes || []).find(
        (x) => x.id === vId && (x.net === 'vent' || x._net === 'vent'),
      );
      if (!vb) continue;
      const vPulg = ventBajPulg(vb);
      if (vPulg > maxVPulg) maxVPulg = vPulg;
    }
    resolvedVentDprop = maxVPulg > 0 ? maxVPulg : t.ventDprop || 0 || ventRamalDiamPulg || 0;
  }
  const ventDiamWarn =
    ventRamalDiamPulg > 0 && resolvedVentDprop > 0 && resolvedVentDprop < ventRamalDiamPulg;

  // --- Diámetro de los ramales conectados ---------------------------------------
  // Mayor diámetro san de los ramales conectados — helper compartido con la memoria
  // de bajantes (bajanteVentRows).
  const maxSanConectDiam = maxSanRamalDiamPulg(t.recibeDeIds, planIdStr, ctx.storageByPlan);
  const sanDiamWarn =
    maxSanConectDiam > 0 && resolvedSanDprop > 0 && resolvedSanDprop < maxSanConectDiam;
  // Por defecto el bajante toma el mayor diámetro de sus ramales conectados.
  const effSanDprop = resolvedSanDprop > 0 ? resolvedSanDprop : maxSanConectDiam;

  // --- Cálculo de la pila de ventilación ----------------------------------------
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

  return {
    tramo: t,
    clave: tKey,
    isVent,
    rStr,
    origenVal,
    destinoVal,
    ramalesAsoc,
    propiasUD,
    totalUD,
    ramalesUD,
    n: t.nmaning || 0.009,
    fDarcy: t.bajFDarcy ?? 0,
    DcalcPulg: res.Dcalc_pulg,
    resolvedSanDprop,
    sanBajKey,
    maxSanConectDiam,
    sanDiamWarn,
    resolvedVentDprop,
    ventBajKey,
    ventBajKeys,
    ventRamalDiamPulg,
    ventDiamWarn,
    Q: res.Q_Ls,
    QmaxB: res.QmaxBajante,
    Vt: res.Vt,
    Ltcalc: res.Lt_calc,
    Ltmin: res.Lt_min,
    Vair: res.V_aire,
    Qair: res.Q_aire_Ls,
    DventCalcPulg: res.D_vent_calc_pulg,
    DventPropPulg: res.D_vent_prop_pulg,
    chequeo: res.chequeoDiam,
    chequeoVent: res.chequeoVent,
    pisosRange,
  };
}
