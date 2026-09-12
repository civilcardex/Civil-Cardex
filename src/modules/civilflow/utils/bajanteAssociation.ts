import { writeBajantePropToDrawing } from './writeDiameterToDrawing';
import { writeSanDrawingSync, writeHydroDrawingSync } from './drawingSync';
import type { SyncPlanInput } from './drawingSync';
import {
  writeCrossFloorGhost,
  removeCrossFloorGhost,
  createCrossFloorLdesvioRamal,
  removeCrossFloorLdesvioRamal,
  buildLdesvioRamal,
  ldesvioIdFor,
  isLdesvioRamalId,
  nextRamalLabel,
  type CrossFloorGhost,
} from './associateBajanteAcrossFloors';
import { markAssocLayout } from './assocLayoutMigration';
import { loadFromStorage, saveToStorage, saveTrazosToDB } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  TRAZOS_PLAN_PREFIX,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
import { pisoCorto, pisoLbl } from '../constants';
import type { IPlanoEngineCore } from '../lib/PlanoEngine/PlanoState';

interface StoredBajanteDesp {
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
function setBajanteDesplazamientoInStorage(
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
}

function isAligned(a: AssocEndpoint, b: AssocEndpoint): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

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

const GEO_TOL_UPSTREAM = 0.6;
const GEO_TOL_BAJANTE = 2.0;

function flowTailOf(r: InheritPoolRamal): number[] | null {
  if (!r.pts || r.pts.length < 2) return null;
  return r._tribReversed ? r.pts[r.pts.length - 1] : r.pts[0];
}

function flowHeadOf(r: InheritPoolRamal): number[] | null {
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
function readBajanteLink(
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

function nptOfPlan(planId: string, plans: SyncPlanInput[]): number | null {
  const p = plans.find((x) => String(x.id) === String(planId));
  return typeof p?.npt === 'number' ? p.npt : null;
}

// Roles físicos de un enlace (el LD/ghost/anillo se direccionan por upper/lower por NPT,
// no por los roles UI source/target): el ghost XFG_<lowerId>_<lowerPlan> hospedado en el piso
// superior dice la verdad; sin ghost, se deriva por npt (empate → upper = target, igual que
// el apply); sin npts, null (barrido amplio legacy como último recurso).
function resolveLinkRoles(
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
export function clearBajanteAssociation(
  eng: IPlanoEngineCore,
  sourcePlanId: string,
  sourceBajanteId: string,
  sourceNet: string,
  oldLinkValue: string,
  plans: SyncPlanInput[],
): void {
  const [targetPlanId, targetBajanteId] = oldLinkValue.split('|');
  if (!targetPlanId || !targetBajanteId) return;
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const reverseValue = `${sourcePlanId}|${sourceBajanteId}`;

  // LD/ghost/anillo de ESTE enlace y nada más: el LD es LD_<upperId> en el piso inferior
  // (nuevo) o en el superior (legado sin migrar — mismo id, otro piso).
  const roles = resolveLinkRoles(
    sourcePlanId,
    sourceBajanteId,
    targetPlanId,
    targetBajanteId,
    plans,
  );
  const exactLd = roles ? ldesvioIdFor(roles.upperId) : null;
  if (roles && exactLd) {
    removeCrossFloorLdesvioRamal(roles.lowerPlanId, roles.upperId);
    removeCrossFloorLdesvioRamal(roles.upperPlanId, roles.upperId);
    removeCrossFloorGhost(roles.upperPlanId, roles.lowerPlanId, roles.lowerId);
  } else {
    // Último recurso (sin ghost ni npts): barrido amplio legacy.
    removeCrossFloorGhost(targetPlanId, sourcePlanId, sourceBajanteId);
    removeCrossFloorGhost(sourcePlanId, targetPlanId, targetBajanteId);
    removeCrossFloorLdesvioRamal(sourcePlanId, sourceBajanteId);
    removeCrossFloorLdesvioRamal(targetPlanId, targetBajanteId);
    removeCrossFloorLdesvioRamal(targetPlanId, sourceBajanteId);
    removeCrossFloorLdesvioRamal(sourcePlanId, targetBajanteId);
  }
  // Punteros: solo se anulan si aún apuntan a ESTE enlace (un puntero a otro enlace es de
  // otro par y no se toca — p. ej. el origenId de una cadena de 3 pisos).
  const curSrcPtr = readBajanteLink(eng, sourcePlanId, sourceBajanteId);
  const curTgtPtr = readBajanteLink(eng, targetPlanId, targetBajanteId);
  if (curTgtPtr.origenId === reverseValue) {
    writeBajantePropToDrawing(
      `${targetBajanteId}-${targetPlanId}`,
      sourceNet,
      'origenId',
      null,
      plans,
    );
  }
  if (curSrcPtr.descargaEnId === `${targetPlanId}|${targetBajanteId}`) {
    writeBajantePropToDrawing(
      `${sourceBajanteId}-${sourcePlanId}`,
      sourceNet,
      'descargaEnId',
      null,
      plans,
    );
  }

  // Fantasma en el motor vivo: el piso abierto lo renderiza (punteada + cuarto de círculo)
  // aunque el storage ya se limpió — antes solo se filtraba si el cargado era el TARGET, y
  // desasociar desde el superior (SOURCE) dejaba el fantasma pintado (orig. usuario).
  // Filtro por enlace exacto, sin importar qué lado está cargado.
  if (roles) {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) => !(g.sourcePlanId === roles.lowerPlanId && g.sourceBajanteId === roles.lowerId),
    );
  } else {
    eng.crossFloorGhosts = eng.crossFloorGhosts.filter(
      (g) =>
        !(
          (g.sourcePlanId === sourcePlanId && g.sourceBajanteId === sourceBajanteId) ||
          (g.sourcePlanId === targetPlanId && g.sourceBajanteId === targetBajanteId)
        ),
    );
  }
  if (loadedPlanId === targetPlanId) {
    const t = eng.bajantes.find((b) => b.id === targetBajanteId);
    if (t && (t.origenId ?? null) === reverseValue) eng.updateElementById(t.id, { origenId: null });
  }
  if (loadedPlanId === sourcePlanId) {
    const s = eng.bajantes.find((b) => b.id === sourceBajanteId);
    if (s && (s.descargaEnId ?? null) === `${targetPlanId}|${targetBajanteId}`)
      eng.updateElementById(s.id, { descargaEnId: null });
  }
  // El Ldesvio (ramal autogenerado) de ESTE enlace se borra del motor vivo por id exacto —
  // el filtro amplio por ambos ids borraba el LD de un enlace cruzado en el mismo piso.
  if (exactLd) eng.ramales = eng.ramales.filter((r) => r.id !== exactLd);
  // Anillo (desplazamientos) que referencia el LD exacto — en el bajante inferior (nuevo) o
  // en el superior (legado): buscar por id exacto, nunca por familia de ids.
  const limpiarDespExacto = (planId: string) => {
    const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(
      TRAZOS_PREFIX + planId,
      null,
    );
    if (!raw?.bajantes || !exactLd) return;
    let changed = false;
    for (const b of raw.bajantes) {
      if (!b.desplazamientos) continue;
      const desp = { ...b.desplazamientos };
      const gd = b.ghostData ? { ...b.ghostData } : undefined;
      for (const lvl of Object.keys(desp)) {
        if (desp[lvl]?.Ldesvio === exactLd) {
          delete desp[lvl];
          if (gd) delete gd[lvl];
          changed = true;
        }
      }
      b.desplazamientos = desp;
      if (gd) b.ghostData = gd;
    }
    if (changed) {
      saveToStorage(TRAZOS_PREFIX + planId, raw);
      saveTrazosToDB(planId, raw);
    }
  };
  const ringPlans = roles
    ? [roles.lowerPlanId, roles.upperPlanId]
    : [...new Set([targetPlanId, sourcePlanId])];
  const ringIds = exactLd
    ? new Set([exactLd])
    : new Set([ldesvioIdFor(sourceBajanteId), ldesvioIdFor(targetBajanteId)]);
  for (const pid of ringPlans) {
    if (loadedPlanId === pid) {
      const ids = roles ? [roles.lowerId, roles.upperId] : [targetBajanteId, sourceBajanteId];
      const bajL = eng.bajantes.find((b) => ids.includes(b.id));
      if (!bajL) continue;
      const desp = { ...(bajL.desplazamientos || {}) };
      for (const lvl of Object.keys(desp)) {
        const ldRef = desp[lvl]?.Ldesvio;
        if (ldRef && ringIds.has(ldRef)) {
          delete desp[lvl];
        }
      }
      const gd = bajL.ghostData ? { ...bajL.ghostData } : undefined;
      if (gd) {
        for (const lvl of Object.keys(gd)) {
          if (!desp[lvl]) delete gd[lvl];
        }
      }
      eng.updateElementById(bajL.id, {
        desplazamientos: desp,
        ...(gd ? { ghostData: gd } : {}),
      });
    } else {
      if (!exactLd) {
        // Legacy sin id exacto: barrido amplio solo como último recurso (comportamiento previo).
        const raw = loadFromStorage<{ bajantes?: StoredBajanteDesp[] } | null>(
          TRAZOS_PREFIX + pid,
          null,
        );
        if (raw?.bajantes) {
          let changed = false;
          for (const b of raw.bajantes) {
            if (!b.desplazamientos) continue;
            const desp = { ...b.desplazamientos };
            const gd = b.ghostData ? { ...b.ghostData } : undefined;
            for (const lvl of Object.keys(desp)) {
              if (desp[lvl]?.Ldesvio && ringIds.has(desp[lvl]!.Ldesvio!)) {
                delete desp[lvl];
                if (gd) delete gd[lvl];
                changed = true;
              }
            }
            b.desplazamientos = desp;
            if (gd) b.ghostData = gd;
          }
          if (changed) {
            saveToStorage(TRAZOS_PREFIX + pid, raw);
            saveTrazosToDB(pid, raw);
          }
        }
      } else {
        limpiarDespExacto(pid);
      }
    }
  }

  // Revertir la herencia de UC/UD (orig. usuario): al asociar se SUMÓ el agregado del bajante
  // superior a los ramales del inferior (y a su Ldesvio + ucAcum). Al desasociar se RESTA esa
  // misma porción, se borra la clave del Ldesvio, se resetea ucAcum y se refrescan los paneles
  // en vivo (eventos storage/aparatos-clear).
  try {
    // 1) Reversión EXACTA por libro de herencia (orig. usuario): `ucAplicado` en el bajante
    //    destino registra lo que la asociación SUMÓ por clave — al desasociar se resta eso
    //    (piso a 0), preservando asignaciones manuales posteriores; la clave del Ldesvio se
    //    borra, ucAcum vuelve a 0 y se refresca en vivo.
    const tgtTrazosSnap = loadFromStorage<{
      bajantes?: Array<{
        id: string;
        ucAcum?: number;
        ucAplicado?: Record<string, Record<string, number>>;
        ucAplicadoHidro?: Record<string, Record<string, number>>;
      }>;
    } | null>(TRAZOS_PREFIX + targetPlanId, null);
    const tb = tgtTrazosSnap?.bajantes?.find((x) => x.id === targetBajanteId);
    // El motor VIVO manda sobre el storage cuando el piso destino es el cargado: el autosave
    // puede llevar hasta 1.5 s de retraso y un libro recién escrito solo existe en memoria.
    const liveTb =
      loadedPlanId === targetPlanId
        ? eng.bajantes.find((x) => x.id === targetBajanteId)
        : undefined;
    const aplicado =
      liveTb?.ucAplicado && Object.keys(liveTb.ucAplicado).length
        ? liveTb.ucAplicado
        : tb?.ucAplicado;
    const aplicadoHidro =
      liveTb?.ucAplicadoHidro && Object.keys(liveTb.ucAplicadoHidro).length
        ? liveTb.ucAplicadoHidro
        : tb?.ucAplicadoHidro;
    const snap = aplicado && Object.keys(aplicado).length ? aplicado : undefined;
    // Libro hidro gemelo; sin él (dibujos viejos) se resta el libro de aparatos, como antes.
    const snapHidro =
      aplicadoHidro && Object.keys(aplicadoHidro).length ? aplicadoHidro : undefined;
    if (snap || snapHidro) {
      const apos = loadFromStorage<Record<string, Record<string, number>>>(
        APARATOS_BY_TRAMO_KEY,
        {},
      );
      const hydro = loadFromStorage<
        Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
      >(HYDRO_DATA_STORAGE_KEY, {});
      for (const [tk, applied] of Object.entries(snap || {})) {
        const cur = apos[tk];
        if (cur) {
          for (const [k, v] of Object.entries(applied)) {
            const nv = Math.max(0, (cur[k] || 0) - (v as number));
            if (nv > 0) cur[k] = nv;
            else delete cur[k];
          }
          if (Object.keys(cur).length === 0) delete apos[tk];
        }
      }
      for (const [tk, applied] of Object.entries(snapHidro || snap || {})) {
        const h = hydro[tk];
        if (h?.accesorios) {
          for (const [k, v] of Object.entries(applied)) {
            const nv = Math.max(0, (h.accesorios[k] || 0) - (v as number));
            if (nv > 0) h.accesorios[k] = nv;
            else delete h.accesorios[k];
          }
          if (Object.keys(h.accesorios).length === 0) delete h.accesorios;
        }
        // Sin accesorios ni valores queda un cascarón vacío creado por la herencia: fuera.
        if (h && !h.accesorios && !((h.Lh ?? 0) > 0) && !((h.nSalidas ?? 0) > 0)) delete hydro[tk];
      }
      if (tb) {
        tb.ucAcum = 0;
        delete tb.ucAplicado;
        delete tb.ucAplicadoHidro;
      }
      // La clave del Ldesvio es un espejo machine-written (panel de solo lectura): se borra
      // entera al desasociar. Scope EXACTO (id del upper de este enlace): el barrido amplio
      // borraba el LD de un enlace cruzado con el mismo id en otro piso.
      if (roles && exactLd) {
        delete apos[`${sourceNet}_${exactLd}_${roles.lowerPlanId}`];
        delete hydro[`${sourceNet}_${exactLd}_${roles.lowerPlanId}`];
        delete apos[`${sourceNet}_${exactLd}_${roles.upperPlanId}`];
        delete hydro[`${sourceNet}_${exactLd}_${roles.upperPlanId}`];
      } else {
        for (const ld of [ldesvioIdFor(sourceBajanteId), ldesvioIdFor(targetBajanteId)]) {
          for (const pid of [targetPlanId, sourcePlanId]) {
            delete apos[`${sourceNet}_${ld}_${pid}`];
            delete hydro[`${sourceNet}_${ld}_${pid}`];
          }
        }
      }
      saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
      saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
      // Sin snapshot del trazos destino (caché ausente, libro venía del motor vivo) no hay
      // nada que revertir en disco: escribir null fabricaba una caché muerta y el push vacío
      // a BD borraba el piso. Solo se re-escribe un documento existente.
      if (tgtTrazosSnap) {
        saveToStorage(TRAZOS_PREFIX + targetPlanId, tgtTrazosSnap);
        saveTrazosToDB(targetPlanId, tgtTrazosSnap);
      }
      try {
        writeSanDrawingSync(plans);
        writeHydroDrawingSync(plans);
      } catch {
        /* sync best-effort */
      }
      if (loadedPlanId === targetPlanId) {
        const t = eng.bajantes.find((x) => x.id === targetBajanteId);
        if (t)
          eng.updateElementById(t.id, {
            ucAcum: 0,
            ucAplicado: undefined,
            ucAplicadoHidro: undefined,
          });
      }
      window.dispatchEvent(new CustomEvent('aparatos-clear'));
      window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
      window.dispatchEvent(new Event('storage'));
      eng._markDirty?.();
      eng.render?.();
      return;
    }
    // Sin libro (dibujos viejos / otro dispositivo): la reversión exacta sale de la propia
    // clave LD — el espejo machine-written registra justo lo heredado. Solo sin LD se
    // recomputa en directo (mejor esfuerzo, sin topes).
    const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const hydro = loadFromStorage<
      Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
    >(HYDRO_DATA_STORAGE_KEY, {});
    const ldKeyExact = roles && exactLd ? `${sourceNet}_${exactLd}_${roles.lowerPlanId}` : null;
    const ldAgg: Record<string, number> = (ldKeyExact && apos[ldKeyExact]) || {};
    const ldHydro: Record<string, number> = (ldKeyExact && hydro[ldKeyExact]?.accesorios) || {};
    const agg: Record<string, number> = { ...ldAgg };
    const hydroAgg: Record<string, number> = { ...ldHydro };
    if (!Object.keys(agg).length && !Object.keys(hydroAgg).length) {
      // Enlace alineado viejo (sin LD): recomputar directo del lado source, sin cierre
      // transitivo (espeja lo que el apply viejo sumó) y sin topes.
      const srcRaw = loadFromStorage<{
        bajantes?: InheritPoolBajante[];
        ramales?: InheritPoolRamal[];
      } | null>(TRAZOS_PREFIX + sourcePlanId, null);
      const liveSrcBaj =
        loadedPlanId === sourcePlanId
          ? eng.bajantes.find((b) => b.id === sourceBajanteId)
          : undefined;
      const srcBaj = liveSrcBaj ?? srcRaw?.bajantes?.find((b) => b.id === sourceBajanteId);
      const byId = new Map((srcRaw?.ramales || []).map((r) => [r.id, r]));
      for (const rid of srcBaj?.recibeDeIds || []) {
        const sk = `${sourceNet}_${rid}_${sourcePlanId}`;
        for (const [k, v] of Object.entries(apos[sk] || {})) agg[k] = (agg[k] || 0) + (v as number);
        const fx = byId.get(rid)?.fixtures;
        if (!apos[sk] && fx)
          for (const [k, v] of Object.entries(fx)) agg[k] = (agg[k] || 0) + (v as number);
        for (const [k, v] of Object.entries(hydro[sk]?.accesorios || {}))
          hydroAgg[k] = (hydroAgg[k] || 0) + (v as number);
      }
    }
    // Clave del Ldesvio: se borra entera (el conector desaparece con la desasociación).
    if (ldKeyExact) {
      delete apos[ldKeyExact];
      delete hydro[ldKeyExact];
    } else {
      const ldId = ldesvioIdFor(sourceBajanteId);
      delete apos[`${sourceNet}_${ldId}_${targetPlanId}`];
      delete hydro[`${sourceNet}_${ldId}_${targetPlanId}`];
    }
    // Ramales del destino: restar el agregado heredado (piso a 0, sin claves vacías). Sin
    // listas (dibujos viejos): respaldo geométrico por extremo, no toda la red (eso restaba
    // UDs ajenas al bajante).
    const tgtRaw = loadFromStorage<{
      bajantes?: (InheritPoolBajante & { x?: number; y?: number })[];
      ramales?: (InheritPoolRamal & { net: string })[];
    } | null>(TRAZOS_PREFIX + targetPlanId, null);
    const tgtBaj = tgtRaw?.bajantes?.find((x) => x.id === targetBajanteId);
    const liveTgtBaj =
      loadedPlanId === targetPlanId
        ? eng.bajantes.find((x) => x.id === targetBajanteId)
        : undefined;
    const effTgtBaj = liveTgtBaj ?? tgtBaj;
    const tgtRamalIds = [...(effTgtBaj?.recibeDeIds || []), ...(effTgtBaj?.alimentaIds || [])];
    if (tgtRamalIds.length === 0 && tgtRaw?.ramales?.length) {
      const bx = liveTgtBaj?.x ?? tgtBaj?.x;
      const by = liveTgtBaj?.y ?? tgtBaj?.y;
      for (const rr of tgtRaw.ramales) {
        if (rr.net !== sourceNet || !rr.id || rr.id.startsWith('LD_')) continue;
        if (bx == null || by == null || !rr.pts || rr.pts.length < 2) continue;
        const head = rr.pts[0];
        const tail = rr.pts[rr.pts.length - 1];
        if (
          Math.hypot(head[0] - bx, head[1] - by) < GEO_TOL_BAJANTE ||
          Math.hypot(tail[0] - bx, tail[1] - by) < GEO_TOL_BAJANTE
        )
          tgtRamalIds.push(rr.id);
      }
    }
    for (const rid of tgtRamalIds) {
      const tk = `${sourceNet}_${rid}_${targetPlanId}`;
      const cur = apos[tk];
      if (cur) {
        for (const [k, v] of Object.entries(agg)) {
          const nv = Math.max(0, (cur[k] || 0) - (v as number));
          if (nv > 0) cur[k] = nv;
          else delete cur[k];
        }
        if (Object.keys(cur).length === 0) delete apos[tk];
      }
      const h = hydro[tk];
      if (h?.accesorios) {
        for (const [k, v] of Object.entries(hydroAgg)) {
          const nv = Math.max(0, (h.accesorios[k] || 0) - (v as number));
          if (nv > 0) h.accesorios[k] = nv;
          else delete h.accesorios[k];
        }
        if (Object.keys(h.accesorios).length === 0) delete h.accesorios;
      }
    }
    saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
    saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
    // ucAcum del bajante destino vuelve a 0 — escritura directa al storage del piso destino
    // (no depende del parámetro plans, que llega vacío en algunos caminos de borrado).
    const tgtTrazos = loadFromStorage<{ bajantes?: { id: string; ucAcum?: number }[] } | null>(
      TRAZOS_PREFIX + targetPlanId,
      null,
    );
    if (tgtTrazos?.bajantes) {
      const tb = tgtTrazos.bajantes.find((x) => x.id === targetBajanteId);
      if (tb && tb.ucAcum) {
        tb.ucAcum = 0;
        saveToStorage(TRAZOS_PREFIX + targetPlanId, tgtTrazos);
        saveTrazosToDB(targetPlanId, tgtTrazos);
      }
    }
    if (loadedPlanId === targetPlanId) {
      const t = eng.bajantes.find((x) => x.id === targetBajanteId);
      if (t) eng.updateElementById(t.id, { ucAcum: 0 });
    }
    // Refresco en vivo de paneles y tablas: reescribir sync (árbol sin el enlace) + eventos.
    try {
      writeSanDrawingSync(plans);
      writeHydroDrawingSync(plans);
    } catch {
      /* sync best-effort */
    }
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
    window.dispatchEvent(new Event('storage'));
    eng._markDirty?.();
    eng.render?.();
  } catch {
    /* reversión best-effort */
  }
}

// Establece source -> target: escribe AMBOS punteros (source.descargaEnId, target.origenId),
// siempre crea el fantasma (en el piso del target, en la posición del source — una confirmación
// visual permanente de que el enlace existe, no solo algo que aparece cuando está desalineado), y
// crea el ramal de desvío Ldesvio (en el piso del source) solo cuando los dos no están ya
// alineados.
export function applyBajanteAssociation(
  eng: IPlanoEngineCore,
  source: AssocEndpoint,
  target: AssocEndpoint,
  plans: SyncPlanInput[],
): { aligned: boolean } {
  const loadedPlanId = String(eng._loadedPlanId ?? '');
  const linkValue = `${target.planId}|${target.id}`;
  const reverseValue = `${source.planId}|${source.id}`;
  const targetIsBelow = target.npt < source.npt;
  const sourceDireccion: 'sube' | 'baja' = targetIsBelow ? 'baja' : 'sube';
  const ghostDireccion: 'sube' | 'baja' = targetIsBelow ? 'sube' : 'baja';
  const aligned = isAligned(source, target);

  // Enlaces en conflicto: si el destino ya colgaba de OTRO origen, o el origen descargaba
  // en OTRO destino, limpiar esos enlaces PRIMERO (cambiar de asociado sin esto dejaba al
  // otro extremo como escritor rancio: su propagación en vivo re-empujaba su agregado viejo
  // sobre la herencia nueva). La UI ya limpia el previo del mismo extremo; esto cubre el
  // extremo opuesto. Idempotente: con punteros ya nulos no hace nada.
  try {
    const curSrc = readBajanteLink(eng, source.planId, source.id);
    if (curSrc.descargaEnId && curSrc.descargaEnId !== linkValue)
      clearBajanteAssociation(
        eng,
        source.planId,
        source.id,
        source.net,
        curSrc.descargaEnId,
        plans,
      );
    const curTgt = readBajanteLink(eng, target.planId, target.id);
    if (curTgt.origenId && curTgt.origenId !== reverseValue) {
      const [opPlan, opId] = curTgt.origenId.split('|');
      if (opPlan && opId)
        clearBajanteAssociation(
          eng,
          opPlan,
          opId,
          target.net,
          `${target.planId}|${target.id}`,
          plans,
        );
    }
  } catch {
    /* limpieza best-effort */
  }

  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'descargaEnId',
    linkValue,
    plans,
  );
  writeBajantePropToDrawing(
    `${source.id}-${source.planId}`,
    source.net,
    'direccion',
    sourceDireccion,
    plans,
  );
  writeBajantePropToDrawing(
    `${target.id}-${target.planId}`,
    target.net,
    'origenId',
    reverseValue,
    plans,
  );
  // Direccion automática (orig. usuario): el fantasma queda 'sube' y el PADRE/ORIGINAL 'baja' —
  // la dirección de la asociación manda en ambos extremos sin pasar por la validación del menú.
  writeBajantePropToDrawing(
    `${target.id}-${target.planId}`,
    target.net,
    'direccion',
    sourceDireccion,
    plans,
  );
  if (loadedPlanId === source.planId) {
    eng.updateElementById(source.id, { descargaEnId: linkValue, direccion: sourceDireccion });
  }
  if (loadedPlanId === target.planId) {
    eng.updateElementById(target.id, { origenId: reverseValue, direccion: sourceDireccion });
  }

  // Layout de la asociación (orig. usuario): el FANTASMA (anillo del bajante superior) y el
  // Ldesvio viven en el PISO INFERIOR; el piso superior solo lleva los marcadores (círculo
  // punteado + línea punteada de renderCrossFloorGhosts) referenciando el Ldesvio y el bajante
  // inferior. `upper`/`lower` por NPT — en ambos flujos de la UI el source es el superior, pero
  // se deriva de npt para no depender de eso.
  const upper = targetIsBelow ? source : target;
  const lower = targetIsBelow ? target : source;
  const ldId = ldesvioIdFor(upper.id);

  // Marcadores en el piso SUPERIOR: ghost posicionado en las coords del bajante inferior, con
  // targetBajanteId = bajante superior — renderCrossFloorGhosts dibuja el círculo punteado en
  // (x,y) del inferior y la línea punteada hasta el superior.
  const ghost: CrossFloorGhost = {
    id: `XFG_${lower.id}_${lower.planId}`,
    net: lower.net,
    code: lower.code || lower.id,
    x: lower.x,
    y: lower.y,
    dNominal: upper.dNominal || lower.dNominal || '',
    direccion: ghostDireccion,
    parentDireccion: sourceDireccion,
    piso: pisoCorto(lower.nivelN),
    sourcePlanId: lower.planId,
    sourceBajanteId: lower.id,
    targetBajanteId: upper.id,
    layout: 2,
  };
  writeCrossFloorGhost(upper.planId, ghost);
  markAssocLayout(upper.planId);
  // Diámetro (orig. usuario): el bajante inferior asociado toma el dNominal del SUPERIOR
  // (escritura directa al storage + campo vivo; bypass del guard de reducción de ramales —
  // el usuario quiere que tome el diámetro del superior incondicionalmente). El fantasma ya
  // nace con ese dNominal y los cambios posteriores del superior lo sincronizan solos.
  if (upper.dNominal && upper.dNominal !== lower.dNominal) {
    writeBajantePropToDrawing(
      `${lower.id}-${lower.planId}`,
      lower.net,
      'dNominal',
      upper.dNominal,
      plans,
    );
    if (loadedPlanId === lower.planId) {
      const liveLower = eng.bajantes.find((b) => b.id === lower.id);
      if (liveLower) liveLower.dNominal = upper.dNominal;
    }
  }
  if (loadedPlanId === upper.planId) {
    eng.crossFloorGhosts = [
      ...eng.crossFloorGhosts.filter(
        (g) => !(g.sourcePlanId === lower.planId && g.sourceBajanteId === lower.id),
      ),
      ghost,
    ];
  }

  // El anillo (desplazamientos) SOLO cuando NO están alineados (orig. usuario): alineados no
  // se crea Ldesvio ni etiqueta de fantasma — el bajante inferior ya está en su sitio y su
  // propia etiqueta basta; el marcador del piso superior queda suprimido por coincidir con el
  // bajante real (overlapReal en renderCrossFloorGhosts).
  if (!aligned) {
    if (loadedPlanId === lower.planId) {
      const lvl = eng.nivelActual?.label ?? '';
      if (lvl) {
        const lowBaj = eng.bajantes.find((b) => b.id === lower.id);
        if (lowBaj) {
          const desp = { ...(lowBaj.desplazamientos || {}) };
          desp[lvl] = { dx: upper.x - lower.x, dy: upper.y - lower.y, Ldesvio: ldId };
          // El anillo (en la posición del bajante superior) muestra siempre el flujo SUBIENDO
          // (orig. usuario) — vía ghostData del nivel, sin tocar la dirección propia de B.
          const gd = { ...(lowBaj.ghostData || {}) };
          gd[lvl] = { ...(gd[lvl] ?? {}), direccion: 'sube' };
          eng.updateElementById(lower.id, { desplazamientos: desp, ghostData: gd });
        }
      }
    } else {
      // El piso inferior no está cargado (asociar desde el piso superior) — mismo bookkeeping,
      // escrito directo al storage de ese piso.
      setBajanteDesplazamientoInStorage(
        lower.planId,
        lower.id,
        pisoLbl(lower.nivelN),
        {
          dx: upper.x - lower.x,
          dy: upper.y - lower.y,
          Ldesvio: ldId,
        },
        'sube',
      );
    }
  }
  markAssocLayout(lower.planId);

  if (!aligned) {
    // Ldesvio en el PISO INFERIOR: del punto del bajante superior al inferior.
    createCrossFloorLdesvioRamal(
      lower.planId,
      upper.id,
      lower.net,
      upper.x,
      upper.y,
      lower.x,
      lower.y,
      upper.dNominal || '',
      lower.nivelN,
    );
    if (loadedPlanId === lower.planId) {
      const existing = eng.ramales.find((r) => r.id === ldId);
      const label = existing?.label || nextRamalLabel(lower.net, eng.ramales);
      const ramal = buildLdesvioRamal(
        ldId,
        label,
        lower.net,
        upper.x,
        upper.y,
        lower.x,
        lower.y,
        upper.dNominal || '',
        lower.nivelN,
        eng.scaleM || 0.5,
        existing ? existing.bloqueado : true,
      );
      eng.ramales = [...eng.ramales.filter((r) => r.id !== ldId), ramal as never];
    }
  }

  // Herencia UD: el piso inferior (fantasma/Ldesvio/original) recibe el agregado COMPLETO
  // del bajante superior — la misma verdad que muestra su panel y que propaga el vivo
  // (collectSourceAgg): clave propia + cierre transitivo, sin topes.
  try {
    const srcRaw = loadFromStorage<{
      bajantes?: InheritPoolBajante[];
      ramales?: InheritPoolRamal[];
    } | null>(TRAZOS_PREFIX + source.planId, null);
    const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
    const hydro = loadFromStorage<
      Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
    >(HYDRO_DATA_STORAGE_KEY, {});
    const { agg, hydroAgg } = collectSourceAgg({
      net: source.net,
      planId: source.planId,
      bajId: source.id,
      liveBaj:
        loadedPlanId === source.planId
          ? (eng.bajantes.find((b) => b.id === source.id) ?? null)
          : null,
      liveRamales:
        loadedPlanId === source.planId ? (eng.ramales as unknown as InheritPoolRamal[]) : null,
      storedBaj: srcRaw?.bajantes?.find((b) => b.id === source.id) ?? null,
      storedRamales: srcRaw?.ramales ?? null,
      counts: apos,
      hidro: hydro,
    });
    if (Object.keys(agg).length || hydroAgg) {
      let aposDirty = false;
      let hydroDirty = false;
      if (!aligned) {
        // El Ldesvio vive en el PISO INFERIOR (layout nuevo) — su clave de aparatos también.
        const ldKey = `${source.net}_${ldId}_${lower.planId}`;
        if (Object.keys(agg).length) {
          apos[ldKey] = { ...agg };
          aposDirty = true;
        }
        if (hydroAgg) {
          hydro[ldKey] = { accesorios: { ...hydroAgg }, Lh: 0, nSalidas: 0 };
          hydroDirty = true;
        }
      }
      // UCs automáticas al piso inferior (orig. usuario): los ramales conectados al bajante
      // DESTINO reciben el agregado del piso superior SUMADO a lo que ya tengan — y el
      // bajante destino marca el total en ucAcum.
      const tgtRaw = loadFromStorage<{
        bajantes?: {
          id: string;
          recibeDeIds?: string[];
          alimentaIds?: string[];
          ucAplicado?: Record<string, Record<string, number>>;
          ucAplicadoHidro?: Record<string, Record<string, number>>;
        }[];
        ramales?: { id: string; net: string }[];
      } | null>(TRAZOS_PREFIX + target.planId, null);
      const tgtBaj = tgtRaw?.bajantes?.find((b) => b.id === target.id);
      // Mismo criterio vivo-sobre-storage para el bajante destino.
      const liveTgtBaj =
        loadedPlanId === target.planId ? eng.bajantes.find((b) => b.id === target.id) : undefined;
      const effTgtBaj = liveTgtBaj ?? tgtBaj;
      // Ramales que LLEGAN (recibeDeIds) y los que SALEN del bajante destino (alimentaIds,
      // orig. usuario: los ramales que salen del bajante también reciben las UDs). Sin topes:
      // un tope truncaba la herencia en pisos con muchos ramales.
      const tgtRamalIds: string[] = [
        ...(effTgtBaj?.recibeDeIds || []),
        ...(effTgtBaj?.alimentaIds || []),
      ];
      if (tgtRamalIds.length === 0 && tgtRaw?.ramales?.length) {
        // fallback geométrico (dibujos viejos sin listas): ramales de la red con un EXTREMO
        // junto al bajante destino — no toda la red (eso heredaba UDs ajenas al bajante).
        for (const rr of tgtRaw.ramales) {
          const pts = (rr as { pts?: number[][] }).pts;
          if (rr.net !== target.net || !rr.id || rr.id.startsWith('LD_') || !pts || pts.length < 2)
            continue;
          const head = pts[0];
          const tail = pts[pts.length - 1];
          if (
            Math.hypot(head[0] - target.x, head[1] - target.y) < GEO_TOL_BAJANTE ||
            Math.hypot(tail[0] - target.x, tail[1] - target.y) < GEO_TOL_BAJANTE
          )
            tgtRamalIds.push(rr.id);
        }
      }
      // UDs propias del bajante destino: los ramales que SALEN de él deben tener las mismas
      // UDs que el bajante (orig. usuario, asignación automática).
      // Libro de herencia (orig. usuario): por cada ramal destino se registra lo APLICADO
      // (`ucAplicado`/`ucAplicadoHidro` en el bajante destino, persistidos con sus trazos).
      // La (re)asociación y la propagación en vivo restan la herencia anterior y aplican la
      // nueva (delta): preserva asignaciones manuales, no acumula al reprocesar y la
      // desasociación resta exactamente lo heredado.
      const ucAplicado: Record<string, Record<string, number>> = {};
      const ucAplicadoHidro: Record<string, Record<string, number>> = {};
      const prevBook = effTgtBaj?.ucAplicado || {};
      const prevHydroBook = effTgtBaj?.ucAplicadoHidro || {};
      const own = apos[`${target.net}_${target.id}_${target.planId}`] || {};
      for (const rid of tgtRamalIds) {
        const tk = `${target.net}_${rid}_${target.planId}`;
        const esAlimenta = (effTgtBaj?.alimentaIds || []).includes(rid);
        const extra = esAlimenta ? { ...agg, ...own } : agg;
        const prevAp = prevBook[tk] || {};
        const cur = apos[tk] || {};
        const result: Record<string, number> = {};
        for (const k of new Set([...Object.keys(cur), ...Object.keys(extra)])) {
          const nv = Math.max(0, (cur[k] || 0) - (prevAp[k] || 0)) + (extra[k] || 0);
          if (nv > 0) result[k] = nv;
        }
        if (JSON.stringify(cur) !== JSON.stringify(result)) {
          if (Object.keys(result).length) apos[tk] = result;
          else delete apos[tk];
          aposDirty = true;
        }
        ucAplicado[tk] = { ...extra };
        if (hydroAgg) {
          const prevH = prevHydroBook[tk] || {};
          const hcur = hydro[tk] || { accesorios: {}, Lh: 0, nSalidas: 0 };
          const acc: Record<string, number> = {};
          for (const k of new Set([
            ...Object.keys(hcur.accesorios || {}),
            ...Object.keys(hydroAgg),
          ])) {
            const nv =
              Math.max(0, ((hcur.accesorios || {})[k] || 0) - (prevH[k] || 0)) + (hydroAgg[k] || 0);
            if (nv > 0) acc[k] = nv;
          }
          if (JSON.stringify(hcur.accesorios || {}) !== JSON.stringify(acc)) {
            hydro[tk] = { ...hcur, accesorios: acc };
            hydroDirty = true;
          }
          ucAplicadoHidro[tk] = { ...hydroAgg };
        }
      }
      if (!aligned) {
        const ldKey = `${source.net}_${ldId}_${lower.planId}`;
        // El Ldesvio lleva las UDs del agregado del superior: escribir su clave REAL.
        // Sin agregado, la clave se borra (no dejar `{}` vacío colgado).
        if (Object.keys(agg).length) {
          apos[ldKey] = { ...agg };
          ucAplicado[ldKey] = { ...agg };
        } else {
          delete apos[ldKey];
        }
        aposDirty = true;
        if (hydroAgg) {
          hydro[ldKey] = { accesorios: { ...hydroAgg }, Lh: 0, nSalidas: 0 };
          hydroDirty = true;
          ucAplicadoHidro[ldKey] = { ...hydroAgg };
        } else {
          delete hydro[ldKey];
          hydroDirty = true;
        }
      }
      if (!hydroAgg && Object.keys(prevHydroBook).length) {
        // El superior perdió su hidro desde la última aplicación: restar la herencia hidro
        // vieja de los ramales destino para no dejarla colgada.
        for (const [tk, prevH] of Object.entries(prevHydroBook)) {
          const hcur = hydro[tk];
          if (!hcur?.accesorios) continue;
          for (const [k, v] of Object.entries(prevH)) {
            const nv = Math.max(0, (hcur.accesorios[k] || 0) - (v as number));
            if (nv > 0) hcur.accesorios[k] = nv;
            else delete hcur.accesorios[k];
          }
          if (Object.keys(hcur.accesorios).length === 0) delete hcur.accesorios;
          hydroDirty = true;
        }
      }
      // Persistir los libros de herencia en el bajante destino (storage + BD).
      {
        const tgtSave = loadFromStorage<{
          bajantes?: Array<{
            id: string;
            ucAplicado?: Record<string, Record<string, number>>;
            ucAplicadoHidro?: Record<string, Record<string, number>>;
          }>;
        } | null>(TRAZOS_PREFIX + target.planId, null);
        const tb = tgtSave?.bajantes?.find((x) => x.id === target.id);
        if (tb) {
          tb.ucAplicado = ucAplicado;
          if (Object.keys(ucAplicadoHidro).length) tb.ucAplicadoHidro = ucAplicadoHidro;
          else delete tb.ucAplicadoHidro;
          saveToStorage(TRAZOS_PREFIX + target.planId, tgtSave);
          saveTrazosToDB(target.planId, tgtSave);
        }
      }
      if (aposDirty) saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
      if (hydroDirty) saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
      // ucAcum del bajante destino = total UC agregada del piso superior (visible en tablas).
      const totalUc = Object.values(agg).reduce((s, v) => s + (v as number), 0);
      if (loadedPlanId === target.planId) {
        // El libro también vive en el motor: la próxima (re)asociación lee el vivo primero
        // (el storage puede ir 1.5 s tarde) y el delta necesita el libro previo exacto.
        const liveSync: Record<string, unknown> = { ucAplicado, ucAplicadoHidro };
        if (totalUc > 0) liveSync.ucAcum = totalUc;
        eng.updateElementById(target.id, liveSync);
      }
      if (totalUc > 0) {
        writeBajantePropToDrawing(
          `${target.id}-${target.planId}`,
          target.net,
          'ucAcum',
          totalUc,
          plans,
        );
      }
      if (aposDirty || hydroDirty) {
        try {
          window.dispatchEvent(new CustomEvent('aparatos-clear'));
          window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore copy errors */
  }

  // Refresco garantizado tras asociar (en vivo, orig. usuario): reescribir las claves de sync
  // reconstruye el árbol de conectividad (con el enlace nuevo) y los eventos hacen que panel y
  // tablas relean storage al instante.
  try {
    writeSanDrawingSync(plans);
    writeHydroDrawingSync(plans);
    window.dispatchEvent(new CustomEvent('aparatos-clear'));
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed'));
    window.dispatchEvent(new Event('storage'));
  } catch {
    /* ignore */
  }
  eng.render();
  eng._markDirty();
  return { aligned };
}

interface HealBajante {
  id?: string;
  origenId?: string | null;
  bombaEnId?: string | null;
  ucAplicado?: Record<string, Record<string, number>>;
  ucAplicadoHidro?: Record<string, Record<string, number>>;
}

/** Sanador del trinquete de herencia invertida (orig. usuario: 12 UD abajo → 16 al reentrar).
 *  Mientras el guard de dirección de la propagación en vivo estuvo muerto (leía `p.npt`, campo
 *  inexistente), el efecto con el piso INFERIOR cargado trató al bajante inferior como fuente:
 *  sumó sus UD locales a la herencia y escribió el resultado en el piso SUPERIOR (claves de
 *  ramales + libro falso + espejo LD falso). Revierte EXACTO restando el libro (misma resta que
 *  clearBajanteAssociation), borra el libro y sus espejos LD, y preserva los libros legítimos
 *  (origenId a nivel estrictamente mayor; bombaEnId). Storage-only, idempotente. */
export function healHerenciaInvertida(
  plans: Array<{ id: string | number; nivel: number | string | null }>,
): boolean {
  const nivelDe = new Map<string, number>();
  for (const p of plans) {
    const n = p.nivel == null ? NaN : Number(p.nivel);
    if (Number.isFinite(n)) nivelDe.set(String(p.id), n);
  }
  if (nivelDe.size === 0) return false;
  let aposDirty = false;
  let changed = false;
  const apos = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const hydro = loadFromStorage<
    Record<string, { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number }>
  >(HYDRO_DATA_STORAGE_KEY, {});
  let hydroDirty = false;
  const bogusIds = new Map<string, number>(); // id → nivel del piso donde vivía el libro falso

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const raw = localStorage.getItem(key) || '';
    if (!raw.includes('"ucAplicado"')) continue;
    const pid = key.slice(TRAZOS_PLAN_PREFIX.length);
    const nivPid = nivelDe.get(pid);
    if (nivPid == null) continue; // piso sin nivel conocido: no juzgar
    let doc: { bajantes?: HealBajante[]; ts?: number };
    try {
      doc = JSON.parse(raw);
    } catch {
      continue;
    }
    let docDirty = false;
    for (const b of doc.bajantes || []) {
      const libro = b.ucAplicado;
      if (!libro || Object.keys(libro).length === 0) continue;
      const o = (b.origenId || '').split('|')[0];
      const nivO = o ? nivelDe.get(o) : undefined;
      if (!!b.bombaEnId || (nivO != null && nivO > nivPid)) continue; // libro legítimo
      for (const [tk, m] of Object.entries(libro)) {
        const cur = apos[tk];
        if (cur) {
          for (const [k, v] of Object.entries(m)) {
            const nv = (cur[k] || 0) - (Number(v) || 0);
            if (nv > 0) cur[k] = nv;
            else delete cur[k];
          }
          if (Object.keys(cur).length === 0) delete apos[tk];
          aposDirty = true;
        }
        const h = hydro[tk];
        const mh = b.ucAplicadoHidro?.[tk];
        if (h && mh) {
          const acc = { ...(h.accesorios || {}) };
          for (const [k, v] of Object.entries(mh)) {
            const nv = (acc[k] || 0) - (Number(v) || 0);
            if (nv > 0) acc[k] = nv;
            else delete acc[k];
          }
          h.accesorios = acc;
          if (Object.keys(acc).length === 0) delete h.accesorios;
          if (!h.accesorios && !((h.Lh ?? 0) > 0) && !((h.nSalidas ?? 0) > 0)) delete hydro[tk];
          hydroDirty = true;
        }
      }
      if (b.id) bogusIds.set(b.id, nivPid);
      delete b.ucAplicado;
      delete b.ucAplicadoHidro;
      docDirty = true;
    }
    if (docDirty) {
      doc.ts = Date.now();
      saveToStorage(TRAZOS_PREFIX + pid, doc);
      saveTrazosToDB(pid, doc);
      changed = true;
    }
  }

  // Espejos LD falsos del titular falso: el LD legítimo del titular vive en el piso de ABAJO
  // (descarga hacia abajo) — solo se borra el espejo situado EN su piso o ARRIBA (el trinquete
  // escribía hacia arriba). El guion final del prefijo evita colisión (BAN1 vs BAN10).
  for (const [X, homeNiv] of bogusIds) {
    for (const net of ['san', 'll']) {
      const pref = `${net}_LD_${X}_`;
      for (const k of Object.keys(apos)) {
        if (!k.startsWith(pref)) continue;
        const nivQ = nivelDe.get(k.slice(pref.length));
        if (nivQ == null || nivQ < homeNiv) continue; // espejo legítimo (piso de abajo)
        delete apos[k];
        aposDirty = true;
      }
      for (const k of Object.keys(hydro)) {
        if (!k.startsWith(pref)) continue;
        const nivQ = nivelDe.get(k.slice(pref.length));
        if (nivQ == null || nivQ < homeNiv) continue;
        delete hydro[k];
        hydroDirty = true;
      }
    }
  }

  if (aposDirty) saveToStorage(APARATOS_BY_TRAMO_KEY, apos);
  if (hydroDirty) saveToStorage(HYDRO_DATA_STORAGE_KEY, hydro);
  return changed || aposDirty || hydroDirty;
}
