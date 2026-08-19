import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { calcUDparcial } from './componentHelpers';
import { pisoCorto } from '../constants';
import type { MemoriaTable, MemoriaHeaderGroup } from './exportMemoriaFinal';
import { diametroManning, caudalHunterLPS, factorSimultaneidad } from './calcSanitaryCore';
import { calcHydraulicCheck } from './hydraulicCheck';
import { DIAM_OPTIONS } from '../constants';
import { distToPolyline } from '../lib/shared/geometry';
import { parseDescargaEnId } from './parseDescargaEnId';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { DrawingData, RawElement } from './drawingSync';

interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
}

export interface MergedApBase {
  id: string;
  nombre: string;
  ud: number;
}

export interface SanConnectivity {
  orientedConexiones: Record<string, string[]>;
  displayMap: Record<string, string[]>;
  componentTotalMap: Record<string, number>;
}

// Fuente única de verdad del grafo de conectividad de la red sanitaria (qué tramo descarga en
// cuál, usado para acumular totales UD) — compartida entre la tabla DisenosSanitarios en
// pantalla y la exportación de Memorias Finales, así ambas siempre muestran los mismos números.
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
            const rxDownstreamPt = rx._tribReversed ? rx.pts[0] : rx.pts[rx.pts.length - 1];
            const touchesRxDischarge =
              Math.hypot(pt[0] - rxDownstreamPt[0], pt[1] - rxDownstreamPt[1]) < 2.0;
            const rxFin = rx.fin || tramoFinByKey.get(`${rx.id}-${plan.id}`) || '';
            if (touchesRxDischarge && !rxFin) continue;
            matches.push({ type: 'ramal' as const, id: rx.id });
          }
        }
        return matches;
      };

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
  // destino en calculoMap con >1 alimentador).
  if (Object.keys(mergeBranches).length === 0) {
    for (const [parentKey, children] of Object.entries(calculoMap)) {
      const parentTramo = byKey.get(parentKey);
      if (!parentTramo) continue;
      const tramoChildren = children.filter((c) => byKey.has(c));
      if (tramoChildren.length > 1) {
        mergeBranches[parentKey] = tramoChildren;
      }
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
  const ownTotals: Record<string, number> = { ...directedTotals };
  const mergePassCap = Object.keys(childrenMap).length;
  let fixedPointChanged = true;
  for (let pass = 0; pass <= mergePassCap && fixedPointChanged; pass++) {
    fixedPointChanged = false;
    for (const parentKey of Object.keys(childrenMap)) {
      const base = ownTotals[parentKey] ?? 0;
      const sum = childrenMap[parentKey].reduce((s, c) => s + (directedTotals[c] ?? 0), base);
      if (directedTotals[parentKey] !== sum) {
        directedTotals[parentKey] = sum;
        fixedPointChanged = true;
      }
    }
  }
  const componentTotalMap = directedTotals;

  // ownTotalMap usa el UD PARCIAL propio del ramal (no el total acumulado por BFS) para que
  // el override de merge sume parcial_propio + total_de_cada_alimentador sin contar doble —
  // el BFS ya acumula correctamente cuando el grafo no está podado, así que este override
  // actúa como red de seguridad y es un no-op en el caso normal.
  const ownTotalMap: Record<string, number> = {};
  for (const [key] of Object.entries(mergeBranches)) {
    const t = byKey.get(key);
    if (t) ownTotalMap[key] = calcUDparcial(t, mergedBase);
  }

  const mergeEntries = Object.entries(mergeBranches);
  for (let pass = 0; pass <= mergeEntries.length; pass++) {
    let changedAny = false;
    for (const [key, branches] of mergeEntries) {
      if (componentTotalMap[key] === undefined) continue;
      const next =
        (ownTotalMap[key] || 0) + branches.reduce((sum, b) => sum + (componentTotalMap[b] || 0), 0);
      if (next !== componentTotalMap[key]) {
        componentTotalMap[key] = next;
        changedAny = true;
      }
    }
    if (!changedAny) break;
  }
  const allBranchIds = new Set<string>();
  for (const branches of Object.values(mergeBranches)) {
    for (const b of branches) allBranchIds.add(b);
  }
  for (const branchId of allBranchIds) {
    if (mergeBranches[branchId]) continue;
    const t = tramosSan.find((x) => (x._key || x.id) === branchId);
    if (t) componentTotalMap[branchId] = calcUDparcial(t, mergedBase);
  }

  // Limpiar "Otros Ramales" para los orígenes de merge — conservan solo sus propios UD
  // y no muestran nada en la columna de conexiones (igual que el comportamiento AF/AC).
  for (const branchId of allBranchIds) {
    if (mergeBranches[branchId]) continue;
    if (displayMap[branchId]) displayMap[branchId] = [];
  }

  return { orientedConexiones, displayMap, componentTotalMap };
}

export interface SanRow {
  tKey: string;
  id: string;
  piso: number;
  udPropias: number;
  udAcum: number;
  nSalidas: number;
  K: number | null;
  Q: number | null;
  n: number;
  sVal: number;
  DcalcPulg: number;
  DdisPulg: number;
  DintMm: number;
  Qo: number;
  Vo: number;
  qqo: number;
  Vreal: number;
  chequeoV: string;
  Yc: number;
  Yn: number;
  Froude: number;
  tipoFlujo: string;
  Ymax: number;
  chequeoYn: string;
  fuerzaTractiva: number;
  chequeoFT: string;
}

// Fila de diseño hidráulico por-tramo — mismas fórmulas que la tabla DisenosSanitarios
// (estimación de diámetro de Manning + calcHydraulicCheck para el checkpoint completo),
// compartida con la exportación de memorias.
export function computeSanRows(
  displayTramos: Tramo[],
  componentTotalMap: Record<string, number>,
  mergedBase: MergedApBase[],
): SanRow[] {
  return displayTramos
    .toSorted((a, b) => (a.piso || 0) - (b.piso || 0))
    .map((t) => {
      const tKey = t._key || `${t.id}-${t.piso}`;
      const udPropias = calcUDparcial(t, mergedBase);
      const udAcum = componentTotalMap[tKey] || 0;

      const nSalidas = t.nSalidas ?? 0;
      const K =
        nSalidas != null && nSalidas > 0
          ? Math.round(factorSimultaneidad(nSalidas) * 100) / 100
          : null;
      const n = t.nmaning || 0.009;
      const sVal = t.sPercent ?? 0;
      const S = sVal != null && sVal > 0 ? sVal / 100 : null;
      const Q =
        udAcum > 0 && K != null ? Math.round(caudalHunterLPS(udAcum, K) * 1000) / 1000 : null;
      const dSel = DIAM_OPTIONS.find((d) => d.pulg === (t.diamDisPulg || 0)) || null;
      let DcalcPulg = 0;
      const DdisPulg = dSel ? dSel.pulg : 0;
      const DintMm = dSel ? dSel.mm : 0;
      let Qo = 0,
        Vo = 0,
        qqo = 0;
      let Vreal = 0,
        chequeoV = '—';
      let Yc = 0,
        Yn = 0,
        Froude = 0,
        tipoFlujo = '—',
        Ymax = 0,
        chequeoYn = '—';
      let fuerzaTractiva = 0,
        chequeoFT = '—';
      if (Q != null && Q > 0 && S != null && S > 0 && n != null && n > 0) {
        DcalcPulg = Math.round(((diametroManning(Q / 1000, n, S) * 1000) / 25.4) * 100) / 100;
      }
      if (Q != null && Q > 0 && S != null && S > 0 && n != null && n > 0 && DintMm > 0) {
        const hc = calcHydraulicCheck({ Q, S, n, DintMm });
        Qo = hc.Qo;
        Vo = hc.Vo;
        qqo = hc.qqo;
        Vreal = hc.Vreal;
        chequeoV = hc.chequeoV;
        Yc = hc.Yc;
        Yn = hc.Yn;
        Froude = hc.Froude;
        tipoFlujo = hc.tipoFlujo;
        Ymax = hc.Ymax;
        chequeoYn = hc.chequeoYn;
        fuerzaTractiva = hc.fuerzaTractiva;
        chequeoFT = hc.chequeoFT;
      }
      return {
        tKey,
        id: t.id,
        piso: t.piso,
        udPropias,
        udAcum,
        nSalidas,
        K,
        Q,
        n,
        sVal,
        DcalcPulg,
        DdisPulg,
        DintMm,
        Qo,
        Vo,
        qqo,
        Vreal,
        chequeoV,
        Yc,
        Yn,
        Froude,
        tipoFlujo,
        Ymax,
        chequeoYn,
        fuerzaTractiva,
        chequeoFT,
      };
    });
}

// Cálculo de unidades de descarga — mismo grafo de conectividad que computeSanRows, columnas
// distintas (conteos de aparato por tramo en vez del chequeo de diseño hidráulico).
export function computeUdTable(
  tramosSan: Tramo[],
  plans: PlanItem[],
  mergedBase: MergedApBase[],
): MemoriaTable | null {
  const displayTramos = tramosSan
    .filter((t) => t.tipo === 'ramal' && !t.esBajante)
    .toSorted((a, b) => (a.piso || 0) - (b.piso || 0));
  if (displayTramos.length === 0) return null;
  const { componentTotalMap } = buildSanConnectivity(tramosSan, plans, mergedBase);

  const headers = [
    'Tramo',
    'Nivel',
    'Inicio',
    'Fin',
    ...mergedBase.map((d) => `${d.nombre} (${d.ud} UD)`),
    'Parcial',
    'Total',
  ];
  const headerGroups: (string | MemoriaHeaderGroup)[] = [
    'Tramo',
    'Nivel',
    'Inicio',
    'Fin',
    { label: 'Aparatos', span: mergedBase.length },
    { label: 'Unidades de descarga', span: 2 },
  ];
  const rows = displayTramos.map((t) => {
    const tKey = t._key || `${t.id}-${t.piso}`;
    const parcial = calcUDparcial(t, mergedBase);
    const acum = componentTotalMap[tKey] || 0;
    const ini =
      t.ini && typeof t.ini === 'object'
        ? `${(t.ini as { x: number; y: number }).x},${(t.ini as { x: number; y: number }).y}`
        : t.ini || '—';
    const fin =
      t.fin && typeof t.fin === 'object'
        ? `${(t.fin as { x: number; y: number }).x},${(t.fin as { x: number; y: number }).y}`
        : t.fin || '—';
    return [
      t.id,
      pisoCorto(t.piso),
      ini,
      fin,
      ...mergedBase.map((d) => t.fixtures[d.id] ?? 0),
      parcial,
      acum,
    ];
  });

  // Fila de sumatoria — coincide con el tfoot de la tabla en pantalla: subtotal por-aparato
  // "cant × UD", más el total general de UD de toda la red.
  const totales = mergedBase.map((d) => {
    const cant = tramosSan.reduce((s, t) => s + (t.fixtures[d.id] || 0), 0);
    return { cant, ud: d.ud, subtotal: cant * d.ud };
  });
  const totalUD = totales.reduce((s, d) => s + d.subtotal, 0);
  rows.push(['Total', '', '', '', ...totales.map((d) => `${d.cant} × ${d.ud} UD`), '', totalUD]);

  return { title: 'Cálculo de unidades de descarga', headerGroups, headers, rows };
}
