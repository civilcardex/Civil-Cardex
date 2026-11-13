/**
 * Cargas de la red: elige la raíz del árbol de presiones (isAC2 → tramo que toca un CALENT →
 * tramo con más conexiones) y acumula por tramo la UC (Unidades de Consumo) total y su Q (Caudal)
 * Hunter (metodo de probabilidad de uso simultaneo), el árbol de padres (BFS) y la UD propia
 * (carga de la clave − la heredada del libro de presiones).
 * Ej: RS1 con 2 lavamanos (1 UC) → udPropia 1 y Qprob = K·f(1) = 0.116 L/s con 2 descargas.
 */
import { calcUCparcial } from '../componentHelpers.tsx';
import { hunterQ } from '../../components/waterNetworkDesign/rowPhysics.ts';
import { leerHeredadosPresion } from '../propagation';
import { tramoKeyOf } from '../keys.ts';
import { isAC2 } from '../waterRowsShared.ts';
import type { Tramo } from '../../context/tramosReducer';
import type { AparatoUc } from './types.ts';

/** Elige la clave del tramo raíz (fuente de suministro); null si la red no tiene conexiones. */
export function pickRootKey(tramos: Tramo[], adj: Record<string, Set<string>>): string | null {
  // Probar ambas heurísticas de raíz sin importar el tipo de red (no solo "AF usa isAC2, AC usa
  // CALENT") — una red AC alimentada indirectamente, o cuyo tramo troncal no lleva literalmente
  // un código 'CALENT', antes no encontraba raíz aquí y caía silenciosamente a la suma no
  // dirigida de componente completa de computeComponentTotals (todo tramo mostrando el mismo
  // total general) sin ninguna indicación de que algo había salido mal.
  // índice de claves de tramo: el .some por cada nodo de la adyacencia era O(n²).
  const clavesDeTramo = new Set(tramos.map((t) => tramoKeyOf(t)));
  const rootT =
    tramos.find(isAC2) ||
    tramos.find(
      (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
    );
  let rootKey = rootT ? tramoKeyOf(rootT) : null;
  // Ninguna heurística encontró raíz (p. ej. una red AC sin tramo de calentador dibujado aún, o
  // con nomenclatura ini/fin no estándar) — caer a ninguna raíz significaba que
  // computeDirectedTotals terminaba en la suma no dirigida de componente completa de
  // computeComponentTotals (todo tramo mostrando el total general idéntico, que es el síntoma
  // exacto "todos con el mismo caudal"). Aproximar el tronco en su lugar: el tramo con más
  // conexiones es el mejor sustituto disponible de "lo más cercano a la fuente" sin que haya uno
  // identificable explícitamente.
  if (!rootKey) {
    let bestKey: string | null = null,
      bestDeg = -1;
    for (const k of Object.keys(adj)) {
      if (!clavesDeTramo.has(k)) continue;
      const deg = adj[k]?.size || 0;
      if (deg > bestDeg) {
        bestDeg = deg;
        bestKey = k;
      }
    }
    if (bestDeg > 0) rootKey = bestKey;
  }
  return rootKey;
}

/** Mapas de carga resultantes: UC total, Q probable Hunter, árbol de padres y UC propia. */
export interface LoadsResult {
  componentTotalMap: Record<string, number>;
  qpropMap: Record<string, number>;
  tramoParentOf: Record<string, string>;
  propiaMap: Record<string, number>;
}

/** Acumula UC/Q Hunter por tramo y resuelve el árbol de padres y la UD propia de cada clave. */
export function computeLoads(
  tramos: Tramo[],
  adj: Record<string, Set<string>>,
  rootKey: string | null,
  AP: AparatoUc[],
): LoadsResult {
  // Dirigido (enraizado en la fuente real de suministro), no la componente conectada no dirigida
  // completa — ver connectionGraph.ts. Una rama que alimenta un fixture debe mostrar solo SU
  // total acumulado propio, no la demanda de todo el edificio solo porque hidráulicamente sea
  // parte de la misma red.
  // CARGA PROPAGADA (orig. usuario): las claves de aparatos ya traen la carga acumulada
  // escrita por propagarAparatosPresion (propia + heredada aguas arriba). El total del tramo
  // es SU carga directamente — acumular el subárbol encima duplicaría lo que ya viene en la
  // clave. mergeBranches queda para conectividad/etiquetas, ya no reescribe totales.
  const componentTotalMap: Record<string, number> = {};
  for (const t of tramos) {
    componentTotalMap[tramoKeyOf(t)] = calcUCparcial(t, AP, 'uc');
  }
  // Flujo probable (curva de Hunter, K·f(UC)) por tramo — `total` lee
  // componentTotalMap[key], lectura directa de la clave (carga ya propagada). La fórmula
  // corre sobre el total UC correcto de cada tramo, mergeado o no.
  const qpropMap: Record<string, number> = {};
  for (const t of tramos) {
    const key = tramoKeyOf(t);
    const nDesc = t.nSalidas || 0;
    qpropMap[key] = hunterQ(componentTotalMap[key] || 0, nDesc);
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

  const tramoKeySet = new Set(tramos.map((t) => tramoKeyOf(t)));
  const tramoParentOf: Record<string, string> = {};
  for (const t of tramos) {
    const key = tramoKeyOf(t);
    let cur = nodeParentOf[key];
    while (cur && !tramoKeySet.has(cur)) cur = nodeParentOf[cur];
    if (cur) tramoParentOf[key] = cur;
  }

  // UD PROPIA = carga de la clave − heredada del libro: lo nacido en el tramo más lo
  // plegado por sus tributarios (orig. usuario: lo propagado por tributarios cuenta en
  // propia). El plegado vive DENTRO de la carga y fuera del libro her, así que queda
  // incluido sin sumarlo aparte.
  const propiaMap: Record<string, number> = {};
  for (const t of tramos) {
    const hered = t._aparatosKey ? leerHeredadosPresion(t._aparatosKey) : {};
    let hUc = 0;
    for (const d of AP) hUc += (hered[d.id] || 0) * (Number(d.uc) || 0);
    propiaMap[tramoKeyOf(t)] = Math.max(0, calcUCparcial(t, AP, 'uc') - hUc);
  }

  return { componentTotalMap, qpropMap, tramoParentOf, propiaMap };
}
