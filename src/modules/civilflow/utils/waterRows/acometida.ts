/**
 * Bloque acometida de la red: fila Red Pública→Contador→Montante con los defaults de la pantalla
 * (L1 10 m + 0.47 m de Le, presión inicial 20 m.c.a.), el Q (Caudal) de la acometida (Qaco: curva
 * Hunter (metodo de probabilidad de uso simultaneo) del montante AC-02 o fórmula con el UC total)
 * y la presión con que entra la red ac (Agua Caliente) desde el pFin (presion final) del calentador de la red af (Agua Fria).
 * Ej: sin tramos AC dibujados, la fila 1 arranca en 20 y — sin caudal — termina en 20.
 */
import { matHazenC } from '../../constants';
import { calcLeAcces } from '../fittingsUtils.ts';
import { hunterQ } from '../../components/waterNetworkDesign/rowPhysics.ts';
import { tramoKeyOf } from '../keys.ts';
import { isAf, isAC1, isAC2 } from '../waterRowsShared.ts';
import type { Tramo } from '../../context/tramosReducer';
import type { LoadsResult } from './loads.ts';

/** Fila 1 de la acometida resuelta: su Pfin (presión de salida) es el Pin de la raíz de la red af. */
export interface AcometidaFila {
  dInt: number;
  V: number;
  Lt: number;
  hfPct: number;
  hfM: number;
  Pfin: number;
}

/** Resultado del bloque acometida: el montante (AC-02), el Qaco, la fila 1 y la presión del calentador. */
export interface AcometidaResult {
  tr2: Tramo | null | undefined;
  Qaco: number;
  f1: AcometidaFila;
  afHeaterPfin: number | null;
}

/** Cargas que la acometida lee: UC propia (para el ucTotal) y UC total por clave (para el Qaco del montante). */
export type CargasAcometida = Pick<LoadsResult, 'propiaMap' | 'componentTotalMap'>;

/** Resuelve la acometida de la red (solo af tiene fila propia; ac entra por el calentador). */
export function resolveAcometida(
  networkType: 'af' | 'ac',
  tramos: Tramo[],
  tramosAf: Tramo[],
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>,
  loads: CargasAcometida,
): AcometidaResult {
  const { propiaMap, componentTotalMap } = loads;
  // ── Acometida (solo AF) — mismos defaults con los que arranca el useState propio de WaterNetworkDesign.tsx ──
  const tr1 = isAf(networkType) ? tramos.find(isAC1) : null;
  const tr2 = isAf(networkType) ? tramos.find(isAC2) : null;
  const acoContMonDiam = 1.25;
  const acoL1Default = { h: 10.0, v: 0.0, le: 0.47 };
  const acoPini = 20.0;
  const acoLeMed = 0;

  const resolvedContMonDiam = (() => {
    if (tr2) {
      if (tr2.diametroOriginal) {
        const match = diamTable.find((o) => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find((o) => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const fallbackPulg = acoContMonDiam || 0.75;
    const match = diamTable.find((o) => Math.abs(o.pulg - fallbackPulg) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  })();
  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = (() => {
    if (tr1) {
      const opt = resolvedRedContDiam
        ? diamTable.find((d) => d.nominal === resolvedRedContDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr1.diamDisPulg || 0;
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0.0, le };
    }
    return acoL1Default;
  })();

  // Solo filas no-tributarias: el tributario no tiene fila y su carga ya vive plegada
  // en la propia del padre (sumarlo duplicaría).
  let ucTotal = 0;
  for (const t of tramos) {
    if (t.tipo === 'tributario') continue;
    ucTotal += propiaMap[tramoKeyOf(t)] || 0;
  }

  const Qaco = (() => {
    if (tr2) {
      const ownKey = tramoKeyOf(tr2);
      const qTr2 = hunterQ(componentTotalMap[ownKey] || 0, tr2.nSalidas || 0);
      if (qTr2 > 0) {
        return qTr2;
      }
    }
    return ucTotal > 0 ? Math.round(0.1163 * Math.pow(ucTotal, 0.6875) * 1000) / 1000 : 0;
  })();

  const calcFila = (
    nominal: string,
    h: number,
    v: number,
    le: number,
    pIn: number,
    cHW: number,
  ) => {
    const opt = nominal ? diamTable.find((d) => d.nominal === nominal) : null;
    const dInt = opt ? opt.dInt : 0;
    const V =
      Qaco > 0 && dInt > 0
        ? Math.round(((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt)) * 10) / 10
        : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct =
      Math.round(
        ((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100,
      ) / 100;
    const hfM = Math.round((hfPct / 100) * Lt * 100) / 100;
    const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(
    resolvedRedContDiam || '',
    resolvedL1.h,
    resolvedL1.v,
    acoL1LeTotal,
    acoPini,
    cHW1,
  );

  // AC no tiene acometida propia — se alimenta del calentador de agua, que a su vez se alimenta
  // de la presión resuelta propia de AF en el nodo calentador compartido (persistida en el Tramo
  // de AF como `pFin`).
  const afHeaterPfin = isAf(networkType)
    ? null
    : (tramosAf.find(
        (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
      )?.pFin ?? null);

  return { tr2, Qaco, f1, afHeaterPfin };
}
