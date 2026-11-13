/**
 * Orquestador del snapshot de filas de diseño de redes af (Agua Fria)/ac (Agua Caliente): arma la
 * base de aparatos (UC por red), construye el grafo, acumula cargas Hunter, resuelve acometida,
 * presiones y filas. Además, la demanda UC de la red ac tras el calentador (número que debe
 * coincidir con el total de la tabla en el nodo del calentador).
 * Ej: red af con RS1 (2 lavamanos) → una WnRow con udTotal 1 y Qprob 0.116 L/s.
 */
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { AF_UC_IDS, AC_UC_IDS, APARATOS_DEF } from '../../constants';
import { compareTramosPisoDesc } from '../componentHelpers.tsx';
import { isAf, isAC1, isAC2 } from '../waterRowsShared.ts';
import { buildAdjacency } from './connectivity.ts';
import { pickRootKey, computeLoads } from './loads.ts';
import { resolveAcometida } from './acometida.ts';
import { resolvePressures } from './pressures.ts';
import { buildWaterRows } from './rows.ts';
import type { WnRow, AparatoUc } from './types.ts';

// Versión snapshot del cálculo de filas propio de WaterNetworkDesign.tsx (grafo de conectividad,
// árbol de presiones dirigido, pérdidas Hazen-Williams) — usada por la tabla en pantalla vía
// estado vivo del componente (diámetros pendientes de guardar, ediciones manuales de presión) y,
// aquí, como función pura que usa solo lo ya persistido en los objetos Tramo, para que la
// exportación de memorias nunca dependa de que el usuario haya abierto esa pantalla primero.
/** Filas de diseño af (Agua Fria)/ac (Agua Caliente) (Hunter (metodo de probabilidad de uso simultaneo)/Hazen; snapshot para memorias). */
export function computeWaterNetworkRows(
  networkType: 'af' | 'ac',
  tramosOwn: Tramo[],
  tramosAf: Tramo[],
  plans: PlanItem[],
  pRedStr: string,
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>,
  lookupFn: (pulg: number) => number,
): WnRow[] {
  const tramos = tramosOwn;
  const DIAM_OPTS = diamTable.map((d) => ({
    pulg: d.pulg,
    nominal: d.nominal,
    label: d.nominal,
    dInt: d.dInt,
  }));
  const ucIds = isAf(networkType) ? AF_UC_IDS : AC_UC_IDS;
  const ucField = isAf(networkType) ? 'uc_af' : 'uc_ac';
  const AP: AparatoUc[] = ucIds
    .map((id) => {
      const a = APARATOS_DEF.find((x) => x.id === id);
      return a ? { id: a.id, uc: a[ucField as 'uc_af' | 'uc_ac'] } : null;
    })
    .filter((x): x is AparatoUc => x !== null);

  const adj = buildAdjacency(networkType, tramos, plans);
  const rootKey = pickRootKey(tramos, adj);
  const { componentTotalMap, qpropMap, tramoParentOf, propiaMap } = computeLoads(
    tramos,
    adj,
    rootKey,
    AP,
  );

  const pRed = parseFloat(pRedStr) || 20;
  const tramosOrden = tramos
    .filter((t) => t.tipo !== 'tributario' && !t.esBajante && !isAC1(t))
    .sort(compareTramosPisoDesc);

  const aco = resolveAcometida(networkType, tramos, tramosAf, diamTable, {
    propiaMap,
    componentTotalMap,
  });

  const result = resolvePressures(tramosOrden, {
    rootKey,
    networkType,
    pRed,
    tramoParentOf,
    qpropMap,
    Qaco: aco.Qaco,
    tr2: aco.tr2,
    f1: aco.f1,
    afHeaterPfin: aco.afHeaterPfin,
    DIAM_OPTS,
    lookupFn,
  });

  return buildWaterRows(tramosOrden, {
    propiaMap,
    componentTotalMap,
    qpropMap,
    Qaco: aco.Qaco,
    tr2: aco.tr2,
    DIAM_OPTS,
    lookupFn,
    result,
    pRed,
  });
}

// Demanda UC real de la red AC alimentada por un calentador, como la calcula la tabla de diseño —
// la pantalla de selección de calentador antes sumaba solo los fixtures del ramal stub sintético
// AC-01-{calId} (los aparatos asignados directo al calentador), lo que perdía todo fixture en los
// ramales AC reales aguas abajo. Reutiliza computeWaterNetworkRows con la misma heurística de raíz
// (isAC2 primero, luego cualquier tramo que toque un código CALENTn) para que el número coincida
// exactamente con el total de la tabla de diseño en el nodo del calentador. udTotal es 0 cuando
// aún no existe tramo de calentador.
/** Demanda UC (Unidades de Consumo) de la red ac (Agua Caliente) tras el calentador (igual que la tabla). */
export function computeHeaterNetworkTotal(
  tramosAc: Tramo[],
  plans: PlanItem[],
): { udTotal: number } {
  const rows = computeWaterNetworkRows('ac', tramosAc, [], plans, '20', [], () => 0);
  const root =
    tramosAc.find(isAC2) ||
    tramosAc.find(
      (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
    );
  const row = root
    ? rows.find(
        (r) =>
          r.id === root.id &&
          String(r.ini) === String(root.ini ?? '') &&
          String(r.fin) === String(root.fin ?? ''),
      )
    : null;
  return { udTotal: row?.udTotal ?? 0 };
}
