/**
 * Presiones por tramo: recorre el árbol de padres desde la raíz (Pfin de la acometida en af (Agua
 * Fria) o pFin (presion final) del calentador × HEATER_LOSS_FACTOR en ac (Agua Caliente)) y aplica
 * la pérdida de cada tubería (velocidad vertical + Hazen-Williams) para obtener Pfin. Memoizado,
 * con guard anti-ciclo: un tramo visitado dos veces cae a la presión de red.
 * Ej: Pin(RS1) = Pfin(M1) − Lv − hfM.
 */
import { matHazenC } from '../../constants';
import { calcLeAcces } from '../fittingsUtils.ts';
import { APARATO_PMAX_BY_CODE, HEATER_LOSS_FACTOR, isAf } from '../waterRowsShared.ts';
import { tramoKeyOf } from '../keys.ts';
import type { Tramo } from '../../context/tramosReducer';
import type { DiamOpt } from './types.ts';
import type { AcometidaFila } from './acometida.ts';

/** Todo lo que la resolución de presiones lee del resto del cálculo (evita 11 parámetros sueltos). */
export interface PresionCtx {
  rootKey: string | null;
  networkType: 'af' | 'ac';
  pRed: number;
  tramoParentOf: Record<string, string>;
  qpropMap: Record<string, number>;
  Qaco: number;
  tr2: Tramo | null | undefined;
  f1: AcometidaFila;
  afHeaterPfin: number | null;
  DIAM_OPTS: DiamOpt[];
  lookupFn: (pulg: number) => number;
}

/** Resuelve { Pin, Pfin } por clave de tramo (en orden de tramosOrden). */
export function resolvePressures(
  tramosOrden: Tramo[],
  ctx: PresionCtx,
): Record<string, { Pin: number; Pfin: number }> {
  const {
    rootKey,
    networkType,
    pRed,
    tramoParentOf,
    qpropMap,
    Qaco,
    tr2,
    f1,
    afHeaterPfin,
    DIAM_OPTS,
    lookupFn,
  } = ctx;
  const byKey = new Map(tramosOrden.map((t) => [tramoKeyOf(t), t]));

  const pipeLoss = (t: Tramo) => {
    const ownKey = tramoKeyOf(t);
    const isTr2Row = t === tr2;
    const Qprob = isTr2Row ? Qaco : qpropMap[ownKey] || 0;
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
    return { Vvert, hfM };
  };

  const result: Record<string, { Pin: number; Pfin: number }> = {};
  const resolving = new Set<string>();
  const resolve = (key: string): { Pin: number; Pfin: number } => {
    if (result[key]) return result[key];
    if (resolving.has(key)) return { Pin: pRed, Pfin: pRed };
    resolving.add(key);
    const t = byKey.get(key);
    if (!t) {
      resolving.delete(key);
      return { Pin: pRed, Pfin: pRed };
    }

    let PinCalc: number;
    if (key === rootKey) {
      PinCalc = isAf(networkType)
        ? f1.Pfin
        : afHeaterPfin != null
          ? afHeaterPfin * HEATER_LOSS_FACTOR
          : pRed;
    } else {
      const fixturePmax = APARATO_PMAX_BY_CODE[String(t.ini || '').toUpperCase()];
      if (fixturePmax !== undefined) {
        PinCalc = fixturePmax;
      } else {
        const parentKey = tramoParentOf[key];
        PinCalc = parentKey ? resolve(parentKey).Pfin : pRed;
      }
    }

    const Pin = PinCalc;
    const { Vvert, hfM } = pipeLoss(t);
    const Pfin = Pin - Vvert - hfM;
    resolving.delete(key);
    result[key] = { Pin, Pfin };
    return result[key];
  };
  for (const t of tramosOrden) resolve(tramoKeyOf(t));

  return result;
}
