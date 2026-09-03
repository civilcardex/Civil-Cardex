import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { calcUDparcial } from './componentHelpers';
import { distToPolyline } from '../lib/shared/geometry';
import { parseDescargaEnId } from './parseDescargaEnId';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { DrawingData, RawElement } from './drawingSync';

/** Bajante crudo leído del storage, con posición en planta para enlazar pisos. */
export interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
}

/** Base de aparatos fusionada por tramo (conteos por código), entrada de las tablas sanitarias. */
export interface MergedApBase {
  id: string;
  nombre: string;
  ud: number;
}

/** Grafo de conectividad sanitario: vecinos por tramo, aparatos fusionados y trazos por plano. */
export interface SanConnectivity {
  orientedConexiones: Record<string, string[]>;
  displayMap: Record<string, string[]>;
  componentTotalMap: Record<string, number>;
  fullChildrenMap: Record<string, string[]>;
}

/**
 * Construye el grafo de conectividad sanitaria (qué tramo descarga en cuál) para acumular totales UD.
 * Fuente única usada por tabla en pantalla y exportación de memorias — garantiza mismos números.
 * @param tramosSan - Tramos de red sanitaria ya mapeados.
 * @param plans - Planos confirmados con `nivel` para leer trazos crudos.
 * @param mergedBase - Bases de aparatos para resolver desempates de co-sumideros.
 * @returns Mapas orientados, de display y totales por componente.
 */
