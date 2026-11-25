import { useMemo } from 'react';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { APARATOS_DEF } from '../../constants';
import { calcUCparcial } from '../../utils/componentHelpers.tsx';
import { isAC2 } from '../../utils/waterNetworkRows.ts';
import { hunterQ } from './rowPhysics.ts';
import { indicePorId } from '../../utils/indices';
import { buildAdjacency } from '../../utils/waterRows/connectivity.ts';

/** Grafo de conectividad de la red (af (Agua Fria)/ac (Agua Caliente)) leído de todos los planos:
 *  enlaces ramal→bajante/ramal, puentes de montantes, poda de ciclos y empalmes. La construcción
 *  del grafo es la misma que usa el snapshot de memorias (waterRows/connectivity.ts) — aquí solo
 *  se derivan la raíz de presión, los padres y el caudal probable sobre esa adyacencia. */
export function useWaterNetworkGraph({
  plans,
  tramos,
  networkType,
  ucIds,
  ucField,
}: {
  plans: PlanItem[];
  tramos: Tramo[];
  networkType: 'af' | 'ac';
  ucIds: string[];
  ucField: 'uc_af' | 'uc_ac';
}) {
  const AP = useMemo(
    () =>
      ucIds
        .map((id) => {
          const a = APARATOS_DEF.find((x) => x.id === id);
          return a ? { id: a.id, uc: a[ucField] } : null;
        })
        .filter((x): x is { id: string; uc: number } => x !== null),
    [ucIds, ucField],
  );

  const tramoPorClave = useMemo(() => indicePorId(tramos, (t) => t._key || t.id || null), [tramos]);
  const [conexionesDisplay, componentTotalMap, tramoParentOf, rootKey, qpropMap] = useMemo(() => {
    const { adj, otrosDisplay } = buildAdjacency(networkType, tramos, plans);

    // "Otros ramales" = TODOS los participantes del empalme menos la propia fila
    // (anfitrión + entrantes + co-salidas; el fallback geométrico aporta las uniones sin split).
    const displayMap: Record<string, string[]> = {};
    for (const [k, list] of Object.entries(otrosDisplay)) {
      const visibles = list.filter((key) => {
        const tr = tramoPorClave.get(key);
        return tr && tr.tipo !== 'tributario' && !tr.esBajante;
      });
      if (visibles.length) displayMap[k] = visibles;
    }

    // Dirigir la adyacencia desde la fuente de presión de la red hacia afuera, para que el
    // Pinicial de cada tramo pueda encadenarse desde el Pfinal de su tramo aguas arriba real en
    // lugar de la presión plana de acometida. La fuente de AF es el tramo troncal (Contador→Mon,
    // isAC2); AC no tiene acometida propia — su fuente es el tramo que llega al calentador.
    const rootT =
      tramos.find(isAC2) ||
      tramos.find(
        (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
      );
    let rootKey = rootT ? rootT._key || rootT.id : null;
    // Sin heurística de raíz: aproximar el troncal con el tramo más conectado en vez de rendirse
    // con la suma no dirigida de todo el componente.
    if (!rootKey) {
      let bestKey: string | null = null,
        bestDeg = -1;
      for (const k of Object.keys(adj)) {
        if (!tramoPorClave.has(k)) continue;
        const deg = adj[k]?.size || 0;
        if (deg > bestDeg) {
          bestDeg = deg;
          bestKey = k;
        }
      }
      if (bestDeg > 0) rootKey = bestKey;
    }

    // CARGA PROPAGADA (orig. usuario): las claves ya traen la carga (propia + heredada); el total
    // del tramo es lectura directa, sin acumulación de subárbol ni overrides de merge.
    const componentTotalMap: Record<string, number> = {};
    for (const t of tramos) {
      componentTotalMap[t._key || t.id] = calcUCparcial(t, AP, 'uc');
    }
    const nodeParentOf: Record<string, string> = {};
    if (rootKey) {
      const visited = new Set<string>([rootKey]);
      const queue = [rootKey];
      while (queue.length > 0) {
        const node = queue.shift()!;
        for (const neighbor of adj[node] || new Set<string>()) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nodeParentOf[neighbor] = node;
            queue.push(neighbor);
          }
        }
      }
    }

    // El BFS también recorre nodos de unión (bajante/contador/montante) que no son Tramo:
    // colapsarlos al tramo real aguas arriba más cercano.
    const tramoKeySet = new Set(tramos.map((t) => t._key || t.id));
    const tramoParentOf: Record<string, string> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      let cur = nodeParentOf[key];
      while (cur && !tramoKeySet.has(cur)) cur = nodeParentOf[cur];
      if (cur) tramoParentOf[key] = cur;
    }

    // Flujo probable (curva de Hunter) sobre el total UC ya propagado de cada tramo.
    const qpropMap: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      qpropMap[key] = hunterQ(componentTotalMap[key] || 0);
    }

    return [displayMap, componentTotalMap, tramoParentOf, rootKey, qpropMap] as const;
  }, [plans, tramos, networkType, AP, tramoPorClave]);

  return {
    AP,
    conexionesDisplay,
    componentTotalMap,
    tramoParentOf,
    pressureRootKey: rootKey,
    qpropMap,
  };
}
