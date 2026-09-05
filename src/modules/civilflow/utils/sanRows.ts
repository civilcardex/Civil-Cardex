import type { Tramo } from '../context/tramosReducer';
import { calcUDparcial, compareTramosPisoDesc } from './componentHelpers';
import { diametroManning, caudalHunterLPS, factorSimultaneidad } from './calcSanitaryCore';
import { calcHydraulicCheck } from './hydraulicCheck';
import { DIAM_OPTIONS_SAN } from '../constants';
import { type MergedApBase } from './sanConnectivity';

/** Fila del chequeo de diseño sanitario: UD, caudales Hunter, diámetros, longitudes y resultado del chequeo hidráulico. */
export interface SanRow {
  tKey: string;
  id: string;
  piso: number;
  udPropias: number;
  udAcum: number;
  nSalidas: number;
  K: number | null;
  Q: number | null;
  n: number;
  sVal: number;
  DcalcPulg: number;
  DdisPulg: number;
  DintMm: number;
  Qo: number;
  Vo: number;
  qqo: number;
  Vreal: number;
  chequeoV: string;
  Yc: number;
  Yn: number;
  Froude: number;
  tipoFlujo: string;
  Ymax: number;
  chequeoYn: string;
  fuerzaTractiva: number;
  chequeoFT: string;
}

