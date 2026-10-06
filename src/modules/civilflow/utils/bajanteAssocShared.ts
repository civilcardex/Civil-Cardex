import type { SyncPlanInput } from './drawingSync';
import {
  isLdesvioRamalId,
  hasCachedPlan,
  loadData,
  saveData,
  type LocalGhostDrawingData,
} from './associateBajanteAcrossFloors';
import { origenDePlan } from './crossFloorStorage';
import { devError } from '../../../utils/devError';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import { TRAZOS_PREFIX } from '../constants/storage-keys';
import type { IPlanoEngineCore } from '../lib/PlanoEngine/PlanoState';
export interface StoredBajanteDesp {
  id: string;
  desplazamientos?: Record<string, { dx: number; dy: number; Ldesvio?: string }>;
  ghostData?: Record<string, { direccion?: string; labelX?: number; labelY?: number }>;
}

// Mismo bookkeeping de "fantasma desplazado de sí mismo" que applyBajanteAssociation/
// clearBajanteAssociation hacen en el engine EN VIVO cuando el piso propio del source resulta
// estar cargado — espejado aquí para cuando NO lo está (el flujo "Origen" siempre asocia desde un
// piso distinto a aquel donde el bajante origen realmente vive), parcheando el storage de ese
// piso directamente.
// Elimina cualquier clave-de-nivel de desplazamientos en la que se etiquetara el conector Ldesvio
// de este bajante — claveada por el id de Ldesvio (único por source) en vez de por una etiqueta
// de nivel, porque la etiqueta no siempre puede reconstruirse del piso (posiblemente distinto)
// cargado actualmente del caller.
export function setBajanteDesplazamientoInStorage(
  planId: string,
  bajanteId: string,
  lvl: string,
  disp: { dx: number; dy: number; Ldesvio?: string } | null,
  ghostDireccion?: 'sube' | 'baja',
): void {
  const key = TRAZOS_PREFIX + planId;
  const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(key, null);
  if (!raw?.bajantes) return;
  const b = raw.bajantes.find((x) => x.id === bajanteId);
  if (!b) return;
  const desp = { ...(b.desplazamientos || {}) };
  if (disp) desp[lvl] = disp;
  else delete desp[lvl];
  b.desplazamientos = desp;
  if (ghostDireccion) {
    const gd = { ...(b.ghostData || {}) };
    gd[lvl] = { ...(gd[lvl] ?? {}), direccion: ghostDireccion };
    b.ghostData = gd;
  }
  saveToStorage(key, raw);
  saveTrazosToDB(planId, raw);
}

// Un extremo bajante/montante de una asociación entre pisos — suficiente para escribir los
// punteros de ambas direcciones, el fantasma, y (cuando está desalineado) el ramal de desvío
// Ldesvio, sin importar cuál de los dos pisos resulte ser el cargado en vivo actualmente.
export interface AssocEndpoint {
  planId: string;
  id: string;
  x: number;
  y: number;
  net: string;
  dNominal: string;
  code: string;
  /** plan.nivel — el índice ordinal del piso, usado para etiquetas de piso y comparación de elevación. */
  nivelN: number;
  npt: number;
  /** Tipo del elemento (bajante/montante) — los montantes siempre fluyen 'sube', la asociación
   *  no les debe estampar la dirección calculada de bajantes. Opcional: los callers viejos no
   *  lo pasan y se asume bajante. */
  tipo?: string;
}

/** ¿Los dos extremos de asociación caen en el MISMO punto físico? Compara origen-relativo
 *  (px − origen de calibración de cada lámina; misma resta que la isometría) con tolerancia
 *  0.5 plane-px. Unidades: px de lámina. Con origen en UNA sola lámina (o en ninguna) cae al
 *  crudo legacy (hojas asumidas alineadas) — deliberado: datos viejos sin calibrar no deben
 *  romper asociaciones existentes. */
export function isAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  // Alineación FÍSICA (misma regla 0.5 px): px crudos de láminas distintas NO significan el
  // mismo punto del edificio cuando las hojas están corridas — se compara origen-relativo
  // (misma resta que hace la isometría). Sin origen en alguna lámina, fallback crudo
  // (comportamiento legacy: hojas asumidas alineadas).
  const oa = origenDePlan(a.planId);
  const ob = origenDePlan(b.planId);
  const ax = oa && ob ? a.x - oa.x_px : a.x;
  const ay = oa && ob ? a.y - oa.y_px : a.y;
  const bx = oa && ob ? b.x - ob.x_px : b.x;
  const by = oa && ob ? b.y - ob.y_px : b.y;
  return Math.abs(ax - bx) < 0.5 && Math.abs(ay - by) < 0.5;
}

