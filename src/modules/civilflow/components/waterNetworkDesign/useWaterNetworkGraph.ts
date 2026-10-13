import { useMemo } from 'react';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext';
import { APARATOS_DEF } from '../../constants';
import { calcUCparcial } from '../../utils/componentHelpers';
import { TRAZOS_PREFIX } from '../../constants/storage-keys';
import { loadFromStorage } from '../../services/storageService';
import { distToPolyline } from '../../lib/shared/geometry';
import type { DrawingData, RawElement } from '../../utils/drawingSync';
import { isLdesvioRamalId } from '../../utils/associateBajanteAcrossFloors';
import { hunterQ } from './rowPhysics';
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
    const otrosDisplay: Record<string, string[]> = {};
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

      // Mismo filtro que el snapshot de memoria (waterRowsCore): los L-desvío no son
      // tramos de red — sin él la tabla viva y la memoria divergen.
      const ramales = (data.ramales || []).filter(
        (r) => r.net === networkType && !isLdesvioRamalId(r.id),
      );
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
        // "Otros ramales" de la continuación (orig. usuario): TODOS los participantes del
        // empalme según el flujo excepto ella misma — RAF3 lista a RAF1 (el anfitrión que
        // la alimenta) y a RAF2 (la rama cuyo aparato carga), incluido el target.
        const continuacionKey = `${r.id}-${plan.id}`;
        const otros = Array.from(
          new Set<string>([`${aId}-${plan.id}`, `${bId}-${plan.id}`, ...branchSet]),
        ).filter((k: string) => k !== continuacionKey);
        if (otros.length) otrosDisplay[continuacionKey] = otros;
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
      // Fallback geométrico (auditoría #9): uniones dibujadas extremo-con-extremo SIN split
      // (sin `mergesFrom`) nunca entraban al loop de arriba y la columna quedaba vacía aunque
      // la propagación (clústeres del motor) sí las entiende. Misma tolerancia del motor
      // (0.5px, splits exactos) y mismo plano por construcción. No pisa lo resuelto por flujo.
      {
        const pts: Array<{ key: string; p: number[] }> = [];
        for (const r of ramales) {
          if (!r.pts || r.pts.length < 2) continue;
          const k = `${r.id}-${plan.id}`;
          pts.push({ key: k, p: r.pts[0] });
          pts.push({ key: k, p: r.pts[r.pts.length - 1] });
        }
        const padre = pts.map((_, i) => i);
        const hallar = (i: number): number => {
          const p = padre[i];
          if (p === undefined || p === i) return i;
          const r = hallar(p);
          padre[i] = r;
          return r;
        };
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            if (Math.hypot(pts[i].p[0] - pts[j].p[0], pts[i].p[1] - pts[j].p[1]) <= 0.5) {
              padre[hallar(i)] = hallar(j);
            }
          }
        }
        const grupos = new Map<number, number[]>();
        pts.forEach((_, i) => {
          const r = hallar(i);
          if (!grupos.has(r)) grupos.set(r, []);
          grupos.get(r)!.push(i);
        });
        for (const grupo of grupos.values()) {
          const claves = [...new Set(grupo.map((g) => pts[g].key))];
          if (claves.length < 2) continue;
          if (claves.some((k) => otrosDisplay[k])) continue; // el flujo ya resolvió
          for (const k of claves) {
            otrosDisplay[k] = claves.filter((c) => c !== k);
          }
        }
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

    // "Otros ramales" = TODOS los participantes del empalme menos la propia fila
    // (anfitrión + entrantes + co-salidas, ronda 28; el fallback geométrico aporta las
    // uniones sin split con el mismo criterio).
    const displayMap: Record<string, string[]> = {};
    for (const [k, list] of Object.entries(otrosDisplay)) {
      const visibles = list.filter((key) => {
        const tr = tramos.find((x) => (x._key || x.id) === key);
        return tr && tr.tipo !== 'tributario' && !tr.esBajante;
      });
      if (visibles.length) displayMap[k] = visibles;
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
    // CARGA PROPAGADA (orig. usuario): ver waterRowsCore — las claves ya traen la carga
    // (propia + heredada); el total del tramo es directo, sin acumulación de subárbol ni
    // overrides de merge (duplicarían lo que la propagación ya escribió).
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

    // Flujo probable (curva de Hunter, K·f(UC)) por tramo — `total` lee
    // componentTotalMap[key], que es lectura directa de la clave (carga ya propagada).
    // Así la fórmula corre sobre el total UC correcto para todo tramo, fusionado o no.
    const qpropMap: Record<string, number> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      const nDesc = t.nSalidas || 0;
      qpropMap[key] = hunterQ(componentTotalMap[key] || 0, nDesc);
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
