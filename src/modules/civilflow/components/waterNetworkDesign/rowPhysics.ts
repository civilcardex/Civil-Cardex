import type { Tramo } from '../../context/tramosReducer';
import { matHazenC } from '../../constants';
import { calcLeAcces } from '../../utils/fittingsUtils.ts';

// Fórmula de Hunter simplificado (decisión producto 2026-11-16): el caudal probable depende
// SOLO de las UC totales del tramo — curva pura con quiebre en 240 UC. Sin factor K de
// simultaneidad ni número de descargas (esa columna salió de la tabla y de la memoria).
/** Caudal probable de Hunter simplificado (L/s aprox.): curva pura f(UC (Unidades de Consumo) totales), con cambio de fórmula a partir de 240 UC. Ej: 60 UC → 0.1163·60^0.6875 ≈ 1.95 L/s; 300 UC → 0.074·300^0.7504 ≈ 51.5 L/s. */
export function hunterQ(total: number): number {
  return total > 0
    ? Math.round(
        (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) * 1000,
      ) / 1000
    : 0;
}

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
