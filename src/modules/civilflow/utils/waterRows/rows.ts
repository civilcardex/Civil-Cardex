/**
 * Filas de diseño finales (WnRow) para la tabla y las memorias: mapea cada tramo no-tributario con
 * su UC (Unidades de Consumo) propia/total, Q (Caudal) Hunter (metodo de probabilidad de uso
 * simultaneo), diámetro estimado √Q, velocidad y pérdidas Hazen-Williams, y las presiones ya
 * resueltas. Ej: RS1 con 1 UC y Q 0.116 L/s → diamEst 0.34 y Vmms 334.9 en 3/4" (dInt 21 mm).
 */
import { matHazenC } from '../../constants';
import { calcLeAcces } from '../fittingsUtils.ts';
import { hunterK } from '../../components/waterNetworkDesign/rowPhysics.ts';
import { tramoKeyOf } from '../keys.ts';
import type { Tramo } from '../../context/tramosReducer';
import type { WnRow, DiamOpt } from './types.ts';

/** Todo lo que el mapeo final de filas lee del resto del cálculo (evita 9 parámetros sueltos). */
export interface RowsCtx {
  propiaMap: Record<string, number>;
  componentTotalMap: Record<string, number>;
  qpropMap: Record<string, number>;
  Qaco: number;
  tr2: Tramo | null | undefined;
  DIAM_OPTS: DiamOpt[];
  lookupFn: (pulg: number) => number;
  result: Record<string, { Pin: number; Pfin: number }>;
  pRed: number;
}

/** Construye las WnRow en el orden de tramosOrden (piso desc, luego etiqueta). */
export function buildWaterRows(tramosOrden: Tramo[], ctx: RowsCtx): WnRow[] {
  const { propiaMap, componentTotalMap, qpropMap, Qaco, tr2, DIAM_OPTS, lookupFn, result, pRed } =
    ctx;
  return tramosOrden.map((t) => {
    const ownKey = tramoKeyOf(t);
    const propia = propiaMap[ownKey] || 0;
    const total = componentTotalMap[ownKey] || 0;
    const isTr2Row = t === tr2;
    const nDesc = t.nSalidas || 0;
    const K = hunterK(nDesc);
    const Qprob = isTr2Row ? Qaco : qpropMap[ownKey] || 0;
    const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
    const disPulg = t.diamDisPulg || 0;
    const matchedOpt =
      (t.diametroOriginal
        ? DIAM_OPTS.find((o) => t.diametroOriginal?.startsWith(o.nominal))
        : undefined) || DIAM_OPTS.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
    const internoMm = matchedOpt ? matchedOpt.dInt : lookupFn(disPulg) || 0;
    const Vmms =
      Qprob > 0 && internoMm > 0
        ? Math.round(((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm)) * 10) / 10
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
    const { Pin, Pfin } = result[ownKey] ?? { Pin: pRed, Pfin: pRed };
    return {
      id: t.id,
      ini: typeof t.ini === 'string' ? t.ini : '—',
      fin: typeof t.fin === 'string' ? t.fin : '—',
      piso: t.piso,
      udPropia: propia,
      udTotal: total,
      nDesc,
      K,
      Qprob,
      diamEst: raizQ,
      diamDis: matchedOpt?.nominal || '—',
      dInt: internoMm,
      cHW,
      Vmms,
      Lh: H,
      Lv: Vvert,
      Le,
      Lt,
      hfPct,
      hfM,
      Pin,
      Pfin,
    };
  });
}
