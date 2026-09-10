/**
 * Migración y barrido del layout de asociación entre pisos (marca `assocLayout`).
 * Layout viejo: anillo (desplazamientos) + Ldesvio en el piso SUPERIOR, marcadores en el
 * inferior. Layout nuevo (2): fantasma + Ldesvio en el INFERIOR, marcadores en el superior.
 */
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { TRAZOS_PLAN_PREFIX, APARATOS_BY_TRAMO_KEY } from '../constants/storage-keys';
import type { CrossFloorGhost } from '../lib/shared/crossFloorGhostTypes';
import {
  loadData,
  saveData,
  createCrossFloorLdesvioRamal,
  removeCrossFloorLdesvioRamal,
  writeCrossFloorGhost,
  removeCrossFloorGhost,
  ldesvioIdFor,
  isLdesvioRamalId,
  nextRamalLabel,
  type LocalGhostDrawingData,
} from './associateBajanteAcrossFloors';

/** Marca un piso con la versión 2 del layout de asociación (idempotente). */
export function markAssocLayout(planId: string | number): void {
  const data = loadData(planId);
  if (data.assocLayout === 2) return;
  data.assocLayout = 2;
  saveData(planId, data);
}

/** Lee la versión del layout de asociación de un piso (1 = viejo/sin marca). */
export function readAssocLayout(planId: string | number): number {
  return loadData(planId).assocLayout ?? 1;
}

/** Migración automática al layout nuevo: reconstruye anillos, Ldesvios y ghost-marcadores en
 *  los pisos correctos. Idempotente — un piso con la marca `assocLayout: 2` no se re-procesa. */
export function migrateAssocLayoutOnLoad(planId: string | number, nivelLabel: string): void {
  const pid = String(planId);
  // Guard barato: si el raw ya trae la marca, la migración está completa — sin parsear nada.
  // (saveToStorage serializa con JSON.stringify, así que la marca aparece literal.)
  try {
    if ((localStorage.getItem(TRAZOS_PLAN_PREFIX + pid) || '').includes('"assocLayout":2')) return;
  } catch {
    /* sin localStorage accesible: sigue el camino normal */
  }
  let data = loadData(pid);
  const ghosts = data.crossFloorGhosts || [];
  let touched = false;
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
    const upperData = loadData(upperPlanId);
    const upper = upperData.bajantes?.find((b) => b.id === upperId);
    if (!upper) continue;
    if ((lower.nptBase ?? 0) > (upper.nptBase ?? 0)) continue;
    const alignedPair =
      Math.abs((upper.x ?? 0) - (lower.x ?? 0)) < 0.5 &&
      Math.abs((upper.y ?? 0) - (lower.y ?? 0)) < 0.5;
    const ldId = ldesvioIdFor(upperId);
    // 1. Mutar este piso: anillo sobre el bajante inferior (dx invertido) y quitar el ghost
    // viejo de la lista local. Alineados: sin anillo ni etiqueta (orig. usuario).
    const lvlKey = nivelLabel || Object.keys(lower.desplazamientos || {})[0] || g.piso || '';
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
    if (upperDirty) saveData(upperPlanId, upperData);
    // 3. Ldesvio: mover del piso superior a ESTE piso (inferior), conservando geometría.
    const oldLd = (loadData(upperPlanId) as LocalGhostDrawingData).ramales?.find(
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
      // Re-sincronizar el espejo local: las escrituras de arriba fueron load+save fresco y el
      // saveData(pid, data) de la SIGUIENTE iteración pisa con el array en memoria stale.
      data.ramales = loadData(pid).ramales;
    }
    // 4. Ghost-marcador: al piso superior, re-identificado como el bajante inferior y anclado
    //    en sus coords.
    const newGhost: CrossFloorGhost = {
      ...g,
      id: `XFG_${lower.id}_${pid}`,
      code: lower.code || g.code,
      x: lower.x ?? g.x,
      y: lower.y ?? g.y,
      sourcePlanId: pid,
      sourceBajanteId: lower.id,
      targetBajanteId: upperId,
      layout: 2,
    };
    writeCrossFloorGhost(upperPlanId, newGhost);
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
    const [lowerPlanId, lowerBajanteId] = b.descargaEnId.split('|');
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
      data.ramales = (data.ramales || []).filter((r) => r.id !== ldId);
    }
    // 3. Ghost-marcador: debe vivir AQUÍ (superior) referenciando al inferior; quitar cualquier
    //    ghost viejo del layout anterior que siga en el piso del destino.
    const oldGhost = (lowerData.crossFloorGhosts || []).find(
      (g) => g.sourcePlanId === pid && g.sourceBajanteId === b.id,
    );
    if (oldGhost) {
      const newGhost: CrossFloorGhost = {
        ...oldGhost,
        id: `XFG_${lowerBajanteId}_${pid}`,
        code: lower.code || oldGhost.code,
        x: lower.x ?? oldGhost.x,
        y: lower.y ?? oldGhost.y,
        sourcePlanId: pid,
        sourceBajanteId: lowerBajanteId,
        targetBajanteId: b.id,
        layout: 2,
      };
      removeCrossFloorGhost(lowerPlanId, pid, b.id);
      writeCrossFloorGhost(pid, newGhost);
    }
    saveData(pid, data);
    touched = true;
    markAssocLayout(lowerPlanId);
  }
  if (touched) markAssocLayout(pid);
}

/** Al migrar/mover un Ldesvio de piso, su clave de aparatos (UDs) cambia de sufijo de plan —
 *  se re-acomoda para que las UDs del bajante lo sigan a donde viva el conector. */
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
  for (const [k, v] of Object.entries(map[from])) cur[k] = (cur[k] || 0) + (v as number);
  map[to] = cur;
  delete map[from];
  saveToStorage(APARATOS_BY_TRAMO_KEY, map);
}

/** Barrido global (layout nuevo): elimina los ramales LD_ que viven en un piso distinto al del
 *  bajante que porta su anillo — remanentes del layout viejo. */
/** Sanea labels de Ldesvio duplicados, vacíos o chocados con un ramal real (creados cuando
 *  `nextRamalLabel` no veía labels de LD): los re-etiqueta al siguiente consecutivo libre de
 *  su red. Solo cambia lo impreso — el id (`LD_...`) y sus claves de conteos no se tocan.
 *  Idempotente: sin duplicados no hace nada. @returns true si cambió algo. */
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
  // home: ldId -> piso del bajante que porta su anillo
  const home: Record<string, string> = {};
  for (const { pid, data } of plans) {
    for (const b of data.bajantes || []) {
      for (const d of Object.values(b.desplazamientos || {})) {
        if (d?.Ldesvio) home[d.Ldesvio] = pid;
      }
    }
  }
  for (const { pid, data } of plans) {
    const ramales = data.ramales || [];
    const misplaced = ramales.filter(
      (r) => isLdesvioRamalId(r.id) && home[r.id] && home[r.id] !== pid,
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
}
