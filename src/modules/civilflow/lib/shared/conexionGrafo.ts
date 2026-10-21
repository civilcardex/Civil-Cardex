/** Suma el parcial de cada tramo sobre su componente conexa (UC (Unidades de Consumo)/UD (Unidades de Desague) acumulada por tramo).
 *  @param tramos - tramos a agrupar.
 *  @param getKey - clave única por tramo.
 *  @param adj - adyacencia no dirigida.
 *  @param getPartial - valor parcial por tramo.
 *  @returns mapa clave → total de su componente. */
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

/** Total dirigido desde la fuente (contador/calentador): cada nodo suma su parcial + lo que cuelga debajo.
 *  @param tramos - tramos a acumular.
 *  @param getKey - clave única por tramo.
 *  @param adj - adyacencia no dirigida.
 *  @param getPartial - valor parcial por tramo.
 *  @param rootKey - raíz (sin raíz válida cae al no dirigido).
 *  @returns mapa clave → total dirigido acumulado. */
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

  // BFS que atraviesa TODOS los nodos (incluidos los de bajante/uniones que no tienen entrada
  // de tramo). Esos puntos de unión sin tramo antes bloqueaban el recorrido entero (el antiguo
  // guard `tramoById[nb]` los filtraba), así que el BFS no alcanzaba los tramos más allá de una
  // unión — la raíz quedaba sola y los totales contenían solo su propio parcial, efectivamente
  // el mismo valor obsoleto para cada tramo visible.
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

  // Orden BFS inverso — primero los más profundos. Los nodos de unión sin tramo empiezan en 0;
  // sus totales se acumulan desde sus hijos y luego se propagan hacia arriba a su propio padre.
  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i];
    if (totals[node] === undefined) totals[node] = 0;
    const parent = parentOf[node];
    if (parent !== undefined) {
      if (totals[parent] === undefined) totals[parent] = 0;
      totals[parent] += totals[node];
    }
  }

  // Devuelve solo claves de tramo (excluye las claves acumuladoras de uniones/nodos sin tramo).
  const result: Record<string, number> = {};
  for (const key of Object.keys(totals)) {
    if (tramoById[key]) result[key] = totals[key];
  }
  return result;
}