export function buildSanConnectivity(
  tramosSan: Tramo[],
  plans: PlanItem[],
  mergedBase: MergedApBase[],
): SanConnectivity {
  const calculoMap: Record<string, string[]> = {};

  // fin (código del elemento aguas abajo) vive en tramosSan; el trazo crudo de localStorage puede
  // no tenerlo persistido (el test lo define solo en el tramo). Se resuelve con el tramo por
  // `${id}-${planId}` para el desempate de co-sumideros de abajo.
  const tramoFinByKey = new Map<string, string>();
  for (const t of tramosSan) {
    const k = t._key || `${t.id}-${t.piso}`;
    if (typeof t.fin === 'string' && t.fin) tramoFinByKey.set(k, t.fin);
  }

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

    const ramales = data.ramales || [];
    const bajantes = (data.bajantes || []) as BajanteRaw[];

    // Los dos ramales origen de una división de unión a mitad de cuerpo (mergesFrom) terminan
    // ambos con un extremo en la coordenada exacta del inicio del ramal auto-creado — así que la
    // búsqueda por proximidad de abajo también los enlazaría directo entre sí (una arista
    // espuria), además de enlazar cada uno correctamente al ramal auto-creado. Esa arista espuria
    // deja que el UD de un origen se filtre al subárbol BFS del otro, y la corrección
    // mergeBranches más abajo lo cuenta doble cuando fuerza la suma del total del ramal
    // auto-creado desde ambos orígenes. Dos ramales que son los dos alimentadores del MISMO merge
    // nunca deben enlazarse directo.
    const mergeSiblingPairs = new Set<string>();
    for (const rr of ramales) {
      if (rr.mergesFrom) {
        mergeSiblingPairs.add(rr.mergesFrom.toSorted().join('|'));
      }
    }

    for (const r of ramales) {
      if (!r.pts || r.pts.length < 2) continue;
      if (isLdesvioRamalId(r.id)) continue;
      const pStart = r.pts[0];
      const pEnd = r.pts[r.pts.length - 1];
      const rKey = `${r.id}-${plan.id}`;

      // Devuelve TODOS los ramales que tocan pt (no solo el más cercano) — una unión donde un
      // tributario se une a mitad de cuerpo de un ramal existente deja TANTO el punto de corte
      // del ramal existente truncado COMO el extremo propio del tributario en la coordenada
      // exacta del inicio del ramal auto-creado aguas abajo. Elegir solo el más cercano
      // (comportamiento viejo, empates resueltos por orden de array) soltaba silenciosamente uno
      // de los dos padres del grafo de conectividad, subestimando el UD acumulado del ramal
      // auto-creado.
      const checkEndpoint = (pt: number[]) => {
        for (const b of bajantes) {
          const isDischargingIntoR =
            b.descargaEnId &&
            (b.descargaEnId === `${plan.id}|${r.id}` ||
              b.descargaEnId === r.id ||
              (r.label &&
                (b.descargaEnId === `${plan.id}|${r.label}` || b.descargaEnId === r.label)));
          if (isDischargingIntoR) continue;

          const isExplicit =
            b.recibeDeIds &&
            (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
          const dist = Math.hypot(pt[0] - b.x!, pt[1] - b.y!);
          if (isExplicit) {
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
            if (dist < otherDist) return [{ type: 'bajante' as const, id: b.id }];
            continue;
          }
          // Un bajante de SUBIDA no es un drenaje geométrico — el agua sube por él, no
          // descarga ahí. Solo los bajantes 'baja' (o sin dirección definida) cuentan como
          // drenaje para la propagación de UD.
          if (b.direccion === 'sube') continue;
          if (dist < 2.0) {
            return [{ type: 'bajante' as const, id: b.id }];
          }
        }
        const matches: { type: 'ramal'; id: string }[] = [];
        for (const rx of ramales) {
          if (rx.id === r.id) continue;
          if (!rx.pts || rx.pts.length < 2) continue;
          if (mergeSiblingPairs.has([r.id, rx.id].sort().join('|'))) continue;
          const dist = distToPolyline(pt, rx.pts);
          if (dist < 2.0) {
            // Desempate de co-sumideros: si el punto de descarga de `r` coincide con el extremo
            // de DESCARGA de rx (el propio rx también descarga en la misma coordenada, p. ej. un
            // ramal invertido y otro normal encontrándose en un punto), enlazarlos en ambas
            // direcciones formaría un ciclo que diverge el punto fijo (y sobrecuenta el UD). El
            // ramal con `fin` (continúa a otro elemento, p. ej. un bajante) es la continuación y
            // sí recibe; un co-sumidero sin `fin` es un extremo muerto — no puede recibir.
            // El orden de dibujo (la flecha) es la fuente de verdad del flujo; `_tribReversed`
            // solo lo invierte cuando el motor lo fijó explícitamente. Una heurística de
            // "bajante más cercano" volteaba ramales bien dibujados y rompía el enlace
            // aguas abajo (RS5→RS3 perdía las UDs de RS5).
            const rxDownstreamPt = rx._tribReversed ? rx.pts[0] : rx.pts[rx.pts.length - 1];
            const touchesRxDischarge =
              Math.hypot(pt[0] - rxDownstreamPt[0], pt[1] - rxDownstreamPt[1]) < 2.0;
            const rxFin = rx.fin || tramoFinByKey.get(`${rx.id}-${plan.id}`) || '';
            if (touchesRxDischarge) {
              // Co-sumideros: un ramal que TAMBIÉN descarga en este punto solo puede recibir si
              // su `fin` continúa a un elemento FUERA del punto (p. ej. un bajante). Si no tiene
              // `fin` es un extremo muerto, y si su `fin` referencia a OTRO ramal que toca este
              // mismo punto (conexión tipeada por el usuario) es igual un sumidero aquí — dejarlo
              // recibir formaría un ciclo (RS1↔RS4) que infla o rompe la propagación.
              const finIsRamalAtPt =
                !!rxFin &&
                ramales.some(
                  (o) =>
                    (o.id === rxFin || (o.label && o.label === rxFin)) &&
                    o.pts &&
                    o.pts.length >= 2 &&
                    distToPolyline(pt, o.pts) < 2.0,
                );
              if (!rxFin || finIsRamalAtPt) continue;
            }
            matches.push({ type: 'ramal' as const, id: rx.id });
          }
        }
        return matches;
      };

      // El orden de dibujo (la flecha) es la fuente de verdad del flujo; `_tribReversed` solo lo
      // invierte cuando el motor lo fijó explícitamente.
      const downstreamPt = r._tribReversed ? pStart : pEnd;
      const connections = checkEndpoint(downstreamPt);

      for (const connection of connections) {
        const targetKey = `${connection.id}-${plan.id}`;
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) {
          calculoMap[targetKey].push(rKey);
        }
      }
    }
  }

  const bajantesGroups: Record<string, typeof tramosSan> = {};
  for (const t of tramosSan) {
    if (t.esBajante && t.id) {
      if (!bajantesGroups[t.id]) bajantesGroups[t.id] = [];
      bajantesGroups[t.id].push(t);
    }
  }

  for (const sections of Object.values(bajantesGroups)) {
    sections.sort((a, b) => (a.piso || 0) - (b.piso || 0));
    for (let i = 0; i < sections.length - 1; i++) {
      const lowerKey = sections[i]._key;
      const upperKey = sections[i + 1]._key;
      if (lowerKey && upperKey) {
        if (!calculoMap[lowerKey]) calculoMap[lowerKey] = [];
        if (!calculoMap[lowerKey].includes(upperKey)) {
          calculoMap[lowerKey].push(upperKey);
        }
      }
    }
  }

  for (const t of tramosSan) {
    if (t.esBajante && t.descargaEnId && t._key) {
      const parts = parseDescargaEnId(t.descargaEnId, '');
      const dPlanId = parts[0];
      const targetRamalId = parts[1];
      if (targetRamalId) {
        const targetKey = `${targetRamalId}-${dPlanId}`;
        const targetExists = tramosSan.some((x) => x._key === targetKey);
        if (targetExists) {
          if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
          if (!calculoMap[targetKey].includes(t._key)) {
            calculoMap[targetKey].push(t._key);
          }
        }
      }
    }
  }

  const adj: Record<string, string[]> = {};
  for (const t of tramosSan) {
    if (t._key) {
      adj[t._key] = [];
    }
  }

  for (const [parentKey, children] of Object.entries(calculoMap)) {
    if (!adj[parentKey]) adj[parentKey] = [];
    for (const childKey of children) {
      if (!adj[childKey]) adj[childKey] = [];
      if (!adj[parentKey].includes(childKey)) adj[parentKey].push(childKey);
      if (!adj[childKey].includes(parentKey)) adj[childKey].push(parentKey);
    }
  }

  const getConnectedNeighbors = (startKey: string): string[] => {
    const results = new Set<string>();
    const visited = new Set<string>();
    const queue = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node !== startKey) {
        const tr = tramosSan.find((x) => x._key === node);
        const isMainRamal = tr && tr.tipo === 'ramal' && !tr.esBajante;
        if (isMainRamal) {
          results.add(node);
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
  for (const t of tramosSan) {
    if (t._key && t.tipo === 'ramal' && !t.esBajante) {
      displayMap[t._key] = getConnectedNeighbors(t._key);
    }
  }

  const compVisited = new Set<string>();
  const components: string[][] = [];

  for (const node of Object.keys(adj)) {
    if (!compVisited.has(node)) {
      const comp: string[] = [];
      const q = [node];
      compVisited.add(node);
      while (q.length > 0) {
        const curr = q.shift()!;
        comp.push(curr);
        for (const neigh of adj[curr] || []) {
          if (!compVisited.has(neigh)) {
            compVisited.add(neigh);
            q.push(neigh);
          }
        }
      }
      components.push(comp);
    }
  }

  const getRootScore = (key: string): number => {
    const tr = tramosSan.find((x) => x._key === key);
    if (!tr) return 99999999;
    const piso = tr.piso || 0;
    const isBajante = tr.esBajante;
    const id = tr.id || '';
    const match = id.match(/^([a-zA-Z]+)(\d+)?$/);
    const num = match && match[2] ? parseInt(match[2]) : 999;
    return piso * 100000 + (isBajante ? 0 : 10000) + num;
  };

  const orientedConexiones: Record<string, string[]> = {};
  const orientedVisited = new Set<string>();

  for (const comp of components) {
    let root = comp[0];
    let minScore = getRootScore(root);
    for (const node of comp) {
      const score = getRootScore(node);
      if (score < minScore) {
        minScore = score;
        root = node;
      }
    }

    const q = [root];
    orientedVisited.add(root);
    while (q.length > 0) {
      const parent = q.shift()!;
      if (!orientedConexiones[parent]) orientedConexiones[parent] = [];
      for (const child of adj[parent] || []) {
        if (!orientedVisited.has(child)) {
          orientedVisited.add(child);
          orientedConexiones[parent].push(child);
          q.push(child);
        }
      }
    }
  }

  // Corrección de ramas de merge (igual que AF/AC): los puntos de merge acumulan los UD de los
  // alimentadores.
  // Preferir mergesFrom de los datos crudos; caer a la detección por grafo de conectividad.
  const keyOf = (t: Tramo) => t._key || t.id;
  const byKey = new Map(tramosSan.map((t) => [keyOf(t), t]));
  const mergeBranches: Record<string, string[]> = {};
  for (const plan of plans || []) {
    if (plan.nivel == null) continue;
    const raw = loadFromStorage<{ ramales?: RawElement[] } | string | null>(
      TRAZOS_PREFIX + plan.id,
      null,
    );
    if (!raw) continue;
    const data: { ramales?: RawElement[] } = typeof raw === 'string' ? JSON.parse(raw) : raw;
    for (const r of data.ramales || []) {
      if (!r.mergesFrom || !r.pts || r.pts.length === 0) continue;
      const mergedKeyFull = `${r.id}-${plan.id}`;
      const jc = r.pts[0];
      // `r.mergesFrom` ya registra EXACTAMENTE qué dos ramales crearon esta unión
      // (autoSplitJunctionAndSumFlow) — confiar en esos dos directo en vez de re-derivar la lista
      // completa de ramas solo por proximidad de coordenadas.
      const branchSet = new Set<string>(r.mergesFrom.map((id) => `${id}-${plan.id}`));
      for (const other of data.ramales || []) {
        if (other.id === r.id || !other.pts || other.pts.length < 2) continue;
        const otherKey = `${other.id}-${plan.id}`;
        if (branchSet.has(otherKey)) continue;
        const oStart = other.pts[0],
          oEnd = other.pts[other.pts.length - 1];
        const touchesJc =
          Math.hypot(oStart[0] - jc[0], oStart[1] - jc[1]) < 2.0 ||
          Math.hypot(oEnd[0] - jc[0], oEnd[1] - jc[1]) < 2.0;
        if (!touchesJc) continue;
        const originPt = other._tribReversed ? oEnd : oStart;
        const originsAtJc = Math.hypot(originPt[0] - jc[0], originPt[1] - jc[1]) < 2.0;
        if (originsAtJc) continue;
        branchSet.add(otherKey);
      }
      mergeBranches[mergedKeyFull] = Array.from(branchSet);
    }
  }

  // Respaldo: detectar puntos de merge desde el grafo de conectividad (tramo que aparece como
  // destino en calculoMap con >1 alimentador). Debe correr SIEMPRE para merges de extremo
  // (RS5→RS3 en imagen) donde el motor NO crea mergesFrom (solo cuerpo-medio lo crea); antes
  // solo corría si cero merges existían, entonces RS3 sin mergesFrom quedaba sin entrada y
  // dependía 100% de la geometría dirigida — si esa fallaba por 2px, RS3 perdía RS5.
  for (const [parentKey, children] of Object.entries(calculoMap)) {
    if (mergeBranches[parentKey]) continue;
    const parentTramo = byKey.get(parentKey);
    if (!parentTramo) continue;
    const tramoChildren = children.filter((c) => byKey.has(c));
    if (tramoChildren.length > 1) {
      mergeBranches[parentKey] = tramoChildren;
    }
  }

  // Propagación de UD DIRIGIDA por dirección de flujo: cada tramo acumula su UD parcial + el
  // total de todos los tramos que le ENTREGAN (aguas arriba). El extremo aguas abajo de cada
  // ramal ya se resolvió por dirección de flujo (`_tribReversed` XOR orden de pts) en
  // checkEndpoint, así que `calculoMap` es un grafo DIRIGIDO (hijo → padre, padre = aguas
  // abajo). No se elige una raíz única: cada ramal drena hacia SU bajante, y una red con varios
  // bajantes (típico en sanitaria — uno por grupo de aparatos) no debe enrutar todas sus ramas
  // hacia una sola raíz. El modelo anterior de BFS desde una raíz única inflaba las ramas
  // alejadas con el UD de toda la red cuando el código del bajante no aparecía en ini/fin, o
  // enrutaba ramas de un segundo bajante hacia el bajante equivocado.
  const directedTotals: Record<string, number> = {};
  for (const t of tramosSan) {
    const k = keyOf(t);
    if (k) directedTotals[k] = calcUDparcial(t, mergedBase);
  }
  // Nodos de unión sin fila propia (bajantes inter-piso, nodos de cruce) también acumulan, para
  // propagar el total de una rama completa al tramo aguas abajo que la recibe.
  const childrenMap: Record<string, string[]> = {};
  for (const [parentKey, children] of Object.entries(calculoMap)) {
    childrenMap[parentKey] = children.filter((c, i) => children.indexOf(c) === i);
  }
  // Punto fijo: cada tramo acumula SU UD parcial + el total de los tramos que le entregan.
  // La base es el UD PROPIO (fijo, calcUDparcial), NO el total en evolución del tramo — usar el
  // total en evolución re-agrega a los hijos en cada pasada (padre = own + hijo, pasada 2 =
  // padre + own + hijo de nuevo) e infla cualquier unión simple tributario→tronco. Con base
  // propia el DAG converge exacto en ≤ profundidad pasadas; un ciclo (dos ramales descargando
  // en el mismo punto) se propaga una vez por pasada y termina acotado por `mergePassCap` en
  // vez de divergir infinito (el desempate de co-sumideros en checkEndpoint evita que ese ciclo
  // se forme).
  // Cálculo de totales sin doble conteo: cada UD propia se cuenta una sola vez aunque el
  // grafo tenga diamante (RS1→RS5 y RS1→RS3 directo, o RS1→RS5→RS3 + RS1→RS3). Antes
  // `own + Σ child_total` duplicaba RS1 (una vez vía RS5 y otra directa). Ahora cada total
  // es `propia + Σ propias de descendientes únicos (transitivo, dedup por visited)`.
  const ownTotals: Record<string, number> = { ...directedTotals };
  // Grafo completo para totales: unión de hijos geométricos + ramas de merge (mergesFrom)
  const fullChildrenMap: Record<string, string[]> = {};
  for (const k of new Set([...Object.keys(childrenMap), ...Object.keys(mergeBranches)])) {
    const s = new Set<string>([...(childrenMap[k] || []), ...(mergeBranches[k] || [])]);
    fullChildrenMap[k] = Array.from(s);
  }
  // Cross-floor: bajante descargaEnId → target bajante/ramal asegura que el piso inferior
  // herede las UD/UC del superior, tanto si hay fantasma+Ldesvio como si es alineado (sin Ldesvio).
  // Sin esto, el tramosSan del piso inferior quedaba con UD propias 0 aunque sus ramales
  // tributarios estuvieran en otro piso (phantom no propagaba).
  for (const t of tramosSan) {
    if (!t.esBajante || !t.descargaEnId || !t._key) continue;
    const [dPlanId, tgtId] = parseDescargaEnId(t.descargaEnId, '');
    if (!tgtId || dPlanId == null) continue;
    const tgtKey = `${tgtId}-${dPlanId}`;
    // solo si el target existe como tramo (bajante inferior)
    if (
      !byKey.has(tgtKey) &&
      !Object.prototype.hasOwnProperty.call(fullChildrenMap, tgtKey) &&
      !Object.keys(ownTotals).includes(tgtKey)
    )
      continue;
    if (!fullChildrenMap[tgtKey]) fullChildrenMap[tgtKey] = [];
    if (!fullChildrenMap[tgtKey].includes(t._key)) fullChildrenMap[tgtKey].push(t._key);
  }
  const componentTotalMap: Record<string, number> = {};
  // Para cada nodo, BFS/DFS sobre fullChildrenMap con visited para no duplicar hojas compartidas
  const allKeysForTotals = new Set<string>([
    ...Object.keys(ownTotals),
    ...Object.keys(fullChildrenMap),
  ]);
  for (const k of allKeysForTotals) {
    if (ownTotals[k] === undefined && !fullChildrenMap[k]) continue;
    // visited arranca con la raíz: un ciclo que vuelva a k no debe volver a contar su propia UD.
    const visited = new Set<string>([k]);
    const stack = [...(fullChildrenMap[k] || [])];
    let sum = ownTotals[k] ?? 0;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      sum += ownTotals[cur] ?? 0;
      for (const child of fullChildrenMap[cur] || []) {
        if (!visited.has(child)) stack.push(child);
      }
    }
    componentTotalMap[k] = sum;
  }
  // Asegurar que todo nodo con propia tenga entrada (hojas sin hijos)
  for (const [k, v] of Object.entries(ownTotals)) {
    if (componentTotalMap[k] === undefined) componentTotalMap[k] = v;
  }
  const allBranchIds = new Set<string>();
  for (const branches of Object.values(mergeBranches)) {
    for (const b of branches) allBranchIds.add(b);
  }
  // Un ramal que ALIMENTA un merge (una rama en mergeBranches) nunca debe mostrar un total
  // inflado por el doblez del árbol hacia él — pero TAMPOCO debe perder su autosuma legítima:
  // si la rama recibe UDs de sus propios alimentadores (RS6 = RS1+TIRS1, ramal manual sin
  // mergesFrom), su total acumulado debe conservarse completo para propagarse aguas abajo.
  // Solo se resetean las ramas HOJA (sin alimentadores propios): su total mostrado es
  // exactamente su UD propio, sin importar lo que el árbol dirigido haya recogido para ellas.
  for (const branchId of allBranchIds) {
    if (mergeBranches[branchId]) continue;
    if ((childrenMap[branchId] || []).length > 0) continue;
    const t = tramosSan.find((x) => (x._key || x.id) === branchId);
    if (t) componentTotalMap[branchId] = calcUDparcial(t, mergedBase);
  }

  // OTROS debe mostrar SOLO ramales inmediatamente conectados (hijos directos), no toda la
  // componente transitiva. Antes usaba BFS sobre adj y mostraba RS1 RS3 RS4 RS5 juntos aunque
  // RS3 no descarga directo en ese tramo. Sobrescribe displayMap con hijos inmediatos.
  // Un hijo ya contenido transitivamente en OTRO hijo del mismo padre es redundante para la
  // columna OTROS: su UD ya se cuenta vía ese otro hijo (p. ej. RS1 alimenta a RS5, y una
  // arista espuria RS1→RS3 por proximidad haría que RS3 listara RS1 además de RS5). Mostrarlo
  // duplica el ramal en la columna y confunde el total (el usuario exige: RS3 OTROS = RS5 RS2).
  const isDescendantOf = (node: string, ancestor: string): boolean => {
    const stack = [...(fullChildrenMap[ancestor] || [])];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (cur === node) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const child of fullChildrenMap[cur] || []) {
        if (!seen.has(child)) stack.push(child);
      }
    }
    return false;
  };
  for (const t of tramosSan) {
    if (!t._key) continue;
    const isHost = t.esBajante || t.tipo === 'ramal' || t.tipo === 'tributario';
    if (!isHost) continue;
    const immediate = new Set<string>([
      ...(childrenMap[t._key] || []),
      ...(mergeBranches[t._key] || []),
    ]);
    // Columna de conexiones: SOLO ramales entre sí — los tributarios asociados no se listan
    // (su UD ya se acumula aguas arriba vía componentTotalMap/fullChildrenMap).
    const ramalKids = Array.from(immediate).filter((k) => {
      const tr = byKey.get(k);
      return !!tr && !tr.esBajante && tr.tipo === 'ramal';
    });
    const filtered = ramalKids.filter((k) => {
      for (const other of ramalKids) {
        if (other !== k && isDescendantOf(k, other)) return false;
      }
      return true;
    });
    displayMap[t._key] = filtered;
  }

  // Limpiar "Otros Ramales" para los orígenes de merge — conservan solo sus propios UD
  // y no muestran nada en la columna de conexiones (igual que el comportamiento AF/AC).
  for (const branchId of allBranchIds) {
    if (mergeBranches[branchId]) continue;
    if (displayMap[branchId]) displayMap[branchId] = [];
  }

  return { orientedConexiones, displayMap, componentTotalMap, fullChildrenMap };
}
