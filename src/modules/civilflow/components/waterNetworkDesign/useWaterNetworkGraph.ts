import { useMemo } from 'react';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';
import { APARATOS_DEF } from '../../constants';
import { calcUCparcial } from '../../utils/componentHelpers';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { loadFromStorage } from '../../services/storageService';
import { distToPolyline } from '../../lib/shared/geometry';
import { computeDirectedTotals } from '../../lib/shared/connectionGraph';
import type { DrawingData, RawElement } from '../../utils/drawingSync';
import { resolveJunctionEntrant } from '../../utils/flowDirection';
import { isAC2 } from '../../utils/waterNetworkRows';

interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
}

// Grafo de conectividad de la red leído de TODOS los planos dibujados: enlaces ramal→bajante y
// ramal→ramal por cercanía de extremos, puentes de montantes entre pisos, poda de ciclos y
// fusiones de empalmes. Devuelve los totales dirigidos por tramo, el mapa de padres, la raíz de
// presión y el caudal probable por tramo. Es el insumo de toda la tabla de diseño.
/** Grafo de conectividad de la red leído de todos los planos dibujados: enlaces por cercanía
 *  de extremos, puentes de montantes entre pisos, poda de ciclos y fusiones de empalmes.
 *  Devuelve los totales dirigidos, el mapa de padres, la raíz de presión y el caudal por tramo. */
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

  const [conexionesDisplay, componentTotalMap, tramoParentOf, rootKey, qpropMap] = useMemo(() => {
    const calculoMap: Record<string, string[]> = {};
    // Un montante/bajante no conserva identidad entre pisos — copiar un trazo entre planos le
    // asigna un id/código nuevo (ver copyDrawingFromPlan.ts). La única señal confiable de que dos
    // elementos por piso son el mismo tubo ascendente físico es estar (aproximadamente) en el
    // mismo x/y en pisos distintos — se recolectan aquí y se enlazan una vez escaneados todos los planos.
    const bajanteNodes: Array<{ key: string; x: number; y: number; nivel: number }> = [];
    // Un ramal auto-creado en empalme T/Y (autoSplitJunctionAndSumFlow, PlanoEngineDrawing.ts)
    // lleva mergesFrom = [idA, idB] — pero eso solo registra el PAR que disparó el corte en medio
    // del cuerpo. Un tercer (o cuarto) ramal que termina en la misma coordenada se conecta por
    // empalme extremo-a-extremo simple y nunca entra a mergesFrom — y aun así su arista de
    // adyacencia por proximidad debe cortarse de las OTRAS ramas en ese mismo punto, o su UC se
    // filtra a la rama con la que empate por desempate. Por eso el conjunto real de "ramas en
    // este empalme" se descubre por coordenada, no solo leyendo mergesFrom.
    const mergeBranches: Record<string, string[]> = {};
    // Cada extremo de ramal, etiquetado con su plano — se usa abajo para hallar empalmes PLANOS
    // (sin mergesFrom) donde 3+ ramales coinciden en una coordenada por dibujo extremo-a-extremo
    // común (un tronco que se divide en ramas). `checkEndpoint` abajo solo enlaza cada extremo a
    // su vecino más cercano, independiente por ramal — en un punto de 3 vías eso puede producir
    // un triángulo/ciclo de aristas (A-B por la búsqueda de A, B-C por la de B, C-A por la de C),
    // y un ciclo rompe el árbol BFS de padre único del que depende computeDirectedTotals,
    // corrompiendo los totales de todos los del ciclo. Se poda a un árbol sin ciclos más abajo.
    const ramalEndpoints: Array<{ key: string; x: number; y: number; planId: string }> = [];

    for (const plan of plans || []) {
      if (plan.nivel == null) continue;
      const raw = loadFromStorage<DrawingData | string | null>(TRAZOS_PREFIX + plan.id, null);
      if (!raw) continue;
      let data: DrawingData = raw as DrawingData;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          continue;
        }
      }

      const ramales = (data.ramales || []).filter((r) => r.net === networkType);
      const bajantes = (data.bajantes || []).filter((b): b is BajanteRaw => b.net === networkType);
      const TOL_MERGE = 2.0;
      const originOf = (ram: { pts: number[][]; _tribReversed?: boolean }) =>
        ram._tribReversed ? ram.pts[ram.pts.length - 1] : ram.pts[0];
      const entersAt = (ram: { pts: number[][]; _tribReversed?: boolean }, pt: number[]) => {
        const o = originOf(ram);
        return Math.hypot(o[0] - pt[0], o[1] - pt[1]) >= TOL_MERGE;
      };
      for (const r of ramales) {
        if (!r.mergesFrom || !r.pts || r.pts.length === 0) continue;
        // El ramal auto-creado siempre arranca exactamente en la coordenada del empalme
        // (autoSplitJunctionAndSumFlow: downstreamPts = [[ep[0],ep[1]], ...]).
        const jc = r.pts[0];
        // `r.mergesFrom` es siempre [existing.id, incoming.id] por construcción. Cuál de los tres
        // ramales de este empalme (existing, downstream=r, incoming) MUESTRA el total combinado se
        // decide solo por la dirección actual del flujo — no está fijo a "existing" ni al
        // "auto-creado": junctionHasOutgoingFlow ya garantiza que al menos uno de los tres flujos
        // SALE de jc, así que con tres ramales la división es siempre 2-vs-1, y el único disidente
        // (el que discrepa de los otros dos) es el entrante. Se recalcula fresco desde el
        // `_tribReversed` actual en cada render, para que un "Invertir dirección de flujo" en
        // cualquiera de los tres cambie de inmediato cuál acumula. Espejo de waterNetworkRows.ts.
        const [aId, bId] = r.mergesFrom;
        const existingObj = ramales.find((x) => x.id === aId);
        const incomingObj = ramales.find((x) => x.id === bId);
        const targetId = existingObj
          ? resolveJunctionEntrant(jc, existingObj, r, incomingObj)
          : aId;
        const branchIds = [aId, r.id, bId].filter((id) => id !== targetId);
        const targetKeyFull = `${targetId}-${plan.id}`;
        const branchSet = new Set<string>(branchIds.map((id) => `${id}-${plan.id}`));
        for (const other of ramales) {
          if (other.id === r.id || other.id === aId || !other.pts || other.pts.length < 2) continue;
          const otherKey = `${other.id}-${plan.id}`;
          if (branchSet.has(otherKey)) continue;
          const oStart = other.pts[0],
            oEnd = other.pts[other.pts.length - 1];
          const touchesJc =
            Math.hypot(oStart[0] - jc[0], oStart[1] - jc[1]) < TOL_MERGE ||
            Math.hypot(oEnd[0] - jc[0], oEnd[1] - jc[1]) < TOL_MERGE;
          if (!touchesJc) continue;
          const otherEnters = entersAt(
            { pts: other.pts, _tribReversed: Boolean(other._tribReversed) },
            jc,
          );
          if (!otherEnters) continue;
          branchSet.add(otherKey);
        }
        mergeBranches[targetKeyFull] = Array.from(branchSet);
      }
      for (const b of bajantes) {
        if (b.x == null || b.y == null) continue;
        bajanteNodes.push({ key: `${b.id}-${plan.id}`, x: b.x, y: b.y, nivel: plan.nivel });
      }
      for (const r of ramales) {
        if (!r.pts || r.pts.length < 2) continue;
        const rKeyFull = `${r.id}-${plan.id}`;
        ramalEndpoints.push({
          key: rKeyFull,
          x: r.pts[0][0],
          y: r.pts[0][1],
          planId: String(plan.id),
        });
        ramalEndpoints.push({
          key: rKeyFull,
          x: r.pts[r.pts.length - 1][0],
          y: r.pts[r.pts.length - 1][1],
          planId: String(plan.id),
        });
      }

      for (const r of ramales) {
        if (!r.pts || r.pts.length < 2) continue;
        const pStart = r.pts[0];
        const pEnd = r.pts[r.pts.length - 1];
        const rKey = `${r.id}-${plan.id}`;

        const checkEndpoint = (pt: number[]) => {
          for (const b of bajantes) {
            const isExplicit =
              b.recibeDeIds &&
              (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
            const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
            if (isExplicit) {
              // El enlace explícito no dice en qué extremo — se asigna al extremo que quede
              // geométricamente más cerca, para que un bajante en cada extremo reclame el suyo.
              const otherPt = pt === pEnd ? pStart : pEnd;
              const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
              if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
              continue;
            }
            if (dist < 2.0) {
              return { type: 'bajante' as const, id: b.id };
            }
          }
          let bestRx: RawElement | null = null;
          let minDist = Infinity;
          for (const rx of ramales) {
            if (rx.id === r.id) continue;
            if (!rx.pts || rx.pts.length < 2) continue;
            const dist = distToPolyline(pt, rx.pts);
            if (dist < 2.0 && dist < minDist) {
              minDist = dist;
              bestRx = rx;
            }
          }
          if (bestRx) {
            return { type: 'ramal' as const, id: bestRx.id };
          }
          return null;
        };

        // Un ramal puede tener un bajante en CADA extremo — revisar ambos extremos de forma
        // independiente en lugar de cortar en la primera coincidencia, o el segundo bajante se
        // pierde en silencio de calculoMap.
        const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
          (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null,
        );

        for (const connection of connections) {
          const targetKey = `${connection.id}-${plan.id}`;
          if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
          if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
        }
      }
    }

    // Puentear nodos montante/bajante en la misma posición entre pisos consecutivos (ver
    // comentario anterior) para que un ramal que termina en el sube-baja de un piso conecte
    // hasta el del piso siguiente.
    const usedNode = new Set<number>();
    for (let i = 0; i < bajanteNodes.length; i++) {
      if (usedNode.has(i)) continue;
      const group = [bajanteNodes[i]];
      usedNode.add(i);
      for (let j = i + 1; j < bajanteNodes.length; j++) {
        if (usedNode.has(j)) continue;
        if (
          Math.hypot(bajanteNodes[j].x - bajanteNodes[i].x, bajanteNodes[j].y - bajanteNodes[i].y) <
          2.0
        ) {
          group.push(bajanteNodes[j]);
          usedNode.add(j);
        }
      }
      if (group.length < 2) continue;
      group.sort((a, b) => a.nivel - b.nivel);
      for (let k = 0; k < group.length - 1; k++) {
        const a = group[k].key,
          b = group[k + 1].key;
        if (!calculoMap[a]) calculoMap[a] = [];
        if (!calculoMap[a].includes(b)) calculoMap[a].push(b);
      }
    }

    // Construir lista de adyacencia no dirigida de todos los tramos
    const adj: Record<string, string[]> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      adj[key] = [];
    }

    for (const [parentKey, children] of Object.entries(calculoMap)) {
      if (!adj[parentKey]) adj[parentKey] = [];
      for (const childKey of children) {
        if (!adj[childKey]) adj[childKey] = [];
        if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
        if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
      }
    }
    // Cortar las aristas que un mergeOverride manejará explícitamente — si no, el árbol BFS
    // general de abajo haría ADEMÁS que el más cercano a la raíz de los dos ramales que se
    // fusionan absorba al otro (y al propio ramal fusionado) en sí, encima del override que ya
    // fuerza el total del ramal fusionado a su suma: la misma demanda se contaría dos veces.
    // Cortar también cualquier arista DIRECTA k1<->k2: en un punto de fusión de 3 vías los tres
    // extremos de los ramales están en la misma coordenada exacta, así que la coincidencia por
    // proximidad de arriba (checkEndpoint / distToPolyline) puede resolver el vecino más cercano
    // de un ramal fuente hacia la OTRA fuente en lugar del ramal fusionado (empate de distancia
    // roto por el orden del arreglo). Sin cortarla, esa arista suelta deja que el total de una
    // fuente se filtre en la otra — p. ej. RAF1 tomando el total de RAF2 — aunque el total del
    // propio ramal fusionado ya está correctamente forzado a su suma justo abajo.
    for (const [mergedKey, branches] of Object.entries(mergeBranches)) {
      adj[mergedKey] = (adj[mergedKey] || []).filter((k) => !branches.includes(k));
      for (const b of branches) {
        if (adj[b]) adj[b] = adj[b].filter((k) => k !== mergedKey && !branches.includes(k));
      }
    }

    // Empalmes PLANOS (sin mergesFrom): agrupar cada extremo de ramal por coordenada (solo del
    // mismo plano) para hallar todo punto donde 3+ ramales coinciden por dibujo común (un tronco
    // que se divide en ramas, o varias ramas que llegan a un mismo sitio) — `checkEndpoint` de
    // arriba enlaza cada extremo de forma independiente a su único vecino más cercano, lo que en
    // un punto de 3+ vías puede producir un triángulo/ciclo de aristas. Un ciclo rompe la premisa
    // de padre único por nodo del BFS de computeDirectedTotals, corrompiendo los totales de todos
    // los miembros del ciclo (no solo fuentes de fusión — esto cubre el caso general). Podar a un
    // árbol sin ciclos por clúster vía union-find, sin desconectar a nadie (solo elimina una
    // arista que cerraría un ciclo dentro del mismo clúster).
    const usedEp = new Set<number>();
    for (let i = 0; i < ramalEndpoints.length; i++) {
      if (usedEp.has(i)) continue;
      const cluster = [ramalEndpoints[i]];
      usedEp.add(i);
      for (let j = i + 1; j < ramalEndpoints.length; j++) {
        if (usedEp.has(j)) continue;
        if (ramalEndpoints[j].planId !== ramalEndpoints[i].planId) continue;
        if (
          Math.hypot(
            ramalEndpoints[j].x - ramalEndpoints[i].x,
            ramalEndpoints[j].y - ramalEndpoints[i].y,
          ) < 2.0
        ) {
          cluster.push(ramalEndpoints[j]);
          usedEp.add(j);
        }
      }
      const memberKeys = Array.from(new Set(cluster.map((c) => c.key)));
      if (memberKeys.length < 2) continue;
      const memberSet = new Set(memberKeys);
      const parent = new Map(memberKeys.map((k) => [k, k]));
      const find = (x: string): string => {
        while (parent.get(x) !== x) x = parent.get(x)!;
        return x;
      };
      for (const a of memberKeys) {
        for (const b of [...(adj[a] || [])]) {
          if (!memberSet.has(b) || a >= b) continue;
          const ra = find(a),
            rb = find(b);
          if (ra === rb) {
            adj[a] = adj[a].filter((k) => k !== b);
            if (adj[b]) adj[b] = adj[b].filter((k) => k !== a);
          } else {
            parent.set(ra, rb);
          }
        }
      }
    }

    // Helper: BFS para obtener vecinos directos (excluye startKey y se detiene en cualquier ramal principal)
    const getConnectedNeighbors = (startKey: string): string[] => {
      const results = new Set<string>();
      const visited = new Set<string>();
      const queue = [startKey];
      visited.add(startKey);

      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node !== startKey) {
          const tr = tramos.find((x) => (x._key || x.id) === node);
          const isMainRamal = tr && tr.tipo !== 'tributario' && !tr.esBajante;
          if (isMainRamal) {
            results.add(node);
            continue; // Detener recorrido en este ramal principal
          }
        }
        for (const neighbor of adj[node] || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      return Array.from(results);
    };

    const displayMap: Record<string, string[]> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      if (t.tipo !== 'tributario' && !t.esBajante) {
        displayMap[key] = getConnectedNeighbors(key);
      }
    }
    // Las aristas de las ramas fusionadas se cortaron de `adj` arriba para que el BFS de árbol
    // dirigido no contara dos veces la UC del ramal fusionado por la vía general — pero eso
    // también ocultó los ramales fuente de "Otros Ramales" aquí, ya que esto lee ese mismo `adj`
    // cortado. Reagregarlos explícitamente: el ramal fusionado debe mostrar los ramales de los
    // que fue creado. Misma exclusión tributario/bajante que toda otra vía hacia displayMap
    // (chequeo isMainRamal de getConnectedNeighbors) — una fuente de fusión mal etiquetada como
    // tributario (ver el guard de existing.tipo en autoSplitJunctionAndSumFlow) tampoco debe
    // colarse en esta columna.
    for (const [mergedKey, branches] of Object.entries(mergeBranches)) {
      if (!displayMap[mergedKey]) continue;
      for (const k of branches) {
        const tr = tramos.find((x) => (x._key || x.id) === k);
        if (tr && (tr.tipo === 'tributario' || tr.esBajante)) continue;
        if (!displayMap[mergedKey].includes(k)) displayMap[mergedKey].push(k);
      }
    }
    // La fila "Otros Ramales" de una fuente de fusión debe mostrar NADA — ni su co-fuente, ni
    // siquiera el ramal auto-creado al que alimenta (esa asociación ya se ve desde la OTRA
    // dirección: la fila del propio ramal auto-creado lista ambas fuentes, vía el ciclo de
    // arriba). Solo la fila del ramal auto-creado debe mostrar asociación para esta fusión.
    for (const branches of Object.values(mergeBranches)) {
      for (const b of branches) {
        if (displayMap[b]) displayMap[b] = [];
      }
    }
    // Dirigir la misma adyacencia desde la fuente de presión de la red hacia afuera, para que el
    // Pinicial de cada tramo pueda encadenarse desde el Pfinal de su tramo aguas arriba real en
    // lugar de la presión plana de acometida. La fuente de AF es el tramo troncal (Contador→Mon,
    // isAC2); AC no tiene acometida propia — su fuente es el tramo que llega al calentador,
    // alimentado desde AF (ver sección de presión).
    const rootT =
      tramos.find(isAC2) ||
      tramos.find(
        (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
      );
    let rootKey = rootT ? rootT._key || rootT.id : null;
    // Ninguna heurística encontró raíz — de otro modo cae hasta la suma no dirigida del
    // componente completo de computeComponentTotals (todo tramo mostrando el mismo gran total).
    // Aproximar el troncal con el tramo más conectado en lugar de rendirse con la dirección.
    if (!rootKey) {
      let bestKey: string | null = null,
        bestDeg = -1;
      for (const k of Object.keys(adj)) {
        if (!tramos.some((t) => (t._key || t.id) === k)) continue;
        const deg = adj[k]?.length || 0;
        if (deg > bestDeg) {
          bestDeg = deg;
          bestKey = k;
        }
      }
      if (bestDeg > 0) rootKey = bestKey;
    }

    // Enraizado en la fuente real de suministro, no en todo el componente conectado no dirigido
    // — una rama que alimenta un aparato solo debe mostrar SU total acumulado, no la demanda de
    // todo el edificio solo por ser hidráulicamente parte de la misma red (ver connectionGraph.ts).
    const componentTotalMap = computeDirectedTotals(
      tramos,
      (t) => t._key || t.id,
      adj,
      (t) => calcUCparcial(t, AP, 'uc'),
      rootKey,
    );
    // El entrante ahora puede ser el propio ramal auto-creado (cuando su dirección de flujo quedó
    // invertida respecto a `existing`) — y ese ramal puede llevar SUS propios aparatos directos,
    // no solo los totales de las ramas fusionadas. Guardar el total pre-override (propio, basado
    // en árbol) de cada objetivo ANTES de que el ciclo de abajo lo sobreescriba, para que el
    // override pueda SUMAR las ramas en vez de reemplazarlo — si no, un aparato asignado
    // directamente al ramal entrante desaparecía en silencio de su propio total mostrado.
    const ownTotalMap: Record<string, number> = {};
    for (const [key] of Object.entries(mergeBranches)) {
      if (componentTotalMap[key] !== undefined) ownTotalMap[key] = componentTotalMap[key];
    }
    // Una cadena de fusiones (R1+R2→R5, luego R5+R3→R6) necesita que el override propio de R5 se
    // resuelva antes de que R6 lo lea como fuente — Object.entries() no garantiza procesar las
    // fuentes antes que sus consumidores, así que una sola pasada podría leer un valor aún sin
    // override (sigue basado en árbol, incorrecto) para una fuente que a su vez es una fusión.
    // Iterar hasta un punto fijo en lugar de una sola pasada.
    const mergeEntries = Object.entries(mergeBranches);
    for (let pass = 0; pass <= mergeEntries.length; pass++) {
      let changedAny = false;
      for (const [key, branches] of mergeEntries) {
        if (componentTotalMap[key] === undefined) continue;
        const next =
          (ownTotalMap[key] || 0) +
          branches.reduce((sum, b) => sum + (componentTotalMap[b] || 0), 0);
        if (next !== componentTotalMap[key]) {
          componentTotalMap[key] = next;
          changedAny = true;
        }
      }
      if (!changedAny) break;
    }
    // Un ramal que ALIMENTA una fusión (una rama en mergeBranches) nunca debe mostrar un total
    // distinto solo por ser fuente de fusión — su total mostrado queda exactamente en su propia
    // UC/UD, sin importar lo que el plegado de árbol dirigido haya tomado para él por alguna otra
    // vía no cortada. Omitir ramas que a su vez son objetivo de fusión (cadenas anidadas) — esas
    // sí conservan legítimamente el valor sumado del ciclo de arriba, no su valor propio crudo.
    const allBranchIds = new Set<string>();
    for (const branches of Object.values(mergeBranches)) {
      for (const b of branches) allBranchIds.add(b);
    }
    for (const branchId of allBranchIds) {
      if (mergeBranches[branchId]) continue;
      const t = tramos.find((x) => (x._key || x.id) === branchId);
      if (t) componentTotalMap[branchId] = calcUCparcial(t, AP, 'uc');
    }
    const nodeParentOf: Record<string, string> = {};
    if (rootKey) {
      const visited = new Set<string>([rootKey]);
      const queue = [rootKey];
      while (queue.length > 0) {
        const node = queue.shift()!;
        for (const neighbor of adj[node] || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            nodeParentOf[neighbor] = node;
            queue.push(neighbor);
          }
        }
      }
    }

    // El BFS de arriba también recorre puntos de unión bajante/contador/montante (son nodos en
    // `adj` pero no objetos Tramo) — colapsarlos al tramo real aguas arriba más cercano para que
    // los llamadores vayan directo de la key de un tramo a la key del tramo que lo gobierna.
    const tramoKeySet = new Set(tramos.map((t) => t._key || t.id));
    const tramoParentOf: Record<string, string> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      let cur = nodeParentOf[key];
      while (cur && !tramoKeySet.has(cur)) cur = nodeParentOf[cur];
      if (cur) tramoParentOf[key] = cur;
    }

    // Flujo probable (curva de Hunter, K·f(UC)) por tramo — para un ramal auto-creado en empalme
    // T/Y, `total` ya lee componentTotalMap[key], sobreescrito arriba (línea 353-356) con la suma
    // de la UC de las dos ramas fusionadas. Así la fórmula aquí corre sobre el total UC combinado
    // correcto para todo tramo, fusionado o no — no se necesita override aparte.
    const qpropMap: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      const nDesc = t.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      const total = componentTotalMap[key] || 0;
      qpropMap[key] =
        total > 0 && K > 0
          ? Math.round(
              K *
                (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
                1000,
            ) / 1000
          : 0;
    }

    return [displayMap, componentTotalMap, tramoParentOf, rootKey, qpropMap] as const;
  }, [plans, tramos, networkType, AP]);

  return {
    AP,
    conexionesDisplay,
    componentTotalMap,
    tramoParentOf,
    pressureRootKey: rootKey,
    qpropMap,
  };
}
