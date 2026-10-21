import type { SyncPlanInput } from './dibujoSync.ts';
import { aplicarEnDocDePlan, type MotorDoc } from './escribePlanoDocumento.ts';
import {
  isLdesvioRamalId,
  hasCachedPlan,
  loadData,
  saveData,
  type LocalGhostDrawingData,
} from './associateBajanteAcrossFloors';
import { origenDePlan } from './crossPisoAlmacenamiento.ts';
import { devError } from '../../../utils/desarrolloError.ts';
import {
  loadFromStorage,
  saveToStorage,
  saveTrazosToDB,
} from '../services/almacenamientoServicio.ts';
import {
  TRAZOS_PREFIX,
  APARATOS_HEREDADOS_KEY,
  APARATOS_HEREDADOS_TRIB_KEY,
} from '../constants/almacenamientoClaves.ts';
import type { IPlanoEngineCore } from '../lib/PlanoEngine/PlanoEstado.ts';
import { bajanteEntregaSuCargaAlRamal } from './propagation/conteo.ts';
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
  /** plan.nivel: el número ordinal del piso (0 = suelo, 1 = primer piso…), usado para las etiquetas y para saber qué piso queda arriba de cuál. */
  nivelN: number;
  npt: number;
  /** Tipo del elemento (los montantes siempre apuntan 'sube'; los bajantes no calculan dirección). */
  tipo?: string;
}

/** ¿Dos extremos caen en el MISMO punto del edificio? Se compara restando el origen de calibración de cada lámina (si no, hojas corridas darían falsos positivos); tolerancia 0.5 px de plano. */
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

/** Igual que isAligned pero exportada para pruebas (misma comparación origen-relativa, sin duplicarla). */
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
  /** Código del elemento del que ARRANCA el ramal (si el ramal nace en él, es su salida). */
  ini?: string;
  [k: string]: unknown;
}

export interface InheritPoolBajante {
  id: string;
  tipo?: string;
  /** Código visible del bajante (el que guardan los ramales en `ini`). */
  code?: string;
  /** Ramales asociados a mano (checkbox): el bajante les ENTREGA su carga (no le traen). */
  asocManual?: string[];
  recibeDeIds?: string[];
  alimentaIds?: string[];
  x?: number;
  y?: number;
  /** Puntero de asociación entre pisos (apunta ARRIBA): marca al portador como RECEPTOR. */
  origenId?: string | null;
  /** Puntero a bomba: también receptor (herencia invertida). */
  bombaEnId?: string | null;
  /** Libro de herencia: lo que el piso de arriba dejó aplicado en este bajante (asociación
   *  entre pisos). Es la carga HEREDADA — el árbol local puede no traerla (el Ldesvio queda
   *  fuera del árbol por diseño) y sin ella una cadena de tres pisos pierde la carga. */
  ucAplicado?: Record<string, Record<string, number>>;
}

export interface CollectedAgg {
  agg: Record<string, number>;
  hydroAgg: Record<string, number> | null;
  ramalIds: string[];
}

