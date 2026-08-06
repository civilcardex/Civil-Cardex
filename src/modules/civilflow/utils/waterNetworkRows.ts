import type { Tramo } from '../context/tramosReducer';
import type { PlanItem } from '../context/PlansContext';
import { AF_UC_IDS, AC_UC_IDS, APARATOS_DEF, matHazenC } from '../constants';
import { calcUCparcial } from './componentHelpers';
import { calcLeAcces } from './accesoriosUtils';
import { computeComponentTotals, computeDirectedTotals } from '../lib/shared/connectionGraph';
import { distToPolyline } from '../lib/shared/geometry';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import { loadFromStorage } from '../services/storageService';
import type { DrawingData, RawElement } from './drawingSync';
import { CONTADORES as CONTADORES_CAT } from '../pages/catalog/catalogData';
import { findContadorBajante } from './writeDiameterToDrawing';
import { isLdesvioRamalId } from './associateBajanteAcrossFloors';
import { resolveJunctionEntrant } from './flowDirection';

interface BajanteRaw extends RawElement {
  x?: number;
  y?: number;
}

const isAf = (t: string) => t === 'af';
const isContador = (s: string) => s.startsWith('CNT') || s.startsWith('cntAF');

const isAC1 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return true;
  if (isContador(fin) && !isContador(ini) && !ini.startsWith('M') && !ini.startsWith('B'))
    return true;
  return false;
};

const isAC2 = (t: Tramo) => {
  const ini = String(t.ini || '');
  const fin = String(t.fin || '');
  if (ini.startsWith('RP') || fin.startsWith('RP')) return false;
  if (isContador(ini)) return true;
  if (isContador(fin) && (ini.startsWith('M') || ini.startsWith('B'))) return true;
  return false;
};

// Misma transformación sigla → código que aplica PlanoEngineNetwork.ts al escribir la
// abreviatura de un fixture en el ini/fin de un ramal: "Duc:" -> "DUC".
const APARATO_PMAX_BY_CODE: Record<string, number> = Object.fromEntries(
  APARATOS_DEF.map((a) => [a.sigla.replace(':', '').trim().toUpperCase(), a.pmax]),
);
const HEATER_LOSS_FACTOR = 0.9;

export interface WnRow {
  id: string;
  ini: string;
  fin: string;
  piso: number;
  udPropia: number;
  udTotal: number;
  nDesc: number;
  K: number;
  Qprob: number;
  diamEst: number;
  diamDis: string;
  dInt: number;
  cHW: number;
  Vmms: number;
  Lh: number;
  Lv: number;
  Le: number;
  Lt: number;
  hfPct: number;
  hfM: number;
  Pin: number;
  Pfin: number;
}

