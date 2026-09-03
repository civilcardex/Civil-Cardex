import { useMemo } from 'react';
import type { Tramo } from '../../context/tramosReducer';
import { matHazenC } from '../../constants';
import { calcLeAcces } from '../../utils/accesoriosUtils';
import { isContador, isAC1, isAC2, isAf } from '../../utils/waterNetworkRows';

type DiamOpt = { pulg: number; nominal: string; label?: string; dInt: number };

// Física de un tramo de la acometida (red → contador → montante): velocidad, longitud total,
// pérdida por fricción y presión final. `diamTable` y `Qaco` llegan como parámetros para que
// la función sea pura y testeable.
/** Física de un tramo de la acometida (red→contador o contador→montante): velocidad, longitud
 *  total, pérdida por fricción y presión final. `diamTable` y `Qaco` llegan como parámetros
 *  para que la función sea pura y testeable. */
export function calcFila(
  nominal: string,
  h: number,
  v: number,
  le: number,
  pIn: number,
  cHW: number,
  diamTable: DiamOpt[],
  Qaco: number,
) {
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
}

// Resolución del tramo 1 (red→contador) y tramo 2 (contador→montante) dibujados, con fallback a
// los valores manuales del panel mientras no existan. Resuelve también el nombre y diámetro del
// montante priorizando el override manual de la tabla sobre lo dibujado.
/** Resuelve los tramos reales de la acometida dibujados (tramo 1 red→contador, tramo 2
 *  contador→montante) con fallback a los valores manuales del panel, y el nombre y diámetro
 *  del montante priorizando el override de la tabla sobre lo dibujado. */
export function useAcometidaParams({
  networkType,
  tramos,
  acoMonName,
  diamNomMap,
  diamTable,
  acoContMonDiam,
  acoL1,
  acoL2,
}: {
  networkType: 'af' | 'ac';
  tramos: Tramo[];
  acoMonName: string;
  diamNomMap: Record<string, string>;
  diamTable: DiamOpt[];
  acoContMonDiam: number;
  acoL1: { h: number; v: number; le: number };
  acoL2: { h: number; v: number; le: number };
}) {
  const tr1 = useMemo(
    () => (isAf(networkType) ? tramos.find((t) => isAC1(t)) : null),
    [tramos, networkType],
  );
  const tr2 = useMemo(
    () => (isAf(networkType) ? tramos.find((t) => isAC2(t)) : null),
    [tramos, networkType],
  );

  const resolvedMonName = useMemo(() => {
    if (tr2) {
      const iniStr = typeof tr2.ini === 'string' ? tr2.ini : '';
      const finStr = typeof tr2.fin === 'string' ? tr2.fin : '';
      if (isContador(iniStr)) return finStr || acoMonName;
      if (isContador(finStr)) return iniStr || acoMonName;
      return iniStr || finStr || acoMonName;
    }
    return acoMonName;
  }, [tr2, acoMonName]);
  const resolvedContMonDiam = useMemo(() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      if (diamNomMap[ownKey]) return diamNomMap[ownKey];
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
  }, [tr2, diamNomMap, acoContMonDiam, diamTable]);

  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = useMemo(() => {
    if (tr1) {
      const opt = resolvedRedContDiam
        ? diamTable.find((d) => d.nominal === resolvedRedContDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr1.diamDisPulg || 0;
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0.0, le };
    }
    return acoL1;
  }, [tr1, acoL1, resolvedRedContDiam, diamTable]);

  const resolvedL2 = useMemo(() => {
    if (tr2) {
      const opt = resolvedContMonDiam
        ? diamTable.find((d) => d.nominal === resolvedContMonDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr2.diamDisPulg || 0;
      const cHW = matHazenC(tr2.material || '') ?? 150;
      const le = calcLeAcces(tr2.accesorios ?? {}, realPulg, cHW);
      return { h: tr2.totalL || tr2.Lh || 0, v: 0.0, le };
    }
    return acoL2;
  }, [tr2, acoL2, resolvedContMonDiam, diamTable]);
  return {
    tr1: tr1 ?? null,
    tr2: tr2 ?? null,
    resolvedMonName,
    resolvedContMonDiam,
    resolvedRedContDiam,
    resolvedL1,
    resolvedL2,
  };
}