/** Variante exportada de isAligned (mismo contrato): puentebote para consumers fuera del
 *  módulo que necesitan testear alineación sin duplicar la resta origen-relativa. */
export function areEndpointsAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  return isAligned(a, b);
}

// --- Herencia UD: UN SOLO cómputo del agregado del piso superior (asociar + vivo) ---
// Antes el apply sumaba solo `recibeDeIds` directos (con tope de 10) mientras el panel
// mostraba el árbol completo: el inferior quedaba con MENOS uds (p. ej. 16 de 24). Este
// cierre incluye clave propia + recibeDeIds + tributarios por padre (toda profundidad) +
// fuentes mergesFrom + vecinos geométricos aguas arriba (cadenas extremo-con-extremo), y
// excluye espejos (alimentaIds + colas geométricas), LDs y otras redes. Sin topes.

export interface InheritPoolRamal {
  id: string;
  net?: string;
  tipo?: string;
  padre?: string | null;
  pts?: number[][];
  _tribReversed?: boolean;
  mergesFrom?: [string, string] | string[];
  fixtures?: Record<string, number>;
  [k: string]: unknown;
}

export interface InheritPoolBajante {
  id: string;
  recibeDeIds?: string[];
  alimentaIds?: string[];
  x?: number;
  y?: number;
}

export interface CollectedAgg {
  agg: Record<string, number>;
  hydroAgg: Record<string, number> | null;
  ramalIds: string[];
}

export const GEO_TOL_UPSTREAM = 0.6;
export const GEO_TOL_BAJANTE = 2.0;

export function flowTailOf(r: InheritPoolRamal): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
}

export function flowHeadOf(r: InheritPoolRamal): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[0] : r.pts[r.pts.length - 1];
}

/** Cierre transitivo de ramales que drenan a un bajante (solo ids, sin conteos). */
export function upstreamRamalIdsForBajante(args: {
  net: string;
  bajId: string;
  bajX?: number;
  bajY?: number;
  recibeDeIds: string[];
  alimentaIds: string[];
  pool: InheritPoolRamal[];
}): string[] {
  const { net, bajX, bajY, recibeDeIds, alimentaIds, pool } = args;
  const byId = new Map(pool.map((r) => [r.id, r]));
  const excluded = new Set(alimentaIds);
  const netOk = (r: InheritPoolRamal | undefined): r is InheritPoolRamal =>
    !!r && (r.net ?? net) === net && !isLdesvioRamalId(r.id);
  const queue: string[] = [...recibeDeIds];
  // Semilla geométrica: ramal con EXTREMO junto al bajante que no sea salida (cubre listas
  // recibeDeIds stale — el autosave lleva 1.5 s de retraso — sin tragar cruces de cuerpo).
  if (bajX != null && bajY != null) {
    for (const r of pool) {
      if (!netOk(r) || excluded.has(r.id)) continue;
      const tail = flowTailOf(r);
      const head = flowHeadOf(r);
      if (!tail || !head) continue;
      const tailNear = Math.hypot(tail[0] - bajX, tail[1] - bajY) < GEO_TOL_BAJANTE;
      const headNear = Math.hypot(head[0] - bajX, head[1] - bajY) < GEO_TOL_BAJANTE;
      if (!tailNear && !headNear) continue;
      // Cola junto al bajante (y cabeza fuera) = ESPEJO de salida, jamás fuente.
      if (tailNear && !headNear) {
        excluded.add(r.id);
        continue;
      }
      queue.push(r.id);
    }
  }
  const visited = new Set<string>();
  const out: string[] = [];
  while (queue.length) {
    const rid = queue.pop()!;
    if (visited.has(rid) || excluded.has(rid) || isLdesvioRamalId(rid)) continue;
    const r = byId.get(rid);
    // Solo ramales conocidos de la red: un id listado pero sin fila (renombrado, borrado… o
    // el id de la propia bomba / un LD en listas mixtas) no aporta — su clave, si existe, es
    // un espejo o un huérfano, y sumarla reinyectaría el agregado en cada pasada.
    if (!r || !netOk(r)) continue;
    visited.add(rid);
    out.push(rid);
    // Hijos por padre (tributarios, toda profundidad).
    for (const c of pool) {
      if (c.padre === rid && netOk(c) && !visited.has(c.id) && !excluded.has(c.id))
        queue.push(c.id);
    }
    // Fuentes de un split (existing + incoming son aguas arriba del autocreado).
    const mf = r?.mergesFrom;
    if (Array.isArray(mf)) {
      for (const m of mf) {
        if (typeof m !== 'string' || visited.has(m) || excluded.has(m)) continue;
        const mr = byId.get(m);
        if (!mr || !netOk(mr)) continue;
        queue.push(m);
      }
    }
    // Vecino geométrico aguas arriba: cabeza de N sobre la cola de R (cadena
    // extremo-con-extremo sin registro mergesFrom).
    const tailR = r ? flowTailOf(r) : null;
    if (tailR) {
      for (const n of pool) {
        if (n.id === rid || visited.has(n.id) || excluded.has(n.id) || !netOk(n)) continue;
        const headN = flowHeadOf(n);
        if (headN && Math.hypot(headN[0] - tailR[0], headN[1] - tailR[1]) < GEO_TOL_UPSTREAM)
          queue.push(n.id);
      }
    }
  }
  return out;
}

