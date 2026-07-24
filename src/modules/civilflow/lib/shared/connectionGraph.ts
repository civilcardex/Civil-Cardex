/**
 * Sums each tramo's "partial" value across its connected component (via `adj`) and returns
 * a map from tramo key to that component-wide total. Used to show, per tramo, the accumulated
 * demand (UC/UD) of everything hydraulically connected to it.
 */
export function computeComponentTotals<T>(
  tramos: T[],
  getKey: (t: T) => string | undefined,
  adj: Record<string, string[]>,
  getPartial: (t: T) => number,
): Record<string, number> {
  const tramoById: Record<string, T> = {};
  for (const t of tramos) {
    const key = getKey(t);
    if (key) tramoById[key] = t;
  }

  const parcialMap: Record<string, number> = {};
  for (const t of tramos) {
    const key = getKey(t);
    if (key) parcialMap[key] = getPartial(t);
  }

  const componentTotalMap: Record<string, number> = {};
  const visited = new Set<string>();
  for (const t of tramos) {
    const startKey = getKey(t);
    if (!startKey || visited.has(startKey)) continue;

    const comp: string[] = [];
    const q = [startKey];
    visited.add(startKey);
    while (q.length > 0) {
      const cur = q.shift()!;
      comp.push(cur);
      for (const nb of adj[cur] || []) {
        if (!visited.has(nb) && tramoById[nb]) {
          visited.add(nb);
          q.push(nb);
        }
      }
    }
    const compTotal = comp.reduce((s, k) => s + (parcialMap[k] || 0), 0);
    for (const k of comp) componentTotalMap[k] = compTotal;
  }

  return componentTotalMap;
}

/**
 * Like computeComponentTotals, but DIRECTED: rooted at `rootKey` (the actual supply source —
 * contador/calentador), each node's total = its own partial + the total of everything BELOW it
 * in the tree (its children, i.e. further from the source). A node upstream of a junction only
 * ever contributes ITS OWN total up to whatever's above it — it never shows the combined total
 * itself; only the node the branches merge INTO does. computeComponentTotals instead summed the
 * whole undirected connected component and handed that SAME grand total to every member
 * regardless of position, which is wrong for anything but a single-node network: a small branch
 * feeding one fixture showed the entire building's demand, same as the main trunk near the source.
 * Falls back to computeComponentTotals when no root can be identified (network without a
 * detectable contador/calentador), so it still returns something sensible.
 */
export function computeDirectedTotals<T>(
  tramos: T[],
  getKey: (t: T) => string | undefined,
  adj: Record<string, string[]>,
  getPartial: (t: T) => number,
  rootKey: string | null,
): Record<string, number> {
  const tramoById: Record<string, T> = {};
  for (const t of tramos) {
    const key = getKey(t);
    if (key) tramoById[key] = t;
  }
  if (!rootKey || !tramoById[rootKey]) {
    return computeComponentTotals(tramos, getKey, adj, getPartial);
  }

  const totals: Record<string, number> = {};
  for (const t of tramos) {
    const key = getKey(t);
    if (key) totals[key] = getPartial(t);
  }

  const parentOf: Record<string, string> = {};
  const order: string[] = [rootKey];
  const visited = new Set<string>([rootKey]);
  const queue = [rootKey];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const nb of adj[node] || []) {
      if (!visited.has(nb) && tramoById[nb]) {
        visited.add(nb);
        parentOf[nb] = node;
        order.push(nb);
        queue.push(nb);
      }
    }
  }

  // Reverse BFS order = deepest (furthest from root) nodes first, so each node's accumulated
  // total is already complete by the time it gets folded into its own parent.
  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i];
    const parent = parentOf[node];
    if (parent !== undefined && totals[parent] !== undefined) {
      totals[parent] += totals[node];
    }
  }

  return totals;
}