// Fila de diseño hidráulico por-tramo — mismas fórmulas que la tabla DisenosSanitarios
// (estimación de diámetro de Manning + calcHydraulicCheck para el checkpoint completo),
// compartida con la exportación de memorias.
/** Filas del chequeo hidráulico sanitario a partir del grafo de conectividad y los aparatos por tramo. */
export function computeSanRows(
  displayTramos: Tramo[],
  componentTotalMap: Record<string, number>,
  mergedBase: MergedApBase[],
  allTramos?: Tramo[],
  fullChildrenMap?: Record<string, string[]>,
): SanRow[] {
  // ponytail: lookup for tributary UD aggregation (support both _key and planId keys)
  const byKey = new Map<string, Tramo>();
  if (allTramos) {
    for (const tr of allTramos) {
      const k1 = tr._key || `${tr.id}-${tr.piso}`;
      byKey.set(k1, tr);
      if (tr.planId) byKey.set(`${tr.id}-${tr.planId}`, tr);
    }
  }
  // Hogar geométrico de cada hijo: un tributario con arista en el grafo descarga en ESE
  // segmento (aunque su `padre` declarado haya quedado aguas arriba tras un split). Solo los
  // huérfanos (sin arista a nada) usan el campo padre como respaldo.
  const graphedChildren = new Set<string>();
  if (allTramos && fullChildrenMap) {
    for (const kids of Object.values(fullChildrenMap)) for (const k of kids) graphedChildren.add(k);
  }
  return displayTramos.toSorted(compareTramosPisoDesc).map((t) => {
    const tKey = t._key || `${t.id}-${t.piso}`;
    const tPlanKey = t.planId ? `${t.id}-${t.planId}` : tKey;
    let udPropias = calcUDparcial(t, mergedBase);
    // Tributarios que descargan en este ramal (directos o en cadena anidada) cuentan como
    // propias: si solo llegan tributarios, propia == total (pedido usuario). Solo se atraviesan
    // nodos tributario — lo que llega vía otro ramal es "otros", no propia.
    if (allTramos) {
      const visited = new Set<string>([tKey, tPlanKey]);
      const isTrib = (tr: Tramo) => tr.tipo === 'tributario' && !tr.esBajante;
      const samePlan = (tr: Tramo) => !(tr.planId && t.planId && tr.planId !== t.planId);
      const hasGraphHome = (ct: Tramo) => {
        const ck = ct._key || `${ct.id}-${ct.piso}`;
        const ckAlt = ct.planId ? `${ct.id}-${ct.planId}` : ck;
        return graphedChildren.has(ck) || graphedChildren.has(ckAlt);
      };
      const tribKidsOf = (parentId: string, parentKeys: string[]): Tramo[] => {
        const out: Tramo[] = [];
        const seenKid = new Set<string>();
        const push = (ct: Tramo) => {
          const ck = ct._key || `${ct.id}-${ct.piso}`;
          const ckAlt = ct.planId ? `${ct.id}-${ct.planId}` : ck;
          if (seenKid.has(ck) || seenKid.has(ckAlt)) return;
          seenKid.add(ck);
          seenKid.add(ckAlt);
          out.push(ct);
        };
        // vía grafo (hijos inmediatos tributario)
        for (const pk of parentKeys) {
          for (const ck of fullChildrenMap?.[pk] || []) {
            const ct = byKey.get(ck);
            if (ct && isTrib(ct) && samePlan(ct)) push(ct);
          }
        }
        // vía campo padre (respaldo solo para huérfanos sin arista geométrica: con arista,
        // el tributario ya cuenta en la propia de SU segmento, no en la del padre declarado)
        for (const ct of allTramos) {
          if (!isTrib(ct) || ct.padre !== parentId || !samePlan(ct)) continue;
          if (hasGraphHome(ct)) continue;
          push(ct);
        }
        return out;
      };
      let tribUD = 0;
      const stack = tribKidsOf(t.id, [tKey, tPlanKey]);
      while (stack.length > 0) {
        const ct = stack.pop()!;
        const ck = ct._key || `${ct.id}-${ct.piso}`;
        const ckAlt = ct.planId ? `${ct.id}-${ct.planId}` : ck;
        if (visited.has(ck) || visited.has(ckAlt)) continue;
        visited.add(ck);
        visited.add(ckAlt);
        tribUD += calcUDparcial(ct, mergedBase);
        for (const gc of tribKidsOf(ct.id, [ck, ckAlt])) {
          const gk = gc._key || `${gc.id}-${gc.piso}`;
          const gkAlt = gc.planId ? `${gc.id}-${gc.planId}` : gk;
          if (!visited.has(gk) && !visited.has(gkAlt)) stack.push(gc);
        }
      }
      udPropias += tribUD;
    }
    const udAcum = componentTotalMap[tKey] ?? componentTotalMap[tPlanKey] ?? 0;

    const nSalidas = t.nSalidas ?? 0;
    const K =
      nSalidas != null && nSalidas > 0
        ? Math.round(factorSimultaneidad(nSalidas) * 100) / 100
        : null;
    const n = t.nmaning || 0.009;
    const sVal = t.sPercent ?? 0;
    const S = sVal != null && sVal > 0 ? sVal / 100 : null;
    const Q = udAcum > 0 && K != null ? Math.round(caudalHunterLPS(udAcum, K) * 1000) / 1000 : null;
    const dSel = DIAM_OPTIONS_SAN.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
    let DcalcPulg = 0;
    const DdisPulg = dSel ? dSel.pulg : 0;
    const DintMm = dSel ? dSel.mm : 0;
    let Qo = 0,
      Vo = 0,
      qqo = 0;
    let Vreal = 0,
      chequeoV = '—';
    let Yc = 0,
      Yn = 0,
      Froude = 0,
      tipoFlujo = '—',
      Ymax = 0,
      chequeoYn = '—';
    let fuerzaTractiva = 0,
      chequeoFT = '—';
    if (Q != null && Q > 0 && S != null && S > 0 && n != null && n > 0) {
      DcalcPulg = Math.round(((diametroManning(Q / 1000, n, S) * 1000) / 25.4) * 100) / 100;
    }
    if (Q != null && Q > 0 && S != null && S > 0 && n != null && n > 0 && DintMm > 0) {
      const hc = calcHydraulicCheck({ Q, S, n, DintMm });
      Qo = hc.Qo;
      Vo = hc.Vo;
      qqo = hc.qqo;
      Vreal = hc.Vreal;
      chequeoV = hc.chequeoV;
      Yc = hc.Yc;
      Yn = hc.Yn;
      Froude = hc.Froude;
      tipoFlujo = hc.tipoFlujo;
      Ymax = hc.Ymax;
      chequeoYn = hc.chequeoYn;
      fuerzaTractiva = hc.fuerzaTractiva;
      chequeoFT = hc.chequeoFT;
    }
    return {
      tKey,
      id: t.id,
      piso: t.piso,
      udPropias,
      udAcum,
      nSalidas,
      K,
      Q,
      n,
      sVal,
      DcalcPulg,
      DdisPulg,
      DintMm,
      Qo,
      Vo,
      qqo,
      Vreal,
      chequeoV,
      Yc,
      Yn,
      Froude,
      tipoFlujo,
      Ymax,
      chequeoYn,
      fuerzaTractiva,
      chequeoFT,
    };
  });
}

// Cálculo de unidades de descarga — mismo grafo de conectividad que computeSanRows, columnas
