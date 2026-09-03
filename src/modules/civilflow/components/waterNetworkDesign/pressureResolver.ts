import type { Tramo } from '../../context/tramosReducer';
import { APARATO_PMAX_BY_CODE, HEATER_LOSS_FACTOR, isAf } from '../../utils/waterNetworkRows';
import { hunterQ, computeDesignRow } from './rowPhysics';

interface ResolvePressuresInputs {
  tramosOrden: Tramo[];
  tr2: Tramo | null;
  componentTotalMap: Record<string, number>;
  Qaco: number;
  diamNomMap: Record<string, string>;
  diamIntMap: Record<string, number>;
  diamOpts: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>;
  lookupFn: (pulg: number) => number;
  tramoParentOf: Record<string, string>;
  pressureRootKey: string | null;
  networkType: 'af' | 'ac';
  f1Pfin: number;
  afHeaterPfin: number | null;
  pRed: number;
  presIniEdit: Map<string, number>;
  presFinEdit: Map<string, number>;
}

// Propagación de presión por el árbol de la red, resuelta recursivamente con guarda de ciclo:
//   1. La raíz (tr2 en AF, tramo del calentador en AC) arranca de su fuente real.
//   2. Un tramo que comienza en un aparato arranca del Pmax de ese aparato.
//   3. Los demás heredan el Pfinal de su tramo aguas arriba (tramoParentOf).
//   4. Los overrides manuales de Pin/Pfin ganan sobre lo calculado; los huérfanos caen a pRed.
/** Propagación de presión por el árbol de la red: la raíz arranca de su fuente real, un tramo
 *  que nace en un aparato arranca del Pmax de ese aparato, los demás heredan el Pfinal del
 *  padre, y los overrides manuales ganan sobre lo calculado. Resuelto de forma recursiva con
 *  guarda de ciclos. */
export function resolvePressures(inputs: ResolvePressuresInputs) {
  const keyOf = (t: Tramo) => t._key || t.id;
  const byKey = new Map(inputs.tramosOrden.map((t) => [keyOf(t), t]));

  // Pérdida por fricción / desnivel de un tramo — mismas fórmulas que las columnas de la tabla,
  // necesarias antes del ciclo de filas porque el Pinicial del hijo depende del Pfinal del padre.
  const pipeLoss = (t: Tramo) => {
    const ownKey = keyOf(t);
    const total = inputs.componentTotalMap[ownKey] || 0;
    const Qprob = t === inputs.tr2 ? inputs.Qaco : hunterQ(total, t.nSalidas || 0);
    const c = computeDesignRow(t, {
      qprob: Qprob,
      diamOpts: inputs.diamOpts,
      diamNomMap: inputs.diamNomMap,
      diamIntMap: inputs.diamIntMap,
      lookupFn: inputs.lookupFn,
    });
    return { Vvert: c.Vvert, hfM: c.hfM };
  };

  const result: Record<string, { Pin: number; Pfin: number }> = {};
  const resolving = new Set<string>();

  const resolve = (key: string): { Pin: number; Pfin: number } => {
    if (result[key]) return result[key];
    if (resolving.has(key)) return { Pin: inputs.pRed, Pfin: inputs.pRed }; // guarda de ciclo
    resolving.add(key);

    const t = byKey.get(key);
    if (!t) {
      resolving.delete(key);
      return { Pin: inputs.pRed, Pfin: inputs.pRed };
    }

    let PinCalc: number;
    if (key === inputs.pressureRootKey) {
      PinCalc = isAf(inputs.networkType)
        ? inputs.f1Pfin
        : inputs.afHeaterPfin != null
          ? inputs.afHeaterPfin * HEATER_LOSS_FACTOR
          : inputs.pRed;
    } else {
      const fixturePmax = APARATO_PMAX_BY_CODE[String(t.ini || '').toUpperCase()];
      if (fixturePmax !== undefined) {
        PinCalc = fixturePmax;
      } else {
        const parentKey = inputs.tramoParentOf[key];
        PinCalc = parentKey ? resolve(parentKey).Pfin : inputs.pRed;
      }
    }

    const Pin = inputs.presIniEdit.has(key) ? inputs.presIniEdit.get(key)! : PinCalc;
    const { Vvert, hfM } = pipeLoss(t);
    const PfinCalc = Pin - Vvert - hfM;
    const Pfin = inputs.presFinEdit.has(key) ? inputs.presFinEdit.get(key)! : PfinCalc;

    resolving.delete(key);
    result[key] = { Pin, Pfin };
    return result[key];
  };

  for (const t of inputs.tramosOrden) resolve(keyOf(t));
  return result;
}
