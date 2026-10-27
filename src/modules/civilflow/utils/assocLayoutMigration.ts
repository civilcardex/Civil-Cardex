/** Migra y barre la asociación entrepisos (marca assocLayout): layout 2 = fantasma + LD_ (ramal desvio entrepisos) abajo. */
import { loadFromStorage, saveToStorage } from '../services/storageService.ts';
import { splitPtr } from './keys.ts';
import { registrarLdesvioComoAsociado } from './bajanteAssocShared.ts';
import { TRAZOS_PLAN_PREFIX, APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys.ts';
import type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes.ts';
import {
  loadData,
  saveData,
  createCrossFloorLdesvioRamal,
  removeCrossFloorLdesvioRamal,
  writeCrossFloorGhost,
  removeCrossFloorGhost,
  hasCachedPlan,
  ldesvioIdFor,
  isLdesvioRamalId,
  nextRamalLabel,
  buildLdesvioRamal,
  aFrameDe,
  type LocalGhostDrawingData,
} from './crossFloorStorage.ts';

/** Re-ancla anillos layout-2 al bajante superior actual (red tras recalibrar en otro dispositivo). */
function reanclarAnillosLayout2(data: LocalGhostDrawingData, pid: string): boolean {
  let dirty = false;
  for (const b of data.bajantes ?? []) {
    // PREFERIR origenId (apunta ARRIBA = el ancla del anillo). descargaEnId apunta ABAJO: para
    // el anillo la fórmula dx = partner − portador sigue siendo correcta (anillo legacy sobre
    // el superior), pero el LD_<id> derivado de un down-pointer no existe — ese no se toca.
    const puntero = b.origenId || b.descargaEnId;
    if (!puntero || !puntero.includes('|')) continue;
    const [upperPlanId, upperId] = splitPtr(puntero, '');
    if (!upperPlanId || !upperId || upperPlanId === pid) continue;
    const upper = leerPlano(upperPlanId).bajantes?.find((x) => x.id === upperId);
    if (!upper || upper.x == null || upper.y == null) continue;
    const anchor = aFrameDe({ x: upper.x, y: upper.y }, upperPlanId, pid);
    let dirtyB = false;
    const desp = { ...(b.desplazamientos ?? {}) };
    for (const lvlKey of Object.keys(desp)) {
      if (desp[lvlKey]?.Ldesvio) {
        const nx = anchor.x - (b.x ?? 0);
        const ny = anchor.y - (b.y ?? 0);
        // Épsilon: sin esto el "cambio" idempotente marcaba dirty en CADA apertura →
        // saveData + RPC destructivo por piso asociado y por carga, sin cambiar nada.
        if (
          Math.abs((desp[lvlKey]?.dx ?? 0) - nx) > 1e-9 ||
          Math.abs((desp[lvlKey]?.dy ?? 0) - ny) > 1e-9
        ) {
          desp[lvlKey] = { ...desp[lvlKey], dx: nx, dy: ny };
          dirtyB = true;
        }
      }
    }
    if (dirtyB) {
      b.desplazamientos = desp;
      dirty = true;
    }
    // Inicio del Ldesvio = ancla del superior. RECONSTRUIR con buildLdesvioRamal (como hace
    // updateCrossFloorLdesvioStartPoint): tocar solo pts[0]/totalL dejaba la etiqueta
    // descolgada del segmento movido.
    const ldId = ldesvioIdFor(upperId);
    const ld = (data.ramales ?? []).find((r) => r.id === ldId);
    if (ld?.pts?.length) {
      const [x2, y2] = ld.pts[ld.pts.length - 1];
      if (Math.abs(ld.pts[0][0] - anchor.x) > 0.01 || Math.abs(ld.pts[0][1] - anchor.y) > 0.01) {
        const nuevo = buildLdesvioRamal(
          ld.id,
          ld.label || ldId,
          ld.net,
          anchor.x,
          anchor.y,
          x2,
          y2,
          ld.diametro,
          Number(ld.piso) || 0,
          data.scaleM || 0.5,
          ld.bloqueado,
        );
        Object.assign(ld, nuevo);
        dirty = true;
      }
    }
  }
  return dirty;
}

/**
 * Caché de planos leídos durante una migración: el código releía el MISMO plano
 * (el superior) una vez por cada fantasma o bajante que lo apunta — I/O repetido dentro de un
 * bucle. La lectura es de localStorage (parseo JSON) y se cachea por planId.
 */
const cachePlanos = new Map<string, LocalGhostDrawingData>();

/** Lee el doc de un plano UNA vez por migración (cacheado por planId). */
function leerPlano(planId: string | number): LocalGhostDrawingData {
  const k = String(planId);
  let d = cachePlanos.get(k);
  if (!d) {
    d = loadData(planId);
    cachePlanos.set(k, d);
  }
  return d;
}

/** Vacía la caché de planos (al terminar una migración). */
function limpiarCachePlanos(): void {
  cachePlanos.clear();
}

/** Un plano guardado ya no es el de storage: su copia cacheada queda rancia. */
function invalidarPlanoCache(planId: string | number): void {
  cachePlanos.delete(String(planId));
}

/** Re-ancla fantasmas layout-2 al espejo actual del origen (sana recalibraciones de otro dispositivo). */
function reanclarGhostsLayout2(data: LocalGhostDrawingData, pid: string): boolean {
  let dirty = false;
  for (const g of data.crossFloorGhosts || []) {
    if (g.layout !== 2 || !g.sourcePlanId || g.sourcePlanId === pid) continue;
    const src = leerPlano(g.sourcePlanId).bajantes?.find((b) => b.id === g.sourceBajanteId);
    if (!src) continue;
    const xy = aFrameDe({ x: src.x ?? g.x, y: src.y ?? g.y }, g.sourcePlanId, pid);
    if (g.x !== xy.x || g.y !== xy.y) {
      g.x = xy.x;
      g.y = xy.y;
      dirty = true;
    }
  }
  return dirty;
}

/** Marca un piso con la versión 2 del layout de asociación (idempotente). */
export function markAssocLayout(planId: string | number): void {
  // Sin caché local del piso no se marca: saveData fabricaría `{assocLayout:2}` y el RPC
  // destructivo lo persistiría en BD — borrado del piso. El prefetch marca tras descargar.
  if (!hasCachedPlan(planId)) return;
  // Chequeo crudo ANTES de parsear (mismo guard barato de migrateAssocLayoutOnLoad:173):
  // en la pasada 2 se llama por bajante asociado y el 99% de los pisos ya están marcados —
  // loadData (JSON.parse del doc completo) solo cuando el raw no trae la marca. Un falso
  // positivo del includes es benigno: solo reintenta el marcaje en la próxima carga.
  if ((localStorage.getItem(TRAZOS_PLAN_PREFIX + String(planId)) || '').includes('"assocLayout":2'))
    return;
  const data = loadData(planId);
  if (data.assocLayout === 2) return;
  data.assocLayout = 2;
  saveData(planId, data);
}

/** Migra al layout 2 (anillos, LD_ (ramal desvio entrepisos) y fantasmas en sus pisos; idempotente). */
export function migrateAssocLayoutOnLoad(planId: string | number, nivelLabel: string): void {
  const pid = String(planId);
  // La caché de planos es de ESTA migración: se vacía al salir (un doc guardado en
  // medio no debe quedar cacheado para la siguiente).
  // Re-anclaje de ghosts layout-2 (frame cambió por recalibración): ANTES del guard barato,
  // pero solo parsea docs que efectivamente tienen ghosts de layout nuevo — los demás pagan
  // un `includes` y nada más.
  try {
    if ((localStorage.getItem(TRAZOS_PLAN_PREFIX + pid) || '').includes('"layout":2')) {
      const d0 = loadData(pid);
      if (reanclarGhostsLayout2(d0, pid)) saveData(pid, d0);
    }
  } catch {
    /* best-effort: sin re-anclaje el ghost queda en px del frame viejo */
  }
  // Re-anclaje de ANILLOS layout-2 (gemelo del de ghosts): un origen recalibrado en OTRO
  // dispositivo no pasó por el saneador local — al abrir este piso, el anillo se re-ancla a la
  // posición ACTUAL del superior traducida con aFrameDe (vía el puntero origenId/descargaEnId).
  try {
    if ((localStorage.getItem(TRAZOS_PLAN_PREFIX + pid) || '').includes('LD_')) {
      const d0 = loadData(pid);
      if (reanclarAnillosLayout2(d0, pid)) saveData(pid, d0);
    }
  } catch {
    /* best-effort */
  }
  // Guard barato: si el raw ya trae la marca, la migración está completa — sin parsear nada.
  // (saveToStorage serializa con JSON.stringify, así que la marca aparece literal.)
  try {
    if ((localStorage.getItem(TRAZOS_PLAN_PREFIX + pid) || '').includes('"assocLayout":2')) return;
  } catch {
    /* sin localStorage accesible: sigue el camino normal */
  }
  // Piso sin caché local: nada que migrar. Fabricar el documento aquí (touched incondicional +
  // markAssocLayout) pisaba la fila BD del piso con `{assocLayout:2, ts}` vía el RPC destructivo
  // y además dejaba la clave no-null, bloqueando para siempre el relleno del prefetch.
  if (!hasCachedPlan(pid)) return;
  let data = loadData(pid);
  const ghosts = data.crossFloorGhosts || [];
  let touched = false;
  // Marca de versión sobre el documento YA cargado: cada saveData de abajo la persiste sin
  // cargar/re-guardar el plan de nuevo (markAssocLayout por iteración era O(N) parse+save+BD).
  data.assocLayout = 2;
  touched = true;
  for (const g of ghosts) {
    // Ya migrado por una pasada anterior (o creado por la asociación nueva) — no re-procesar.
    if (g.layout === 2) continue;
    // Layout viejo: ghost en ESTE piso (inferior) cuyo targetBajanteId apunta a un bajante de
    // aquí y cuyo source es el piso superior. El guard de NPT distingue un ghost de layout NUEVO
    // (que vive en el piso SUPERIOR apuntando a un bajante local): si el bajante local resulta
    // ser el superior, no hay nada que migrar.
    const lower = (data.bajantes || []).find((b) => b.id === g.targetBajanteId);
    if (!lower) continue;
    const upperPlanId = g.sourcePlanId;
    const upperId = g.sourceBajanteId;
    if (!upperPlanId || !upperId) continue;
    const upperData = leerPlano(upperPlanId);
    const upper = upperData.bajantes?.find((b) => b.id === upperId);
    if (!upper) continue;
    if ((lower.nptBase ?? 0) > (upper.nptBase ?? 0)) continue;
    // NOTA ponytail (no "arreglar"): alignedPair y los deltas dx/dy comparan/restan px de los
    // DOS pisos crudos y eso es CORRECTO — aFrameDe es una traslación y se cancela en deltas y
    // distancias. Solo las posiciones ABSOLUTAS escritas en OTRO frame (el ghost del paso 4)
    // necesitan conversión.
    const alignedPair =
      Math.abs((upper.x ?? 0) - (lower.x ?? 0)) < 0.5 &&
      Math.abs((upper.y ?? 0) - (lower.y ?? 0)) < 0.5;
    const ldId = ldesvioIdFor(upperId);
    // 1. Mutar este piso: anillo sobre el bajante inferior (dx invertido) y quitar el ghost
    // viejo de la lista local. Alineados: sin anillo ni etiqueta (orig. usuario).
    // Clave de nivel fiable: el actual o la del ghost — NUNCA la primera clave de otros
    // desplazamientos (podía pertenecer a otro nivel/asociación y el anillo quedaba perdido).
    const lvlKey = nivelLabel || g.piso || '';
    if (lvlKey && !alignedPair) {
      const desp = { ...(lower.desplazamientos || {}) };
      desp[lvlKey] = {
        dx: (upper.x ?? 0) - (lower.x ?? 0),
        dy: (upper.y ?? 0) - (lower.y ?? 0),
        Ldesvio: ldId,
      };
      lower.desplazamientos = desp;
      // El anillo muestra siempre el flujo SUBIENDO (orig. usuario).
      const gd = { ...(lower.ghostData || {}) };
      gd[lvlKey] = { ...(gd[lvlKey] ?? {}), direccion: 'sube' };
      lower.ghostData = gd;
    }
    data.crossFloorGhosts = (data.crossFloorGhosts || []).filter(
      (x) => !(x.sourcePlanId === g.sourcePlanId && x.sourceBajanteId === g.sourceBajanteId),
    );
    saveData(pid, data);
    touched = true;
    // 2. Piso superior: limpiar el anillo viejo del bajante superior (ANTES de mover el LD —
    //    el guardado incluye el array ramales leído, y re-escribirlo después repondría el LD).
    //    La marca de versión viaja en el MISMO guardado (un parse+save menos).
    let upperDirty = false;
    for (const b of upperData.bajantes || []) {
      if (!b.desplazamientos) continue;
      for (const lvl of Object.keys(b.desplazamientos)) {
        if (b.desplazamientos[lvl]?.Ldesvio === ldId) {
          delete b.desplazamientos[lvl];
          upperDirty = true;
        }
      }
    }
    if (upperDirty) {
      upperData.assocLayout = 2;
      saveData(upperPlanId, upperData);
      invalidarPlanoCache(upperPlanId);
    }
    // 3. Ldesvio: mover del piso superior a ESTE piso (inferior), conservando geometría.
    const oldLd = (leerPlano(upperPlanId) as LocalGhostDrawingData).ramales?.find(
      (r) => r.id === ldId,
    );
    if (oldLd) {
      removeCrossFloorLdesvioRamal(upperPlanId, upperId);
      createCrossFloorLdesvioRamal(
        pid,
        upperId,
        oldLd.net,
        oldLd.pts[0][0],
        oldLd.pts[0][1],
        oldLd.pts[1][0],
        oldLd.pts[1][1],
        oldLd.diametro,
        Number(oldLd.piso) || 0,
      );
      moveLdesvioAparatosKey(oldLd.net, upperId, String(upperPlanId), pid);
      // El LD llega al elemento ORIGINAL de este piso: queda como ramal asociado (recibeDeIds
      // + asocManual + fin) → "Ramal asociado" marcado en el panel y en el menú contextual,
      // con el estado REAL guardado (orig. usuario).
      registrarLdesvioComoAsociado({
        planId: pid,
        bajanteId: lower.id,
        bajanteCode: lower.code || lower.id,
        ldId,
      });
      // Re-sincronizar el espejo local: las escrituras de arriba fueron load+save fresco y el
      // saveData(pid, data) de la SIGUIENTE iteración pisa con el array en memoria stale.
      data.ramales = loadData(pid).ramales;
    }
    // 4. Ghost-marcador: al piso superior, re-identificado como el bajante inferior y anclado
    //    en SUS coords traducidas al frame del anfitrión (posición absoluta cruzando pisos).
    const lowerXY = aFrameDe({ x: lower.x ?? 0, y: lower.y ?? 0 }, pid, upperPlanId);
    const newGhost: CrossFloorGhost = {
      ...g,
      id: `XFG_${lower.id}_${pid}`,
      code: lower.code || g.code,
      x: lower.x == null ? g.x : lowerXY.x,
      y: lower.y == null ? g.y : lowerXY.y,
      sourcePlanId: pid,
      sourceBajanteId: lower.id,
      targetBajanteId: upperId,
      layout: 2,
    };
    writeCrossFloorGhost(upperPlanId, newGhost);
    // Sin marca persistida en el superior (paso 2 solo guarda si limpió anillos): marcar aquí.
    markAssocLayout(upperPlanId);
  }

  // Entre pasadas se re-lee del storage: la pasada 1 escribe LDs directamente (create/
  // removeCrossFloorLdesvioRamal hacen load+save fresco) y guardar después con el array en
  // memoria stale los borraba (plan intermedio en cadena de 3+ pisos, rol lower Y upper).
  data = loadData(pid);

  // Pasada 2 — lado SUPERIOR: este piso aloja un bajante con descargaEnId y su LD_ propio
  // (layout viejo: el recargo sin haber abierto el piso inferior dejaba aquí el Ldesvio y el
  // anillo). Mover el LD y el anillo al piso del destino; el ghost-marcador ya vive aquí.
  for (const b of data.bajantes || []) {
    if (!b.descargaEnId || !b.descargaEnId.includes('|')) continue;
    const [lowerPlanId, lowerBajanteId] = splitPtr(b.descargaEnId, '');
    if (!lowerPlanId || !lowerBajanteId || lowerPlanId === pid) continue;
    const ldId = ldesvioIdFor(b.id);
    const ld = (data.ramales || []).find((r) => r.id === ldId);
    const hasOwnRing = Object.values(b.desplazamientos || {}).some((d) => d?.Ldesvio === ldId);
    if (!ld && !hasOwnRing) continue;
    const lowerData = loadData(lowerPlanId);
    const lower = lowerData.bajantes?.find((x) => x.id === lowerBajanteId);
    if (!lower) continue;
    // 1. Anillo: del bajante superior (aquí) al inferior (allá), invertido y con 'sube'.
    //    Alineados: sin anillo (se limpia si existía) — solo el ghost-marcador queda aquí.
    //    Se persiste ANTES de mover el LD: el create de abajo hace load+save fresco, así que
    //    conservar el anillo en lowerData y guardar después del create lo pisa.
    const alignedPair =
      Math.abs((b.x ?? 0) - (lower.x ?? 0)) < 0.5 && Math.abs((b.y ?? 0) - (lower.y ?? 0)) < 0.5;
    const lvlKey = alignedPair ? '' : lower.pisoBase || nivelLabel;
    if (lvlKey) {
      const desp = { ...(b.desplazamientos || {}) };
      for (const lvl of Object.keys(desp)) {
        if (desp[lvl]?.Ldesvio === ldId) delete desp[lvl];
      }
      b.desplazamientos = desp;
      const gd = { ...(b.ghostData || {}) };
      for (const lvl of Object.keys(gd)) {
        if (gd[lvl]?.direccion && !desp[lvl]) delete gd[lvl];
      }
      const lDesp = { ...(lower.desplazamientos || {}) };
      lDesp[lvlKey] = {
        dx: (b.x ?? 0) - (lower.x ?? 0),
        dy: (b.y ?? 0) - (lower.y ?? 0),
        Ldesvio: ldId,
      };
      lower.desplazamientos = lDesp;
      const lGd = { ...(lower.ghostData || {}) };
      lGd[lvlKey] = { ...(lGd[lvlKey] ?? {}), direccion: 'sube' };
      lower.ghostData = lGd;
      // Sin este save, removeCrossFloorGhost/markAssocLayout de abajo (load+save fresco)
      // descartarían el anillo: las mutaciones solo vivían en memoria.
      saveData(lowerPlanId, lowerData);
      invalidarPlanoCache(lowerPlanId);
    }
    // 2. Ldesvio: mover al piso inferior, conservando geometría. Tras mover, resincronizar el
    //    espejo local de ramales (el saveData final de esta pasada reescribe este piso y un
    //    array stale repondría el LD borrado).
    if (ld) {
      removeCrossFloorLdesvioRamal(pid, b.id);
      createCrossFloorLdesvioRamal(
        lowerPlanId,
        b.id,
        ld.net,
        ld.pts[0][0],
        ld.pts[0][1],
        ld.pts[1][0],
        ld.pts[1][1],
        ld.diametro,
        Number(ld.piso) || 0,
      );
      moveLdesvioAparatosKey(ld.net, b.id, pid, String(lowerPlanId));
      // El LD llega al elemento ORIGINAL del piso inferior: ramal asociado (estado real) —
      // "Ramal asociado" marcado en el panel y en el menú contextual (orig. usuario).
      registrarLdesvioComoAsociado({
        planId: lowerPlanId,
        bajanteId: lower.id,
        bajanteCode: lower.code || lower.id,
        ldId,
      });
      data.ramales = (data.ramales || []).filter((r) => r.id !== ldId);
    }
    // 3. Ghost-marcador: debe vivir AQUÍ (superior) referenciando al inferior; quitar cualquier
    //    ghost viejo del layout anterior que siga en el piso del destino.
    const oldGhost = (lowerData.crossFloorGhosts || []).find(
      (g) => g.sourcePlanId === pid && g.sourceBajanteId === b.id,
    );
    if (oldGhost) {
      // Posición absoluta del ghost cruza pisos: traducir las coords del inferior al frame de
      // ESTE piso (anfitrión). Deltas de anillos: ver NOTA ponytail de la pasada 1.
      const lowerXY = aFrameDe({ x: lower.x ?? 0, y: lower.y ?? 0 }, lowerPlanId, pid);
      const newGhost: CrossFloorGhost = {
        ...oldGhost,
        id: `XFG_${lowerBajanteId}_${pid}`,
        code: lower.code || oldGhost.code,
        x: lower.x == null ? oldGhost.x : lowerXY.x,
        y: lower.y == null ? oldGhost.y : lowerXY.y,
        sourcePlanId: pid,
        sourceBajanteId: lowerBajanteId,
        targetBajanteId: b.id,
        layout: 2,
      };
      removeCrossFloorGhost(lowerPlanId, pid, b.id);
      writeCrossFloorGhost(pid, newGhost);
      // writeCrossFloorGhost carga/guarda el doc por su cuenta; sin meter el ghost TAMBIÉN en
      // esta copia, el saveData de abajo (leída antes del write) lo borraba — espejo del
      // resync de ramales de la pasada 1.
      data.crossFloorGhosts = [
        ...(data.crossFloorGhosts || []).filter(
          (g) => !(g.sourcePlanId === pid && g.sourceBajanteId === b.id),
        ),
        newGhost,
      ];
    }
    saveData(pid, data);
    touched = true;
    markAssocLayout(lowerPlanId);
  }
  if (touched) markAssocLayout(pid);
}

/** Mueve la clave de aparatos del LD_ (ramal desvio entrepisos) al plan destino (UD (Unidades de Desague) por máximo, sin duplicar). */
function moveLdesvioAparatosKey(
  net: string,
  upperBajanteId: string,
  fromPlanId: string,
  toPlanId: string,
): void {
  if (fromPlanId === toPlanId) return;
  const map = loadFromStorage<Record<string, Record<string, number>>>(APARATOS_BY_TRAMO_KEY, {});
  const from = `${net}_LD_${upperBajanteId}_${fromPlanId}`;
  const to = `${net}_LD_${upperBajanteId}_${toPlanId}`;
  if (!map[from]) return;
  const cur = map[to] || {};
  for (const [k, v] of Object.entries(map[from])) {
    cur[k] = Math.max(cur[k] || 0, Number(v) || 0);
  }
  map[to] = cur;
  delete map[from];
  saveToStorage(APARATOS_BY_TRAMO_KEY, map);
}

/** Sanea labels de LD_ (ramal desvio entrepisos) duplicados o chocados (solo cambia lo impreso). */
export function healLdesvioLabels(data: LocalGhostDrawingData): boolean {
  const ramales = data.ramales || [];
  if (!ramales.some((r) => isLdesvioRamalId(r.id))) return false;
  const realTaken = new Set<string>();
  for (const r of ramales) {
    if (isLdesvioRamalId(r.id)) continue;
    if (r.id) realTaken.add(r.id);
    if (r.label) realTaken.add(r.label);
  }
  const seen = new Set<string>();
  let changed = false;
  for (const r of ramales) {
    if (!isLdesvioRamalId(r.id)) continue;
    // Ldesvio de BOMBA (orig. usuario): SIN etiqueta por diseño — no consume número de ramal.
    if ((r as { _sinEtiqueta?: boolean })._sinEtiqueta) continue;
    const lbl = r.label || '';
    if (lbl && !seen.has(lbl) && !realTaken.has(lbl)) {
      seen.add(lbl);
      continue;
    }
    r.label = nextRamalLabel(r.net, ramales);
    seen.add(r.label);
    changed = true;
  }
  return changed;
}

/** Barrido global: borra LD_ (ramal desvio entrepisos) que viven en piso distinto al de su anillo. */
export function sweepMisplacedLdesvios(): void {
  const plans: Array<{ pid: string; data: LocalGhostDrawingData }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(TRAZOS_PLAN_PREFIX)) continue;
    const raw = localStorage.getItem(k) || '';
    // Un piso sin mención de 'LD_' no aporta al mapa de anillos ni tiene LD_ que barrer —
    // no se parsea (los planes son JSON grandes y este barrido corre en cada carga).
    if (!raw.includes('LD_')) continue;
    const pid = k.slice(TRAZOS_PLAN_PREFIX.length);
    plans.push({ pid, data: loadData(pid) });
  }
  // home: ldId -> pisos cuyos bajantes portan un anillo que lo referencia. Un LD_ solo se
  // considera desubicado si el piso donde VIVE no lo reclama (defensa contra punteros
  // huérfanos dejados por copias entre pisos, que antes re-homizaban el LD_ real).
  const claims: Record<string, Set<string>> = {};
  for (const { pid, data } of plans) {
    for (const b of data.bajantes || []) {
      for (const d of Object.values(b.desplazamientos || {})) {
        if (d?.Ldesvio) {
          if (!claims[d.Ldesvio]) claims[d.Ldesvio] = new Set();
          claims[d.Ldesvio].add(pid);
        }
      }
    }
  }
  for (const { pid, data } of plans) {
    const ramales = data.ramales || [];
    const misplaced = ramales.filter(
      (r) => isLdesvioRamalId(r.id) && claims[r.id] && !claims[r.id].has(pid),
    );
    let dirty = false;
    if (misplaced.length) {
      data.ramales = ramales.filter((r) => !misplaced.includes(r));
      dirty = true;
    }
    if (healLdesvioLabels(data)) dirty = true;
    if (!dirty) continue;
    saveData(pid, data);
  }
  limpiarCachePlanos();
}
