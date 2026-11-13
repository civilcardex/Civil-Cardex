/**
 * Grafo de conectividad de la red desde los planos dibujados: enlaza cada ramal con el bajante o
 * ramal que lo alimenta (por distancia <2 px o recibeDeIds explícito), descubre las ramas de cada
 * unión de merge (mergesFrom + empalmes por coordenada) y poda las aristas que cerrarían ciclos
 * (union-find por cúmulo de extremos, sin desconectar a nadie).
 * Ej: RS1 dibujado con su extremo sobre la caja de M1 → arista 'M1-1'<->'RS1-1' en la adyacencia.
 */
import { leerDocDePlan } from '../readPlanDrawing';
import { distToPolyline } from '../../lib/shared/geometry';
import type { DrawingData, RawElement } from '../drawingSync.ts';
import { isLdesvioRamalId } from '../associateBajanteAcrossFloors';
import { indicePorId } from '../indices';
import { resolveJunctionEntrant } from '../flowDirection.ts';
import { tramoKeyOf } from '../keys.ts';
import type { Tramo } from '../../context/tramosReducer';
import type { PlanItem } from '../../context/PlansContext.tsx';
import type { BajanteRaw } from '../waterRowsShared.ts';

/** Construye la adyacencia (clave tramo/plano → vecinos) con las podas de merges y de ciclos. */
export function buildAdjacency(
  networkType: 'af' | 'ac',
  tramos: Tramo[],
  plans: PlanItem[],
): Record<string, Set<string>> {
  // ── Grafo de conectividad + árbol de presiones dirigido (espeja el useMemo de WaterNetworkDesign.tsx) ──
  // Set por clave: la pertenencia (¿ya enlazado?) era un .includes sobre un array que crece.
  const calculoMap = new Map<string, Set<string>>();
  const enlazar = (padre: string, hijo: string): void => {
    const set = calculoMap.get(padre) ?? new Set<string>();
    set.add(hijo);
    calculoMap.set(padre, set);
  };
  const bajanteNodes: Array<{ key: string; x: number; y: number; nivel: number }> = [];
  // Un ramal auto-creado en una unión T/Y (autoSplitJunctionAndSumFlow, PlanoEngineDrawing.ts)
  // lleva mergesFrom = [idA, idB] — pero eso solo registra el UN par que disparó la división a
  // mitad de cuerpo. Un tercer (o cuarto) ramal que termina en la coordenada exacta se une vía
  // empalme extremo-a-extremo simple y nunca entra a mergesFrom — y aun así su arista de
  // adyacencia por proximidad necesita cortarse de las OTRAS ramas en ese mismo punto, o su UC
  // se filtra a la rama con la que le toque el desempate. Así que el conjunto real de "ramas en
  // esta unión" se descubre por coordenada, no se lee solo de mergesFrom.
  const mergeBranches: Record<string, string[]> = {};
  // Cada extremo de ramal, etiquetado con su plano — usado abajo para encontrar uniones SIMPLES
  // (no-mergesFrom) donde 3+ ramales se juntan en una coordenada por dibujo extremo-a-extremo
  // ordinario. Espeja el cycle-pruning de WaterNetworkDesign.tsx — ver el comentario ahí para el
  // razonamiento completo.
  const ramalEndpoints: Array<{ key: string; x: number; y: number; planId: string }> = [];

  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const data = leerDocDePlan<DrawingData>(plan.id);
    if (!data) continue;

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
    // Índices del plano: id→ramal (el bucle de empalmes buscaba por id) y el set de
    // ramales que cada bajante recibe (el .includes dentro del bucle era O(n)).
    const ramalPorId = indicePorId(ramales, (r) => r.id);
    const recibePorBajante = new Map<string, Set<string>>();
    for (const b of bajantes) {
      if (b.id) recibePorBajante.set(b.id, new Set(b.recibeDeIds || []));
    }
    for (const r of ramales) {
      if (!r.mergesFrom || !r.pts || r.pts.length === 0) continue;
      // El ramal auto-creado siempre empieza exactamente en la coordenada de la unión
      // (autoSplitJunctionAndSumFlow: downstreamPts = [[ep[0],ep[1]], ...]).
      const jc = r.pts[0];
      // `r.mergesFrom` siempre es [existing.id, incoming.id] por construcción. Cuál de los tres
      // ramales de esta unión (existing, downstream=r, incoming) MUESTRA el total combinado se
      // decide puramente por la dirección de flujo actual — no fijo en "existing" ni en "el
      // auto-creado": junctionHasOutgoingFlow ya garantiza que al menos uno de los tres fluye
      // HACIA FUERA de jc, así que con tres ramales la división siempre es 2-contra-1, y el
      // disidente solitario (el que no coincide con los otros dos) es el entrante. Se recalcula
      // fresco desde el `_tribReversed` actual cada vez, así un "Invertir dirección de flujo" en
      // cualquiera de los tres cambia de inmediato cuál acumula.
      const [aId, bId] = r.mergesFrom;
      const existingObj = ramalPorId.get(aId);
      const incomingObj = ramalPorId.get(bId);
      const targetId = existingObj ? resolveJunctionEntrant(jc, existingObj, r, incomingObj) : aId;
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
          const recibe = b.id ? recibePorBajante.get(b.id) : undefined;
          const isExplicit = !!recibe && (recibe.has(r.id) || (!!r.label && recibe.has(r.label)));
          const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
          if (isExplicit) {
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
        if (bestRx) return { type: 'ramal' as const, id: bestRx.id };
        return null;
      };

      const connections = [checkEndpoint(pEnd), checkEndpoint(pStart)].filter(
        (c): c is { type: 'bajante' | 'ramal'; id: string } => c !== null,
      );

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        enlazar(targetKey, rKey);
      }
    }
  }

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
      enlazar(a, b);
    }
  }

  // Set por nodo: la adyacencia se consulta y se poda mucho (era .includes/.filter sobre
  // arrays — O(n²) al podar).
  const adj: Record<string, Set<string>> = {};
  for (const t of tramos) {
    const key = tramoKeyOf(t);
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
  // Cortar las aristas que un mergeOverride manejará explícitamente — si no, el árbol BFS general
  // de abajo haría además que el que de los dos ramales en merge esté más cerca de la raíz
  // doble el otro (y el ramal mergeado mismo) hacia ÉL, encima del override que fuerza el total
  // del ramal mergeado a su suma: la misma demanda se contaría doble, una vez en cada uno.
  // También cortar cualquier arista DIRECTA k1<->k2: en un punto de merge triple los extremos de
  // los tres ramales están en la coordenada exacta, así que el match por proximidad de arriba
  // puede resolver el vecino-más-cercano de un ramal origen hacia el OTRO origen en vez de hacia
  // el ramal mergeado (un empate de distancia roto por orden de array), dejando que el total de
  // un origen se filtre al otro.
  for (const [mergedKey, branches] of Object.entries(mergeBranches)) {
    const setBranches = new Set(branches);
    if (adj[mergedKey]) {
      adj[mergedKey] = new Set([...adj[mergedKey]].filter((k) => !setBranches.has(k)));
    }
    for (const b of branches) {
      if (adj[b])
        adj[b] = new Set([...adj[b]].filter((k) => k !== mergedKey && !setBranches.has(k)));
    }
  }

  // Uniones simples (no-mergesFrom) — espejan el cycle-pruning de WaterNetworkDesign.tsx, ver el
  // comentario ahí para el razonamiento completo. Agrupa cada extremo de ramal por coordenada
  // (solo mismo plano) y, dentro de cada cúmulo de 3+ vías, quita cualquier arista de adyacencia
  // que cerraría un ciclo (vía union-find), sin desconectar a nadie.
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

  return adj;
}