/** Agregado heredable de un bajante: el mismo cierre para asociar y para el vivo. */
export function collectSourceAgg(args: {
  net: string;
  planId: string;
  bajId: string;
  liveBaj?: InheritPoolBajante | null;
  liveRamales?: InheritPoolRamal[] | null;
  storedBaj?: InheritPoolBajante | null;
  storedRamales?: InheritPoolRamal[] | null;
  counts: Record<string, Record<string, number>>;
  hidro: Record<string, { accesorios?: Record<string, number> }>;
}): CollectedAgg {
  const { net, planId, bajId, counts, hidro } = args;
  // El motor vivo manda sobre el storage (autosave con debounce): si el piso del bajante
  // es el cargado, TODO sale de él; si no, del storage de ese piso.
  const live = args.liveBaj ?? args.storedBaj;
  const pool =
    args.liveRamales && args.liveRamales.length ? args.liveRamales : args.storedRamales || [];
  const ramalIds = upstreamRamalIdsForBajante({
    net,
    bajId,
    bajX: live?.x,
    bajY: live?.y,
    recibeDeIds: live?.recibeDeIds || [],
    alimentaIds: live?.alimentaIds || [],
    pool,
  });
  const byId = new Map(pool.map((r) => [r.id, r]));
  const agg: Record<string, number> = {};
  let hydroAgg: Record<string, number> | null = null;
  const sumKey = (rid: string) => {
    const sk = `${net}_${rid}_${planId}`;
    const m = counts[sk];
    const fuente =
      m && Object.keys(m).length
        ? m
        : byId.get(rid)?.fixtures && Object.keys(byId.get(rid)!.fixtures!).length
          ? (byId.get(rid)!.fixtures as Record<string, number>)
          : undefined;
    if (fuente) for (const [k, v] of Object.entries(fuente)) agg[k] = (agg[k] || 0) + (v as number);
    const h = hidro[sk];
    if (h?.accesorios && Object.keys(h.accesorios).length) {
      if (!hydroAgg) hydroAgg = {};
      for (const [k, v] of Object.entries(h.accesorios))
        hydroAgg[k] = (hydroAgg[k] || 0) + (v as number);
    }
  };
  // Clave propia del bajante (el panel también la suma en su agregado).
  const ownKey = `${net}_${bajId}_${planId}`;
  const own = counts[ownKey];
  if (own) for (const [k, v] of Object.entries(own)) agg[k] = (agg[k] || 0) + (v as number);
  for (const rid of ramalIds) sumKey(rid);
  return { agg, hydroAgg, ramalIds };
}

/** Punteros de asociación de un bajante (vivo primero, storage después). */
export function readBajanteLink(
  eng: IPlanoEngineCore,
  planId: string,
  bajId: string,
): { descargaEnId: string | null; origenId: string | null } {
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const live = loadedPlanId === planId ? eng.bajantes.find((b) => b.id === bajId) : undefined;
  if (live) return { descargaEnId: live.descargaEnId ?? null, origenId: live.origenId ?? null };
  const raw = loadFromStorage<{
    bajantes?: { id: string; descargaEnId?: string | null; origenId?: string | null }[];
  } | null>(TRAZOS_PREFIX + planId, null);
  const b = raw?.bajantes?.find((x) => x.id === bajId);
  return { descargaEnId: b?.descargaEnId ?? null, origenId: b?.origenId ?? null };
}

