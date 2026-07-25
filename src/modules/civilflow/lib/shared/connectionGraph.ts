/**
 * Sums each tramo's "partial" value across its connected component (via `adj`) and returns
 * a map from tramo key to that component-wide total. Used to show, per tramo, the accumulated
 * demand (UC/UD) of everything hydraulically connected to it.
 * @param tramos - Array of tramo objects.
 * @param getKey - Extracts a unique key string from a tramo.
 * @param adj - Undirected adjacency map (key → neighbor keys).
 * @param getPartial - Extracts the partial value from a tramo.
 * @returns Map of tramo key → component-wide total.
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
 * @param tramos - Array of tramo objects.
 * @param getKey - Extracts a unique key string from a tramo.
 * @param adj - Undirected adjacency map (key → neighbor keys).
 * @param getPartial - Extracts the partial value from a tramo.
 * @param rootKey - Key of the root node (contador/calentador); falls back to undirected totals if null/missing.
 * @returns Map of tramo key → directed accumulated total.
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

  // BFS that traverses through EVERY node (including bajante/junction nodes that have no
  // tramo entry). Those non-tramo junction points previously blocked the walk entirely
  // (the old guard `tramoById[nb]` filtered them out), so the BFS couldn't reach tramos
  // beyond a junction — the root ended up alone and totals contained only its own partial,
  // effectively the same stale value for every visible tramo.
  const parentOf: Record<string, string> = {};
  const order: string[] = [];
  const visited = new Set<string>([rootKey]);
  const queue = [rootKey];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const nb of adj[node] || []) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      parentOf[nb] = node;
      queue.push(nb);
    }
  }

  // Reverse BFS order — deepest first. Non-tramo junction nodes start at 0; their totals
  // are accumulated from their children and then propagated upward to their own parent.
  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i];
    if (totals[node] === undefined) totals[node] = 0;
    const parent = parentOf[node];
    if (parent !== undefined) {
      if (totals[parent] === undefined) totals[parent] = 0;
      totals[parent] += totals[node];
    }
  }

  // Return only tramo keys (exclude junction/non-tramo accumulator keys).
  const result: Record<string, number> = {};
  for (const key of Object.keys(totals)) {
    if (tramoById[key]) result[key] = totals[key];
  }
  return result;
}
