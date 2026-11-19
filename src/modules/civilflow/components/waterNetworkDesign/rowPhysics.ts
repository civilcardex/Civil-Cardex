import type { Tramo } from '../../context/tramosReducer';
import { matHazenC } from '../../constants';
import { calcLeAcces } from '../../utils/fittingsUtils.ts';
// La ÚNICA copia de la curva vive en utils/hunterCurve.ts — aquí solo el re-export para los
// consumidores históricos del módulo de agua.
export { hunterQ } from '../../utils/hunterCurve.ts';

/** Entradas de computeDesignRow: caudal del tramo, opciones de diámetro y overrides manuales. */
export interface DesignRowCalcParams {
  qprob: number;
  diamOpts: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>;
  diamNomMap: Record<string, string>;
  diamIntMap: Record<string, number>;
  lookupFn: (pulg: number) => number;
}

/** Física de una fila de la tabla de diseño: diámetro efectivo (override manual → original dibujado → diseñado), velocidad, longitudes y pérdida por fricción Hazen-Williams.
 * Es la única copia del cálculo: la usan la tabla, la memoria y los checkpoints de velocidad. */
export function computeDesignRow(t: Tramo, p: DesignRowCalcParams) {
  const ownKey = t._key || t.id;
  const disPulg = t.diamDisPulg || 0;
  const getMatchedOption = () => {
    if (p.diamNomMap[ownKey]) return p.diamOpts.find((o) => o.nominal === p.diamNomMap[ownKey]);
    if (t.diametroOriginal) {
      const match = p.diamOpts.find((o) => t.diametroOriginal?.startsWith(o.nominal));
      if (match) return match;
    }
    return p.diamOpts.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
  };
  const matchedOpt = getMatchedOption();
  const internoMm =
    p.diamIntMap[ownKey] || (matchedOpt ? matchedOpt.dInt : p.lookupFn(disPulg) || 0);
  const Vmms =
    p.qprob > 0 && internoMm > 0
      ? Math.round(((1000000 * p.qprob) / ((Math.PI / 4) * internoMm * internoMm)) * 10) / 10
      : 0;
  const H = t.totalL || t.Lh || 0;
  const Vvert = t.Lv != null ? Number(t.Lv) : t.deltaZ != null ? Number(t.deltaZ) : 0;
  const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
  const cHW = matHazenC(t.material || '') ?? 150;
  const Le = calcLeAcces(t.accesorios ?? {}, realPulg, cHW);
  const Lt = H + Vvert + Le;
  const hfPct =
    Vmms > 0 && cHW > 0 && internoMm > 0
      ? Math.round(
          ((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(internoMm, 1.167))) *
            100,
        ) / 100
      : 0;
  const hfM = Lt > 0 && hfPct > 0 ? Math.round(((Lt * hfPct) / 1000) * 100) / 100 : 0;
  return { matchedOpt, internoMm, Vmms, H, Vvert, realPulg, cHW, Le, Lt, hfPct, hfM };
}