// Traza del último grupo calculado (diagnóstico __cfDiag → asoc[].grupoDetalle): dice de
// dónde salió CADA pieza del grupo — clave propia, cierre de ramales, ramales servidos y
// qué libro se mezcló. Con esto un dump nombra la rama exacta sin adivinar.
let trazaUltimoGrupo: Record<string, unknown> | null = null;
export function trazaDeUltimoGrupo(): Record<string, unknown> | null {
  return trazaUltimoGrupo;
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

/** Registra el desvío en L (LD) como RAMAL ASOCIADO del bajante/montante al que LLEGA (el
 *  original del piso destino): lo añade a `recibeDeIds` + `asocManual` (la asociación a mano
 *  no se poda por geometría) y marca el `fin` del LD con el código del bajante. Con esto el
 *  "Ramal asociado" aparece MARCADO en el panel derecho y en el menú contextual, y el estado
 *  es REAL (guardado en el doc), no un dibujito del menú (orig. usuario). */
export function registrarLdesvioComoAsociado(args: {
  planId: string | number;
  bajanteId: string;
  bajanteCode: string;
  ldId: string;
  eng?: MotorDoc | null;
}): void {
  const { planId, bajanteId, bajanteCode, ldId, eng } = args;
  if (!bajanteId || !ldId) return;
  aplicarEnDocDePlan(eng ?? null, planId, (doc) => {
    for (const raw of doc.bajantes || []) {
      const b = raw as { id: string; recibeDeIds?: string[]; asocManual?: string[] };
      if (b.id !== bajanteId) continue;
      const recibe = new Set(b.recibeDeIds || []);
      const manual = new Set(b.asocManual || []);
      if (!recibe.has(ldId)) recibe.add(ldId);
      if (!manual.has(ldId)) manual.add(ldId);
      b.recibeDeIds = [...recibe];
      b.asocManual = [...manual];
    }
    for (const raw of doc.ramales || []) {
      const r = raw as { id: string; fin?: string };
      if (r.id !== ldId) continue;
      r.fin = bajanteCode;
    }
  });
}

/** Quita el desvío en L (LD) de la asociación del bajante (muere con el enlace): lo saca de
 *  `recibeDeIds` + `asocManual`. Sin esto, el LD muerto quedaba en la lista y los espejos le
 *  escribían la carga del bajante (una clave fantasma que el usuario veía como UDs
 *  residuales, orig. usuario). */
export function desasociarLdesvioDeBajante(args: {
  planId: string | number;
  bajanteId: string;
  ldId: string;
  eng?: MotorDoc | null;
}): void {
  const { planId, bajanteId, ldId, eng } = args;
  if (!bajanteId || !ldId) return;
  aplicarEnDocDePlan(eng ?? null, planId, (doc) => {
    for (const raw of doc.bajantes || []) {
      const b = raw as { id: string; recibeDeIds?: string[]; asocManual?: string[] };
      if (b.id !== bajanteId) continue;
      const recibe = b.recibeDeIds || [];
      const manual = b.asocManual || [];
      b.recibeDeIds = recibe.filter((id) => id !== ldId);
      b.asocManual = manual.filter((id) => id !== ldId);
    }
  });
}

/** Ramales a los que el bajante/montante ENTREGA su carga (fase 3b, upMonte). Mismos criterios
 *  que la entrega — una sola fuente de verdad ({@link bajanteEntregaSuCargaAlRamal}).
 *  Lo que el bajante alimenta NO le trae nada: su carga ya va en su disco → sumarla al
 *  grupo la cuenta dos veces. */
export function idsServidosPorBajante(args: {
  bajCode: string;
  asocManual?: string[];
  alimentasIds?: string[];
  pool: InheritPoolRamal[];
  x?: number;
  y?: number;
}): Set<string> {
  const servidos = new Set<string>();
  for (const r of args.pool) {
    if (
      bajanteEntregaSuCargaAlRamal({
        ramalId: r.id,
        ramalIni: typeof r.ini === 'string' ? r.ini : undefined,
        ramalFin: typeof r.fin === 'string' ? r.fin : undefined,
        cola: flowTailOf(r),
        cabeza: flowHeadOf(r),
        bajCode: args.bajCode,
        bajX: args.x,
        bajY: args.y,
        alimentaIds: args.alimentasIds,
        asocManual: args.asocManual,
      })
    )
      servidos.add(r.id);
  }
  return servidos;
}

/** Todos los ramales que terminan drenando en este bajante, siguiendo la cadena completa (tributarios, uniones y mergesFrom incluidos) — solo sus ids, sin conteos. */
export function upstreamRamalIdsForBajante(args: {
  net: string;
  bajId: string;
  bajCode?: string;
  asocManual?: string[];
  bajX?: number;
  bajY?: number;
  recibeDeIds: string[];
  alimentaIds: string[];
  pool: InheritPoolRamal[];
}): string[] {
  const { net, bajCode, asocManual, bajX, bajY, recibeDeIds, alimentaIds, pool } = args;
  const byId = new Map(pool.map((r) => [r.id, r]));
  const esPresion = net !== 'san' && net !== 'll';
  // Excluidos del cierre: lo que el bajante ALIMENTA (no le trae nada: su carga ya va en su
  // disco → sumarla la contaba dos veces, orig. usuario: 3 UC + 3 UC del ramal = 6) y sus
  // espejos. En san/ll la clave del ramal ES la carga que drena: no se excluye nada.
  const excluded = new Set<string>(alimentaIds);
  if (esPresion) {
    for (const id of idsServidosPorBajante({
      bajCode: bajCode || '',
      asocManual,
      alimentasIds: alimentaIds,
      pool,
      x: bajX,
      y: bajY,
    }))
      excluded.add(id);
  }
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

/** Todo lo que un bajante "se trae" de aguas arriba (su clave + ramales conectados + tributarios + splits): ÚNICA fuente, la usan igual la asociación entre pisos y el panel en vivo. */
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
  const esMonte = live?.tipo === 'montante' || args.storedBaj?.tipo === 'montante';
  // MONTANTES de presión (af/ac/gas): el ramal que el montante ALIMENTA ya lleva la carga del
  // montante en su disco (upMonte se la entregó) — sumarle la clave COMPLETA cuenta esa carga
  // DOS veces (3 UC del montante + 3 UC del ramal = 6: el grupo que bajaba triplicado). Esos
  // ramales quedan FUERA del cierre (no son fuentes) y aportan solo lo PROPIO (rama `servi`).
  const esPresion = net !== 'san' && net !== 'll';
  let serviIds: string[] = [];
  // MONTANTE de presión = la MISMA verdad que su panel: clave propia + ramales listados en
  // recibeDeIds (walk PLANO — nada de cierre geométrico). El dump v54 lo cerró: el cierre
  // geométrico recogía ramales del superior con discos inflados de eras viejas que el panel
  // NO suma (14.5 abajo con 4.5 arriba). Los servidos (los que ÉL alimenta) aportan solo su
  // propio, con la resta de entrega.
  const servi = (() => {
    if (!(esMonte && esPresion)) return new Set<string>();
    const base = idsServidosPorBajante({
      bajCode: live?.code || args.storedBaj?.code || bajId,
      asocManual: live?.asocManual || args.storedBaj?.asocManual,
      alimentasIds: [...(live?.alimentaIds || args.storedBaj?.alimentaIds || [])],
      pool,
      x: live?.x ?? args.storedBaj?.x,
      y: live?.y ?? args.storedBaj?.y,
    });
    for (const id of live?.alimentaIds || args.storedBaj?.alimentaIds || []) base.delete(id);
    return base;
  })();
  serviIds = [...servi];
  const ramalIds =
    esMonte && esPresion
      ? [...new Set([...(live?.recibeDeIds || []), ...(args.storedBaj?.recibeDeIds || [])])]
      : upstreamRamalIdsForBajante({
          net,
          bajId,
          bajCode: live?.code || args.storedBaj?.code || bajId,
          asocManual: live?.asocManual || args.storedBaj?.asocManual,
          bajX: live?.x,
          bajY: live?.y,
          recibeDeIds: live?.recibeDeIds || [],
          alimentaIds: live?.alimentaIds || [],
          pool,
        });
  const byId = new Map(pool.map((r) => [r.id, r]));
  const agg: Record<string, number> = {};
  let hydroAgg: Record<string, number> | null = null;
  // Piezas de la traza (se rellenan a lo largo de la función).
  let trazaLibroMezclado: Record<string, unknown> | null = null;
  // Libros de herencia (separan lo PROPIO de cada clave servida de lo que el montante le
  // entregó por upMonte): cargados una vez — misma resta de fase A del propagador.
  let hered: Record<string, Record<string, number>> = {};
  let heredTrib: Record<string, Record<string, number>> = {};
  if (esMonte && esPresion) {
    try {
      hered = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_HEREDADOS_KEY, {});
      heredTrib = loadFromStorage<Record<string, Record<string, number>>>(
        APARATOS_HEREDADOS_TRIB_KEY,
        {},
      );
    } catch {
      /* sin storage (tests) */
    }
  }
  const sumKey = (rid: string) => {
    const sk = `${net}_${rid}_${planId}`;
    const m = counts[sk];
    const fuente =
      m && Object.keys(m).length
        ? m
        : byId.get(rid)?.fixtures && Object.keys(byId.get(rid)!.fixtures!).length
          ? (byId.get(rid)!.fixtures as Record<string, number>)
          : undefined;
    if (fuente) {
      // Ramales que ENTRAN al bajante. En montantes de presión, si el ramal también es
      // SERVIDO (lo que él alimenta), solo cuenta lo PROPIO (disco − heredados − trib: lo
      // que el montante le entregó ya viaja en su clave propia — regla del panel). Sin
      // libro de heredados, la clave completa (el panel tampoco puede separar).
      const her = esMonte && esPresion && servi.has(rid) ? hered[sk] : undefined;
      if (her && Object.keys(her).length) {
        const trib = heredTrib[sk] || {};
        for (const [k, v] of Object.entries(fuente)) {
          const propio = Math.max(0, (Number(v) || 0) - (her[k] || 0) - (trib[k] || 0));
          if (propio > 0) agg[k] = (agg[k] || 0) + propio;
        }
      } else {
        // Cierre = ramales que ENTRAN al bajante: su libro de heredados es carga de uniones
        // aguas arriba (legítima, viaja con él — test "un ramal de aguas arriba conserva su
        // heredado (unión)"). NO se resta aquí; la resta de entrega del montante va solo en
        // la rama servi (ramales que ÉL alimenta).
        for (const [k, v] of Object.entries(fuente)) agg[k] = (agg[k] || 0) + (v as number);
      }
    }
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
  // MONTANTES (af/ac/gas): ramales SERVIDOS que NO están en recibeDeIds (los que el montante
  // alimenta sin que la lista los traiga) aportan solo lo PROPIO (disco − heredados − trib;
  // sin libro, máximo por aparato — conservador). Los de recibeDeIds ya entraron por sumKey.
  if (esMonte && esPresion) {
    const serviAgg: Record<string, number> = {};
    let todosConLibro = true;
    for (const rid of servi) {
      if (ramalIds.includes(rid)) continue; // ya entró por recibeDeIds
      const sk = `${net}_${rid}_${planId}`;
      const m = counts[sk];
      if (!m || !Object.keys(m).length) continue;
      const her = hered[sk];
      const trib = heredTrib[sk] || {};
      if (her && Object.keys(her).length) {
        for (const [k, v] of Object.entries(m)) {
          const propio = Math.max(0, (Number(v) || 0) - (her[k] || 0) - (trib[k] || 0));
          if (propio > 0) serviAgg[k] = (serviAgg[k] || 0) + propio;
        }
      } else {
        todosConLibro = false;
        for (const [k, v] of Object.entries(m))
          serviAgg[k] = Math.max(serviAgg[k] || 0, Number(v) || 0);
      }
    }
    if (Object.keys(serviAgg).length) {
      for (const [k, v] of Object.entries(serviAgg)) {
        agg[k] = todosConLibro ? (agg[k] || 0) + v : Math.max(agg[k] || 0, v);
      }
    }
  }
  // Libro de herencia (asociación entre pisos): la carga que el piso de ARRIBA dejó en este
  // bajante. Se mezcla con MÁXIMO por aparato, no sumando: el árbol local puede traer ya esa
  // misma carga (el ramal que la recibió) y sumarla la contaría DOS veces. Con MÁXIMO:
  //  - piso con ramales: árbol = 3, libro = 3 -> 3 (no 6).
  //  - piso intermedio SIN ramales (cadena de 3 pisos): el Ldesvio queda FUERA del árbol por
  //    diseño, así que el árbol = 0 y el libro = 3 -> 3 (la cadena no pierde la carga).
  // El motor vivo y el storage se mezclan con MÁXIMO: el vivo puede venir stale (autosave con
  // retardo) y el storage puede no estar yet.
  // SOLO RECEPTORES (orig. usuario MAC1: 15.5 rancio): un montante FUENTE puro (sin
  // origenId/bombaEnId ni recibeDeIds) con libro de una era anterior envenenaba el grupo que
  // baja — con máximo, el libro rancio (15.5) le ganaba al árbol fresco (4.5). El libro del
  // propio bajante solo representa herencia legítima cuando ÉL recibe de alguien.
  const esReceptorDeAlguien = !!(
    live?.recibeDeIds?.length ||
    args.storedBaj?.recibeDeIds?.length ||
    live?.origenId ||
    args.storedBaj?.origenId ||
    live?.bombaEnId ||
    args.storedBaj?.bombaEnId
  );
  if (esReceptorDeAlguien) {
    // Forma anidada de 5bis ({clave_propia: totales}): la carga que el montante RECIBE de
    // sus alimentadores — se mezcla siempre (los alimentadores pueden no estar en el cierre
    // por listas stale; con máximo jamás infla).
    const propia = live?.ucAplicado?.[ownKey] ?? args.storedBaj?.ucAplicado?.[ownKey];
    if (propia)
      for (const [k, v] of Object.entries(propia)) agg[k] = Math.max(agg[k] || 0, Number(v) || 0);
    // Libro ramal-claveado (el grupo escrito por apply/espejos): SOLO para ESLABONES de
    // cadena — montantes que SON receptores entre pisos (origenId/bombaEnId) con el árbol
    // vacío (la cadena 3→2→1 depende de él). UNA FUENTE (sin origenId/bomba) jamás mezcla
    // libro: su árbol vacío significa que no tiene carga, y su libro ramal-claveado es
    // residuo de una asociación antigua (con roles invertidos) que nadie re-escribe —
    // mezclarlo re-inyectaba el rancio en cada pase (orig. usuario: 15.5 abajo con el
    // panel de arriba sin aparatos que justifiquen ese grupo).
    const esEslabon = !!(
      live?.origenId ||
      args.storedBaj?.origenId ||
      live?.bombaEnId ||
      args.storedBaj?.bombaEnId
    );
    if (!Object.keys(agg).length && esEslabon) {
      const libro = libroHeredadoDe(live?.ucAplicado);
      for (const [k, v] of Object.entries(libroHeredadoDe(args.storedBaj?.ucAplicado)))
        libro[k] = Math.max(libro[k] || 0, v);
      for (const [k, v] of Object.entries(libro)) agg[k] = Math.max(agg[k] || 0, v);
      trazaLibroMezclado = { entrada: 'passthrough-eslabon', libro };
    } else {
      trazaLibroMezclado = null;
    }
    if (propia) trazaLibroMezclado = { ...(trazaLibroMezclado || {}), propia5bis: propia };
  }
  trazaUltimoGrupo = {
    ownKey,
    ownValor: own || null,
    cierreRamales: ramalIds,
    serviMontante: esMonte ? serviIds : null,
    treePiezas: Object.keys(agg).length,
    agg,
    esReceptor: esReceptorDeAlguien,
    libro: trazaLibroMezclado,
  };
  return { agg, hydroAgg, ramalIds };
}

/** Suma del libro de herencia por aparato, tomando el MÁXIMO de cada entrada (el libro tiene
 *  una entrada por pieza que recibió la carga y todas llevan la misma). */
function libroHeredadoDe(
  libro: Record<string, Record<string, number>> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of Object.values(libro || {}))
    for (const [k, v] of Object.entries(m)) out[k] = Math.max(out[k] || 0, Number(v) || 0);
  return out;
}

/** Con qué bajantes de OTROS pisos está enlazado este (descargaEnId/origenId): primero se mira el motor vivo, y si ese piso no está abierto, lo guardado. */
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
/** Deja constancia en AMBOS pisos de que se desasoció (así una cop vieja guardada en el navegador no "resucita" el LD_ (ramal desvio entrepisos) que se acaba de borrar). */
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
