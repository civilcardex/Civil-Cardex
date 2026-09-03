import type { Tramo } from '../context/tramosReducer';
import { calcUDparcial } from './componentHelpers';
import { diametroManning, caudalHunterLPS, factorSimultaneidad } from './calcSanitaryCore';
import { calcHydraulicCheck } from './hydraulicCheck';
import { DIAM_OPTIONS } from '../constants';
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
  return displayTramos
    .toSorted((a, b) => (a.piso || 0) - (b.piso || 0))
    .map((t) => {
      const tKey = t._key || `${t.id}-${t.piso}`;
      const tPlanKey = t.planId ? `${t.id}-${t.planId}` : tKey;
      let udPropias = calcUDparcial(t, mergedBase);
      // Tributaries that discharge into this ramal count as "propias" (issue #2)
      if (allTramos) {
        const seen = new Set<string>();
        let tribUD = 0;
        // via fullChildrenMap immediate children where child is tributario
        if (fullChildrenMap) {
          for (const parentKey of [tKey, tPlanKey]) {
            for (const ck of fullChildrenMap[parentKey] || []) {
              if (seen.has(ck)) continue;
              seen.add(ck);
              const ct = byKey.get(ck);
              if (ct && ct.tipo === 'tributario') {
                tribUD += calcUDparcial(ct, mergedBase);
              }
            }
          }
        }
        // via padre field (tributario.padre === parent id) — dedup
        for (const ct of allTramos) {
          if (ct.tipo !== 'tributario') continue;
          if (ct.padre !== t.id) continue;
          const ck = ct._key || `${ct.id}-${ct.piso}`;
          const ckAlt = ct.planId ? `${ct.id}-${ct.planId}` : ck;
          if (seen.has(ck) || seen.has(ckAlt)) continue;
          if (ct.planId && t.planId && ct.planId !== t.planId) continue;
          tribUD += calcUDparcial(ct, mergedBase);
          seen.add(ck);
          seen.add(ckAlt);
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
      const Q =
        udAcum > 0 && K != null ? Math.round(caudalHunterLPS(udAcum, K) * 1000) / 1000 : null;
      const dSel = DIAM_OPTIONS.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
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