export function nptOfPlan(planId: string, plans: SyncPlanInput[]): number | null {
  const p = plans.find((x) => String(x.id) === String(planId));
  return typeof p?.npt === 'number' ? p.npt : null;
}

// Roles físicos de un enlace (el LD/ghost/anillo se direccionan por upper/lower por NPT,
// no por los roles UI source/target): el ghost XFG_<lowerId>_<lowerPlan> hospedado en el piso
// superior dice la verdad; sin ghost, se deriva por npt (empate → upper = target, igual que
// el apply); sin npts, null (barrido amplio legacy como último recurso).
export function resolveLinkRoles(
  sourcePlanId: string,
  sourceBajanteId: string,
  targetPlanId: string,
  targetBajanteId: string,
  plans: SyncPlanInput[],
): { upperPlanId: string; upperId: string; lowerPlanId: string; lowerId: string } | null {
  for (const pid of new Set([sourcePlanId, targetPlanId])) {
    const data = loadFromStorage<{
      crossFloorGhosts?: {
        sourcePlanId?: string;
        sourceBajanteId?: string;
        targetBajanteId?: string;
      }[];
    } | null>(TRAZOS_PREFIX + pid, null);
    for (const g of data?.crossFloorGhosts || []) {
      const match =
        (g.sourcePlanId === sourcePlanId &&
          g.sourceBajanteId === sourceBajanteId &&
          g.targetBajanteId === targetBajanteId) ||
        (g.sourcePlanId === targetPlanId &&
          g.sourceBajanteId === targetBajanteId &&
          g.targetBajanteId === sourceBajanteId);
      if (!match || !g.sourcePlanId || !g.sourceBajanteId || !g.targetBajanteId) continue;
      return {
        upperPlanId: pid,
        upperId: g.targetBajanteId,
        lowerPlanId: g.sourcePlanId,
        lowerId: g.sourceBajanteId,
      };
    }
  }
  const nptS = nptOfPlan(sourcePlanId, plans);
  const nptT = nptOfPlan(targetPlanId, plans);
  if (nptS == null || nptT == null) return null;
  // Espejo del apply: targetIsBelow = nptT < nptS; upper = below ? source : target.
  const upperIsSource = nptT < nptS;
  return upperIsSource
    ? {
        upperPlanId: sourcePlanId,
        upperId: sourceBajanteId,
        lowerPlanId: targetPlanId,
        lowerId: targetBajanteId,
      }
    : {
        upperPlanId: targetPlanId,
        upperId: targetBajanteId,
        lowerPlanId: sourcePlanId,
        lowerId: sourceBajanteId,
      };
}

// Elimina todo lo perteneciente a un enlace previamente establecido donde `sourcePlanId`/
// `sourceBajanteId` era el lado que sostenía descargaEnId de `oldLinkValue` ("targetPlanId|targetId").
// Scope EXACTO por enlace (roles upper/lower): los barridos amplios por id borraban el LD, el
// anillo y las claves de OTRO enlace cruzado que comparte id de bajante en otro piso
// (BAN1-P1↔BAN2-P2 + BAN1-P2↔BAN2-P1: LD_BAN1 vive en el piso 1 para el segundo enlace).
/** Marca de desasociación (auditoría ronda 8 F-2): al desasociar se estampa `asocsClearedTs`
 *  en el doc de trazos de AMBOS pisos. La restauración anti-loss (restaurarAsociacionesDesdeLocal)
 *  solo fusiona piezas de cachés con `ts >= asocsClearedTs` — la caché vieja de un TERCER
 *  dispositivo deja de resucitar LD_/anillos/ghosts que la desasociación legítima borró en
 *  origen+BD. Sin marca (nunca se desasoció): la restauración corre — blind-spot layout-2
 *  (BD sin artefactos por guardado fallido) sigue cubierto. */
export function estamparAsocsClearedTs(planIds: string[]): void {
  const ts = Date.now();
  for (const pid of planIds) {
    try {
      if (!hasCachedPlan(pid)) continue;
      const doc = loadData(pid) as LocalGhostDrawingData & { asocsClearedTs?: number };
      doc.asocsClearedTs = ts;
      saveData(pid, doc as LocalGhostDrawingData);
    } catch (e) {
      devError('[assoc] marca desasociación:', pid, e);
    }
  }
}
