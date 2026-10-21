import { useMemo } from 'react';
import type { BajanteRaw } from '../../utils/drawingSyncTypes.ts';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext.tsx';
import { APARATOS_DEF } from '../../constants';
import { calcUCparcial } from '../../utils/componentHelpers.tsx';
import { TRAZOS_PREFIX } from '../../constants/storage-keys.ts';
import { loadFromStorage } from '../../services/storageService.ts';
import { distToPolyline } from '../../lib/shared/geometry';
import type { DrawingData, RawElement } from '../../utils/drawingSync.ts';
import { isLdesvioRamalId } from '../../utils/associateBajanteAcrossFloors';
import { hunterQ } from './rowPhysics.ts';
import { resolveJunctionEntrant } from '../../utils/flowDirection.ts';
import { isAC2 } from '../../utils/waterRedFilas.ts';
import { indicePorClave } from '../../utils/indices';

// Grafo de conectividad de la red leído de TODOS los planos dibujados: enlaces ramal→bajante y
// ramal→ramal por cercanía de extremos, puentes de montantes entre pisos, poda de ciclos y
// fusiones de empalmes. Devuelve los totales dirigidos por tramo, el mapa de padres, la raíz de
// presión y el caudal probable por tramo. Es el insumo de toda la tabla de diseño.
/**
 * Participantes del empalme de un ramal: quienes tocan su punto de unión (empalme) hoy, excepto
 * él mismo. La genealogía mergesFrom (genealogía del split) queda stale tras re-splits y listaba
 * al anfitrión ancestral aunque ya no toque el empalme (orig. usuario caso RAC3-P2: [RAC1][RAC2]
 * con RAC1 a 250px). Ej: RAC3 con RAC2 y RAC4 tocando su unión -> ['RAC2-P1','RAC4-P1'].
 * @param ramales - ramales del plano con geometría.
 * @param rId - id del ramal continuación.
 * @param planId - id del plano.
 * @param tol - tolerancia en px (misma del motor para uniones).
 * @returns claves `id-planId` de quienes tocan la unión.
 */
/**
 * ¿Toca algún extremo del ramal el punto dado? Predicado único de cercanía a empalmes
 * (una sola tolerancia: si diverge aquí, la columna Otros y el merge discrepan).
 * @param o - ramal candidato con geometría.
 * @param jc - punto del empalme.
 * @param tol - tolerancia en px.
 * @returns true si un extremo cae dentro de la tolerancia.
 */