// Versión snapshot del cálculo de filas propio de WaterNetworkDesign.tsx (grafo de conectividad,
// árbol de presiones dirigido, pérdidas Hazen-Williams) — usada por la tabla en pantalla vía
// estado vivo del componente (diámetros pendientes de guardar, ediciones manuales de presión) y,
// aquí, como función pura que usa solo lo ya persistido en los objetos Tramo, para que la
// exportación de memorias nunca dependa de que el usuario haya abierto esa pantalla primero.
export function computeWaterNetworkRows(
  networkType: 'af' | 'ac',
  tramosOwn: Tramo[],
  tramosAf: Tramo[],
  plans: PlanItem[],
  pRedStr: string,
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>,
  lookupFn: (pulg: number) => number,
): WnRow[] {
  const tramos = tramosOwn;
  const DIAM_OPTS = diamTable.map((d) => ({
    pulg: d.pulg,
    nominal: d.nominal,
    label: d.nominal,
    dInt: d.dInt,
  }));
  const ucIds = isAf(networkType) ? AF_UC_IDS : AC_UC_IDS;
  const ucField = isAf(networkType) ? 'uc_af' : 'uc_ac';
  const AP = ucIds
    .map((id) => {
      const a = APARATOS_DEF.find((x) => x.id === id);
      return a ? { id: a.id, uc: a[ucField as 'uc_af' | 'uc_ac'] } : null;
    })
    .filter((x): x is { id: string; uc: number } => x !== null);

  // ── Grafo de conectividad + árbol de presiones dirigido (espeja el useMemo de WaterNetworkDesign.tsx) ──
  const calculoMap: Record<string, string[]> = {};
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
      const existingObj = ramales.find((x) => x.id === aId);
      const incomingObj = ramales.find((x) => x.id === bId);
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
          const isExplicit =
            b.recibeDeIds &&
            (b.recibeDeIds.includes(r.id) || (r.label && b.recibeDeIds.includes(r.label)));
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
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
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
      if (!calculoMap[a]) calculoMap[a] = [];
      if (!calculoMap[a].includes(b)) calculoMap[a].push(b);
    }
  }

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
    adj[mergedKey] = (adj[mergedKey] || []).filter((k) => !branches.includes(k));
    for (const b of branches) {
      if (adj[b]) adj[b] = adj[b].filter((k) => k !== mergedKey && !branches.includes(k));
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

  // Probar ambas heurísticas de raíz sin importar el tipo de red (no solo "AF usa isAC2, AC usa
  // CALENT") — una red AC alimentada indirectamente, o cuyo tramo troncal no lleva literalmente
  // un código 'CALENT', antes no encontraba raíz aquí y caía silenciosamente a la suma no
  // dirigida de componente completa de computeComponentTotals (todo tramo mostrando el mismo
  // total general) sin ninguna indicación de que algo había salido mal.
  const rootT =
    tramos.find(isAC2) ||
    tramos.find(
      (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
    );
  let rootKey = rootT ? rootT._key || rootT.id : null;
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
      if (!tramos.some((t) => (t._key || t.id) === k)) continue;
      const deg = adj[k]?.length || 0;
      if (deg > bestDeg) {
        bestDeg = deg;
        bestKey = k;
      }
    }
    if (bestDeg > 0) rootKey = bestKey;
  }

  // Dirigido (enraizado en la fuente real de suministro), no la componente conectada no dirigida
  // completa — ver connectionGraph.ts. Una rama que alimenta un fixture debe mostrar solo SU
  // total acumulado propio, no la demanda de todo el edificio solo porque hidráulicamente sea
  // parte de la misma red.
  const componentTotalMap = computeDirectedTotals(
    tramos,
    (t) => t._key || t.id,
    adj,
    (t) => calcUCparcial(t, AP, 'uc'),
    rootKey,
  );
  // El entrante ahora puede ser el ramal auto-creado mismo (cuando su propia dirección de flujo
  // se invirtió respecto a `existing`) — y ese ramal puede cargar SUS PROPIOS fixtures directo,
  // no solo los totales de las ramas mergeadas. Hacer snapshot del total pre-override (propio,
  // basado en árbol) de cada destino ANTES de que el loop de abajo lo sobreescriba, para que el
  // override pueda SUMAR las ramas encima en vez de reemplazarlo — si no, un fixture asignado
  // directo al ramal entrante desaparecía silenciosamente de su total mostrado.
  const ownTotalMap: Record<string, number> = {};
  for (const [key] of Object.entries(mergeBranches)) {
    if (componentTotalMap[key] !== undefined) ownTotalMap[key] = componentTotalMap[key];
  }
  // Una cadena de merges (R1+R2→R5, luego R5+R3→R6) necesita que el override propio de R5 se
  // resuelva antes de que R6 lo lea como fuente — Object.entries() no garantiza procesar fuentes
  // antes que sus consumidores, así que un pase único podría leer un valor aún-no-overrideado
  // (todavía basado en árbol, equivocado) para una fuente que es ella misma un merge. Iterar a
  // un punto fijo en vez de un pase único.
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
  // Un ramal que ALIMENTA un merge (una rama en mergeBranches) nunca debe mostrar un total
  // distinto solo porque resulta ser un origen de merge — su total mostrado queda exactamente su
  // UC/UD propio, sin importar lo que el doblez del árbol dirigido haya recogido para él por
  // algún otro camino no cortado. Saltar ramas que son ellas mismas un destino de merge (cadenas
  // anidadas) — esas legítimamente conservan el valor sumado del loop de arriba, no su valor
  // crudo propio.
  const allBranchIds = new Set<string>();
  for (const branches of Object.values(mergeBranches)) {
    for (const b of branches) allBranchIds.add(b);
  }
  for (const branchId of allBranchIds) {
    if (mergeBranches[branchId]) continue;
    const t = tramos.find((x) => (x._key || x.id) === branchId);
    if (t) componentTotalMap[branchId] = calcUCparcial(t, AP, 'uc');
  }
  // Flujo probable (curva de Hunter, K·f(UC)) por tramo — para un ramal auto-creado en una unión
  // T/Y, `total` ya lee componentTotalMap[key], que se overrideó arriba (líneas 234-237) a la
  // suma del UC de las dos ramas en merge. Así que la fórmula de aquí corre sobre el total UC
  // correctamente combinado de cada tramo, mergeado o no — no hace falta override aparte.
  const qpropMap: Record<string, number> = {};
  for (const t of tramos) {
    const key = t._key || t.id;
    const nDesc = t.nSalidas || 0;
    const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
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

  const tramoKeySet = new Set(tramos.map((t) => t._key || t.id));
  const tramoParentOf: Record<string, string> = {};
  for (const t of tramos) {
    const key = t._key || t.id;
    let cur = nodeParentOf[key];
    while (cur && !tramoKeySet.has(cur)) cur = nodeParentOf[cur];
    if (cur) tramoParentOf[key] = cur;
  }

  const propiaMap: Record<string, number> = {};
  for (const t of tramos) {
    propiaMap[t._key || t.id] = calcUCparcial(t, AP, 'uc');
  }

  const pRed = parseFloat(pRedStr) || 20;
  const tramosOrden = tramos
    .filter((t) => t.tipo !== 'tributario' && !t.esBajante && !isAC1(t))
    .sort((a, b) => (b.piso || 0) - (a.piso || 0));

  // ── Acometida (solo AF) — mismos defaults con los que arranca el useState propio de WaterNetworkDesign.tsx ──
  const tr1 = isAf(networkType) ? tramos.find(isAC1) : null;
  const tr2 = isAf(networkType) ? tramos.find(isAC2) : null;
  const acoContMonDiam = 1.25;
  const acoL1Default = { h: 10.0, v: 0.0, le: 0.47 };
  const acoPini = 20.0;
  const acoLeMed = 0;

  const resolvedContMonDiam = (() => {
    if (tr2) {
      if (tr2.diametroOriginal) {
        const match = diamTable.find((o) => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find((o) => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const fallbackPulg = acoContMonDiam || 0.75;
    const match = diamTable.find((o) => Math.abs(o.pulg - fallbackPulg) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  })();
  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = (() => {
    if (tr1) {
      const opt = resolvedRedContDiam
        ? diamTable.find((d) => d.nominal === resolvedRedContDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr1.diamDisPulg || 0;
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0.0, le };
    }
    return acoL1Default;
  })();

  let ucTotal = 0;
  for (const t of tramos) ucTotal += propiaMap[t._key || t.id] || 0;

  const Qaco = (() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = tr2.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      if (total > 0 && K > 0) {
        return (
          Math.round(
            K *
              (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
              1000,
          ) / 1000
        );
      }
    }
    return ucTotal > 0 ? Math.round(0.1163 * Math.pow(ucTotal, 0.6875) * 1000) / 1000 : 0;
  })();

  const calcFila = (
    nominal: string,
    h: number,
    v: number,
    le: number,
    pIn: number,
    cHW: number,
  ) => {
    const opt = nominal ? diamTable.find((d) => d.nominal === nominal) : null;
    const dInt = opt ? opt.dInt : 0;
    const V =
      Qaco > 0 && dInt > 0
        ? Math.round(((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt)) * 10) / 10
        : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct =
      Math.round(
        ((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100,
      ) / 100;
    const hfM = Math.round((hfPct / 100) * Lt * 100) / 100;
    const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(
    resolvedRedContDiam || '',
    resolvedL1.h,
    resolvedL1.v,
    acoL1LeTotal,
    acoPini,
    cHW1,
  );

  // AC no tiene acometida propia — se alimenta del calentador de agua, que a su vez se alimenta
  // de la presión resuelta propia de AF en el nodo calentador compartido (persistida en el Tramo
  // de AF como `pFin`).
  const afHeaterPfin = isAf(networkType)
    ? null
    : (tramosAf.find(
        (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
      )?.pFin ?? null);

  const byKey = new Map(tramosOrden.map((t) => [t._key || t.id, t]));

  const pipeLoss = (t: Tramo) => {
    const ownKey = t._key || t.id;
    const isTr2Row = t === tr2;
    const Qprob = isTr2Row ? Qaco : qpropMap[ownKey] || 0;
    const disPulg = t.diamDisPulg || 0;
    const matchedOpt =
      (t.diametroOriginal
        ? DIAM_OPTS.find((o) => t.diametroOriginal?.startsWith(o.nominal))
        : undefined) || DIAM_OPTS.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
    const internoMm = matchedOpt ? matchedOpt.dInt : lookupFn(disPulg) || 0;
    const Vmms =
      Qprob > 0 && internoMm > 0
        ? Math.round(((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm)) * 10) / 10
        : 0;
    const H = t.totalL || t.Lh || 0;
    const Vvert = t.Lv != null ? Number(t.Lv) : t.deltaZ != null ? Number(t.deltaZ) : 0;
    const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
    const cHW = matHazenC(t.material || '') ?? 150;
    const Le = calcLeAcces(t.accesorios ?? {}, realPulg, cHW);
    const Lt = H + Vvert + Le;
    const hfPct =
      Vmms > 0 && cHW > 0 && internoMm > 0
        ? Math.round(
            ((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(internoMm, 1.167))) *
              100,
          ) / 100
        : 0;
    const hfM = Lt > 0 && hfPct > 0 ? Math.round(((Lt * hfPct) / 1000) * 100) / 100 : 0;
    return { Vvert, hfM };
  };

  const result: Record<string, { Pin: number; Pfin: number }> = {};
  const resolving = new Set<string>();
  const resolve = (key: string): { Pin: number; Pfin: number } => {
    if (result[key]) return result[key];
    if (resolving.has(key)) return { Pin: pRed, Pfin: pRed };
    resolving.add(key);
    const t = byKey.get(key);
    if (!t) {
      resolving.delete(key);
      return { Pin: pRed, Pfin: pRed };
    }

    let PinCalc: number;
    if (key === rootKey) {
      PinCalc = isAf(networkType)
        ? f1.Pfin
        : afHeaterPfin != null
          ? afHeaterPfin * HEATER_LOSS_FACTOR
          : pRed;
    } else {
      const fixturePmax = APARATO_PMAX_BY_CODE[String(t.ini || '').toUpperCase()];
      if (fixturePmax !== undefined) {
        PinCalc = fixturePmax;
      } else {
        const parentKey = tramoParentOf[key];
        PinCalc = parentKey ? resolve(parentKey).Pfin : pRed;
      }
    }

    const Pin = PinCalc;
    const { Vvert, hfM } = pipeLoss(t);
    const Pfin = Pin - Vvert - hfM;
    resolving.delete(key);
    result[key] = { Pin, Pfin };
    return result[key];
  };
  for (const t of tramosOrden) resolve(t._key || t.id);

  return tramosOrden.map((t) => {
    const ownKey = t._key || t.id;
    const propia = propiaMap[ownKey] || 0;
    const total = componentTotalMap[ownKey] || 0;
    const isTr2Row = t === tr2;
    const nDesc = t.nSalidas || 0;
    const K = nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
    const Qprob = isTr2Row ? Qaco : qpropMap[ownKey] || 0;
    const raizQ = Qprob > 0 ? Math.round(Math.sqrt(Qprob) * 100) / 100 : 0;
    const disPulg = t.diamDisPulg || 0;
    const matchedOpt =
      (t.diametroOriginal
        ? DIAM_OPTS.find((o) => t.diametroOriginal?.startsWith(o.nominal))
        : undefined) || DIAM_OPTS.find((o) => Math.abs(o.pulg - disPulg) < 0.01);
    const internoMm = matchedOpt ? matchedOpt.dInt : lookupFn(disPulg) || 0;
    const Vmms =
      Qprob > 0 && internoMm > 0
        ? Math.round(((1000000 * Qprob) / ((Math.PI / 4) * internoMm * internoMm)) * 10) / 10
        : 0;
    const H = t.totalL || t.Lh || 0;
    const Vvert = t.Lv != null ? Number(t.Lv) : t.deltaZ != null ? Number(t.deltaZ) : 0;
    const realPulg = matchedOpt ? matchedOpt.pulg : disPulg;
    const cHW = matHazenC(t.material || '') ?? 150;
    const Le = calcLeAcces(t.accesorios ?? {}, realPulg, cHW);
    const Lt = H + Vvert + Le;
    const hfPct =
      Vmms > 0 && cHW > 0 && internoMm > 0
        ? Math.round(
            ((60.1 * Math.pow(Vmms, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(internoMm, 1.167))) *
              100,
          ) / 100
        : 0;
    const hfM = Lt > 0 && hfPct > 0 ? Math.round(((Lt * hfPct) / 1000) * 100) / 100 : 0;
    const { Pin, Pfin } = result[ownKey] ?? { Pin: pRed, Pfin: pRed };
    return {
      id: t.id,
      ini: typeof t.ini === 'string' ? t.ini : '—',
      fin: typeof t.fin === 'string' ? t.fin : '—',
      piso: t.piso,
      udPropia: propia,
      udTotal: total,
      nDesc,
      K,
      Qprob,
      diamEst: raizQ,
      diamDis: matchedOpt?.nominal || '—',
      dInt: internoMm,
      cHW,
      Vmms,
      Lh: H,
      Lv: Vvert,
      Le,
      Lt,
      hfPct,
      hfM,
      Pin,
      Pfin,
    };
  });
}

// Demanda UC real de la red AC alimentada por un calentador, como la calcula la tabla de diseño —
// la pantalla de selección de calentador antes sumaba solo los fixtures del ramal stub sintético
// AC-01-{calId} (los aparatos asignados directo al calentador), lo que perdía todo fixture en los
// ramales AC reales aguas abajo. Reutiliza computeWaterNetworkRows con la misma heurística de raíz
// (isAC2 primero, luego cualquier tramo que toque un código CALENTn) para que el número coincida
// exactamente con el total de la tabla de diseño en el nodo del calentador. udTotal es 0 cuando
// aún no existe tramo de calentador.
export function computeHeaterNetworkTotal(
  tramosAc: Tramo[],
  plans: PlanItem[],
): { udTotal: number } {
  const rows = computeWaterNetworkRows('ac', tramosAc, [], plans, '20', [], () => 0);
  const root =
    tramosAc.find(isAC2) ||
    tramosAc.find(
      (t) => String(t.ini || '').startsWith('CALENT') || String(t.fin || '').startsWith('CALENT'),
    );
  const row = root
    ? rows.find(
        (r) =>
          r.id === root.id &&
          String(r.ini) === String(root.ini ?? '') &&
          String(r.fin) === String(root.fin ?? ''),
      )
    : null;
  return { udTotal: row?.udTotal ?? 0 };
}

export interface AcometidaSummary {
  tr1: {
    desde: string;
    hasta: string;
    h: number;
    le: number;
    diamEstimado: number;
    diamPropuesto: string;
  };
  tr2: {
    desde: string;
    hasta: string;
    h: number;
    le: number;
    diamEstimado: number;
    diamPropuesto: string;
  };
  Qaco: number;
  dInt1: number;
  dInt2: number;
  V1: number;
  V2: number;
  Lt1: number;
  Lt2: number;
  hfPct1: number;
  hfPct2: number;
  hfM1: number;
  hfM2: number;
  cHW1: number;
  cHW2: number;
  diamContador: string;
  Qn: number;
  p1Ini: number;
  p1Fin: number;
  p2Ini: number;
  p2Fin: number;
  hfContador: number;
  hfMax: number;
  diamConformeOk: boolean;
  diamDiff: number;
  pResidual: number;
  estadoOk: boolean;
}

function diamFractionValue(valStr: string): number {
  if (!valStr) return 0;
  if (valStr.includes('1/2')) return 0.5;
  if (valStr.includes('3/4')) return 0.75;
  if (valStr.includes('1 1/4')) return 1.25;
  if (valStr.includes('1 1/2')) return 1.5;
  const match = valStr.match(/(\d+)\/(\d+)/);
  if (match) return parseInt(match[1]) / parseInt(match[2]);
  const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}

// Espeja el cálculo del panel Acometida propio de WaterNetworkDesign.tsx (mismo grafo de
// conectividad que computeWaterNetworkRows de arriba, misma fórmula calcFila, mismos defaults de
// respaldo para el caso no-dibujado) como función pura — para que, como computeWaterNetworkRows,
// la exportación de memorias nunca dependa de que el usuario haya abierto esa pantalla. Devuelve
// null solo cuando ni AC-01 ni AC-02 se han dibujado en ningún plano AF (nada significativo que
// reportar aún).
export function computeAcometidaSummary(
  tramosAf: Tramo[],
  plans: PlanItem[],
  diamTable: Array<{ pulg: number; nominal: string; label?: string; dInt: number }>,
): AcometidaSummary | null {
  const networkType = 'af';
  const DIAM_OPTS = diamTable.map((d) => ({
    pulg: d.pulg,
    nominal: d.nominal,
    label: d.nominal,
    dInt: d.dInt,
  }));
  const AP = AF_UC_IDS.map((id) => {
    const a = APARATOS_DEF.find((x) => x.id === id);
    return a ? { id: a.id, uc: a.uc_af } : null;
  }).filter((x): x is { id: string; uc: number } => x !== null);

  const tramos = tramosAf;
  const tr1 = tramos.find(isAC1);
  const tr2 = tramos.find(isAC2);
  // Sin retorno temprano cuando ninguno está dibujado — el panel propio de SupplyConnection.tsx
  // tampoco se oculta nunca; solo cae a sus valores default de AC-01/AC-02 (los mismos defaults
  // usados abajo), así que la exportación debe mostrar lo mismo que vería la pantalla viva.

  // ── Grafo de conectividad (igual que computeWaterNetworkRows) — solo se necesita para Qaco vía el total de componente de tr2 ──
  const calculoMap: Record<string, string[]> = {};
  const bajanteNodes: Array<{ key: string; x: number; y: number; nivel: number }> = [];
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
    const ramales = (data.ramales || []).filter(
      (r) => r.net === networkType && !isLdesvioRamalId(r.id),
    );
    const bajantes = (data.bajantes || []).filter((b): b is BajanteRaw => b.net === networkType);
    for (const b of bajantes) {
      if (b.x == null || b.y == null) continue;
      bajanteNodes.push({ key: `${b.id}-${plan.id}`, x: b.x, y: b.y, nivel: plan.nivel });
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
            const otherPt = pt === pEnd ? pStart : pEnd;
            const otherDist = Math.hypot(otherPt[0] - b.x!, otherPt[1] - b.y!);
            if (dist < otherDist) return { type: 'bajante' as const, id: b.id };
            continue;
          }
          if (dist < 2.0) return { type: 'bajante' as const, id: b.id };
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
        if (!calculoMap[targetKey]) calculoMap[targetKey] = [];
        if (!calculoMap[targetKey].includes(rKey)) calculoMap[targetKey].push(rKey);
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
      if (!calculoMap[a]) calculoMap[a] = [];
      if (!calculoMap[a].includes(b)) calculoMap[a].push(b);
    }
  }
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
  const componentTotalMap = computeComponentTotals(
    tramos,
    (t) => t._key || t.id,
    adj,
    (t) => calcUCparcial(t, AP, 'uc'),
  );

  // ── Resolución específica de acometida (espeja las props de SupplyConnection.tsx exactamente) ──
  const resolvedMonName = (() => {
    if (tr2) {
      const iniStr = typeof tr2.ini === 'string' ? tr2.ini : '';
      const finStr = typeof tr2.fin === 'string' ? tr2.fin : '';
      if (isContador(iniStr)) return finStr || 'Mon';
      if (isContador(finStr)) return iniStr || 'Mon';
      return iniStr || finStr || 'Mon';
    }
    return 'Mon';
  })();
  const resolvedContMonDiam = (() => {
    if (tr2) {
      if (tr2.diametroOriginal) {
        const match = diamTable.find((o) => tr2.diametroOriginal?.startsWith(o.nominal));
        if (match) return match.nominal;
      }
      const match = diamTable.find((o) => Math.abs(o.pulg - (tr2.diamDisPulg ?? 0)) < 0.01);
      if (match) return match.nominal;
    }
    const match = diamTable.find((o) => Math.abs(o.pulg - 1.25) < 0.01);
    return match ? match.nominal : '3/4" RDE 11';
  })();
  const resolvedRedContDiam = resolvedContMonDiam;

  const resolvedL1 = (() => {
    if (tr1) {
      const opt = resolvedRedContDiam
        ? diamTable.find((d) => d.nominal === resolvedRedContDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr1.diamDisPulg || 0;
      const cHW = matHazenC(tr1.material || '') ?? 150;
      const le = calcLeAcces(tr1.accesorios ?? {}, realPulg, cHW);
      return { h: tr1.totalL || tr1.Lh || 0, v: 0, le };
    }
    return { h: 10.0, v: 0, le: 0.47 };
  })();
  const resolvedL2 = (() => {
    if (tr2) {
      const opt = resolvedContMonDiam
        ? diamTable.find((d) => d.nominal === resolvedContMonDiam)
        : null;
      const realPulg = opt ? opt.pulg : tr2.diamDisPulg || 0;
      const cHW = matHazenC(tr2.material || '') ?? 150;
      const le = calcLeAcces(tr2.accesorios ?? {}, realPulg, cHW);
      return { h: tr2.totalL || tr2.Lh || 0, v: 0, le };
    }
    return { h: 7.54, v: 0, le: 0 };
  })();

  let ucTotal = 0;
  for (const t of tramos) ucTotal += calcUCparcial(t, AP, 'uc');

  const Qaco = (() => {
    if (tr2) {
      const ownKey = tr2._key || tr2.id;
      const total = componentTotalMap[ownKey] || 0;
      const nDesc = tr2.nSalidas || 0;
      const K =
        nDesc > 0 ? Math.round((nDesc === 1 ? 1 : 1 / Math.sqrt(nDesc - 1)) * 100) / 100 : 0;
      if (total > 0 && K > 0) {
        return (
          Math.round(
            K *
              (total < 240 ? 0.1163 * Math.pow(total, 0.6875) : 0.074 * Math.pow(total, 0.7504)) *
              1000,
          ) / 1000
        );
      }
    }
    return ucTotal > 0 ? Math.round(0.1163 * Math.pow(ucTotal, 0.6875) * 1000) / 1000 : 0;
  })();

  const calcFila = (
    nominal: string,
    h: number,
    v: number,
    le: number,
    pIn: number,
    cHW: number,
  ) => {
    const opt = nominal ? diamTable.find((d) => d.nominal === nominal) : null;
    const dInt = opt ? opt.dInt : 0;
    const V =
      Qaco > 0 && dInt > 0
        ? Math.round(((1000000 * Qaco) / ((Math.PI / 4) * dInt * dInt)) * 10) / 10
        : 0;
    const Lt = (h || 0) + (v || 0) + (le || 0);
    const hfPct =
      Math.round(
        ((60.1 * Math.pow(V, 1.852)) / (Math.pow(cHW, 1.852) * Math.pow(dInt, 1.167))) * 100,
      ) / 100;
    const hfM = Math.round((hfPct / 100) * Lt * 100) / 100;
    const Pfin = +(pIn - (v || 0) - hfM).toFixed(2);
    return { dInt, V, Lt, hfPct, hfM, Pfin };
  };

  const cHW1 = matHazenC(tr1?.material || '') ?? 150;
  const cHW2 = matHazenC(tr2?.material || '') ?? 150;
  const acoPini = 20.0;
  const acoLeMed = 0;
  const acoL1LeTotal = resolvedL1.le + acoLeMed;
  const f1 = calcFila(
    resolvedRedContDiam || '',
    resolvedL1.h,
    resolvedL1.v,
    acoL1LeTotal,
    acoPini,
    cHW1,
  );
  const f2 = calcFila(
    resolvedContMonDiam || '',
    resolvedL2.h,
    resolvedL2.v,
    resolvedL2.le,
    f1.Pfin,
    cHW2,
  );

  // ── Selección de contador: dinámica desde el diámetro de un bajante, espejando WaterNetworkDesign.tsx ──
  let acoContIx = 2;
  const found = findContadorBajante(plans, networkType);
  if (found && found.bajante.dNominal) {
    const dNom = String(found.bajante.dNominal).replace('½', '1/2').replace('¾', '3/4');
    const idx = CONTADORES_CAT.findIndex((c) => `${c.dn}"` === dNom);
    if (idx !== -1) acoContIx = idx;
  }
  const contadorSel = CONTADORES_CAT[acoContIx] || CONTADORES_CAT[0];
  const hfContador =
    Qaco > 0 && contadorSel.q > 0
      ? Math.round(10 * Math.pow(Qaco / contadorSel.q, 2) * 100) / 100
      : 0;
  const acoHfMax = 5.0;
  const pResidual = +(f1.Pfin - f2.Pfin).toFixed(2);
  const okPresion = f1.Pfin > f2.Pfin;

  const diamPropuesto1 =
    DIAM_OPTS.find((o) => o.nominal === resolvedRedContDiam)?.label || resolvedRedContDiam || '';
  const diamPropuesto2 =
    DIAM_OPTS.find((o) => o.nominal === resolvedContMonDiam)?.label || resolvedContMonDiam || '';
  const dValAco = diamFractionValue(resolvedRedContDiam || '');
  const dValCont = diamFractionValue(contadorSel.dn || '0');
  const diamDiff = dValAco - dValCont;
  const diamConformeOk = diamDiff <= 0.5;

  return {
    tr1: {
      desde: 'Red Pública',
      hasta: 'Contador',
      h: resolvedL1.h,
      le: acoL1LeTotal,
      diamEstimado: Qaco > 0 ? Math.sqrt(Qaco) : 0,
      diamPropuesto: diamPropuesto1,
    },
    tr2: {
      desde: 'Contador',
      hasta: resolvedMonName || '—',
      h: resolvedL2.h,
      le: resolvedL2.le,
      diamEstimado: Qaco > 0 ? Math.sqrt(Qaco) : 0,
      diamPropuesto: diamPropuesto2,
    },
    Qaco,
    dInt1: f1.dInt,
    dInt2: f2.dInt,
    V1: f1.V,
    V2: f2.V,
    Lt1: f1.Lt,
    Lt2: f2.Lt,
    hfPct1: f1.hfPct,
    hfPct2: f2.hfPct,
    hfM1: f1.hfM,
    hfM2: f2.hfM,
    cHW1,
    cHW2,
    diamContador: contadorSel.dn || '—',
    Qn: contadorSel.q || 0,
    p1Ini: acoPini,
    p1Fin: f1.Pfin,
    p2Ini: f1.Pfin,
    p2Fin: f2.Pfin,
    hfContador,
    hfMax: acoHfMax,
    diamConformeOk,
    diamDiff,
    pResidual,
    estadoOk: okPresion && hfContador <= acoHfMax,
  };
}