export function tocaEmpalme(o: { pts?: number[][] }, jc: number[], tol: number): boolean {
  if (!o.pts || o.pts.length < 2) return false;
  const s = o.pts[0];
  const e = o.pts[o.pts.length - 1];
  return (
    Math.hypot(s[0] - jc[0], s[1] - jc[1]) < tol || Math.hypot(e[0] - jc[0], e[1] - jc[1]) < tol
  );
}
export function otrosPorToque(
  ramales: Array<{ id: string; pts?: number[][] }>,
  rId: string,
  planId: string | number,
  tol = 2.0,
): string[] {
  const r = ramales.find((x) => x.id === rId);
  if (!r?.pts || r.pts.length === 0) return [];
  const jc = r.pts[0];
  return ramales
    .filter((o) => o.id !== rId && tocaEmpalme(o, jc, tol))
    .map((o) => `${o.id}-${planId}`);
}
/** Grafo de conectividad de la red leído de todos los planos dibujados: enlaces por cercanía de extremos, puentes de montantes
 * entre pisos, poda de ciclos y fusiones de empalmes. */
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

  // Índice de tramos por clave "id-planId": los .find/.some repetidos eran O(n) por consulta.
  const tramoPorClave = useMemo(
    () => indicePorClave(tramos, (t) => t._key || t.id || null),
    [tramos],
  );
  const [conexionesDisplay, componentTotalMap, tramoParentOf, rootKey, qpropMap] = useMemo(() => {
    // Sets: la pertenencia (¿ya enlazado?) era un .includes sobre un array que crece — O(n²)
    // al construir la adyacencia.
    const calculoMap = new Map<string, Set<string>>();
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
      // Set de los ramales que cada bajante recibe (el .includes dentro del bucle era O(n)).
      const recibePorBajante = new Map<string, Set<string>>();
      for (const b of bajantes) {
        if (b.id) recibePorBajante.set(b.id, new Set(b.recibeDeIds || []));
      }
      const TOL_MERGE = 2.0;
      const originOf = (ram: { pts: number[][]; _tribReversed?: boolean }) =>
        ram._tribReversed ? ram.pts[ram.pts.length - 1] : ram.pts[0];
      const entersAt = (ram: { pts: number[][]; _tribReversed?: boolean }, pt: number[]) => {
        const o = originOf(ram);
        return Math.hypot(o[0] - pt[0], o[1] - pt[1]) >= TOL_MERGE;
      };
      // Índice id→ramal del plano: el bucle de empalmes busca por id (O(n) por ramal) — con
      // el índice es O(1). El primero gana (como haría un .find).
      const ramalPorId = new Map<string, (typeof ramales)[number]>();
      for (const r of ramales) if (!ramalPorId.has(r.id)) ramalPorId.set(r.id, r);
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
        // cualquiera de los tres cambie de inmediato cuál acumula. Espejo de waterRedFilas.ts.
        const [aId, bId] = r.mergesFrom;
        const existingObj = ramalPorId.get(aId);
        const incomingObj = ramalPorId.get(bId);
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
          if (!tocaEmpalme(other, jc, TOL_MERGE)) continue;
          const otherEnters = entersAt(
            { pts: other.pts, _tribReversed: Boolean(other._tribReversed) },
            jc,
          );
          if (!otherEnters) continue;
          branchSet.add(otherKey);
        }
        // "Otros ramales" de la continuación (orig. usuario caso RAC3-P2): quienes TOCAN el
        // empalme hoy, excepto ella misma — ver otrosPorToque.
        const continuacionKey = `${r.id}-${plan.id}`;
        const otros = otrosPorToque(ramales, r.id, plan.id, TOL_MERGE);
        if (otros.length) otrosDisplay[continuacionKey] = otros;
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
            const recibe = b.id ? recibePorBajante.get(b.id) : undefined;
            const isExplicit = !!recibe && (recibe.has(r.id) || (!!r.label && recibe.has(r.label)));
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
          let set = calculoMap.get(targetKey);
          if (!set) {
            set = new Set<string>();
            calculoMap.set(targetKey, set);
          }
          set.add(rKey);
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
        let setA = calculoMap.get(a);
        if (!setA) {
          setA = new Set<string>();
          calculoMap.set(a, setA);
        }
        setA.add(b);
      }
    }

    // Construir lista de adyacencia no dirigida de todos los tramos
    // Set por nodo: la adyacencia se consulta y se poda mucho (era .includes/.filter sobre
    // arrays — O(n²) al podar).
    const adj: Record<string, Set<string>> = {};
    for (const t of tramos) {
      const key = t._key || t.id;
      adj[key] = new Set();
    }

    for (const [parentKey, children] of calculoMap) {
      if (!adj[parentKey]) adj[parentKey] = new Set();
      for (const childKey of children) {
        if (!adj[childKey]) adj[childKey] = new Set();
        adj[parentKey].add(childKey);
        adj[childKey].add(parentKey);
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
      const setBranches = new Set(branches);
      if (adj[mergedKey]) {
        adj[mergedKey] = new Set([...adj[mergedKey]].filter((k) => !setBranches.has(k)));
      }
      for (const b of branches) {
        if (adj[b]) {
          adj[b] = new Set([...adj[b]].filter((k) => k !== mergedKey && !setBranches.has(k)));
        }
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
        for (const b of [...(adj[a] || new Set<string>())]) {
          if (!memberSet.has(b) || a >= b) continue;
          const ra = find(a),
            rb = find(b);
          if (ra === rb) {
            adj[a] = new Set([...adj[a]].filter((k) => k !== b));
            if (adj[b]) adj[b] = new Set([...adj[b]].filter((k) => k !== a));
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
        const tr = tramoPorClave.get(key);
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
        if (!tramoPorClave.has(k)) continue;
        const deg = adj[k]?.size || 0;
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
        for (const neighbor of adj[node] || new Set<string>()) {
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
