// Recolección de basura de claves de conteos: TODO el estado mutable del sync vive aquí
// (co-localizado — partirlo entre hermanos lo rompe). Extraído verbatim de drawingSync.
import { loadFromStorage, saveToStorage } from '../services/storageService';
import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys';
import type { RawElement, SyncPlanInput, TraceData } from './drawingSyncTypes';
import { hasNumericPlanSuffix, isOrphanKey } from './drawingSyncBuilders';
// Recolección de basura de claves de conteos: TODO el estado mutable del sync vive aquí
// (co-localizado — partirlo entre hermanos lo rompe). Extraído verbatim de drawingSync.

let _loadedLive: { planId: string; ids: Set<string>; ts: number } | null = null;

// Ventana de gracia del GC: los elementos dibujados hace menos de un autosave (debounce
// 1500ms) aún no están NI en la caché de trazos (de donde sale validKeys) NI en los ids vivos
// registrados (se refrescan en el autosave). Durante la ventana, nada del piso cargado se
// borra; el próximo sync (ya con autosave dentro) los re-evalúa con datos reales.
const GC_GRACE_MS = 4000;

/** Registra los ids/códigos vivos del engine del piso cargado para el guard del GC. */
export function setSyncLoadedLiveIds(planId: string | number | null, ids: string[]): void {
  _loadedLive =
    planId == null ? null : { planId: String(planId), ids: new Set(ids), ts: Date.now() };
}

// Pisos cuya caché de trazos escribió ESTA sesión (autosave, guardado manual, prefetch
// desde BD). El GC solo borra claves de pisos elegibles: el cargado (guard de ids vivos)
// o uno fresco de esta sesión. Con caché vieja (cuota llena, otra sesión, crash) no se
// borra nada de ese piso — ese era el borrado de UDs del piso 2 (orig. usuario).
const freshTrazosPlans = new Set<string>();

/** Marca la caché de trazos de un piso como escrita por esta sesión (fresca para el GC). */
export function markPlanTrazosFresh(planId: string | number | null | undefined): void {
  if (planId == null || planId === 'work') return;
  freshTrazosPlans.add(String(planId));
}

/** Respaldo de lo último borrado por el GC (una sola entrada, se sobrescribe). */
const GC_BAK_KEY = 'gc_bak_ultimo';

/** ¿Puede el GC borrar esta clave? Solo pisos elegibles: el cargado (fuera de la ventana de
 *  gracia) o uno fresco de esta sesión. Las claves legado sin sufijo numérico conservan el
 *  criterio anterior. */
function canDeleteKey(key: string): boolean {
  if (!hasNumericPlanSuffix(key)) return true;
  const suffix = key.slice(key.lastIndexOf('_') + 1);
  if (_loadedLive && suffix === _loadedLive.planId) {
    if (Date.now() - _loadedLive.ts < GC_GRACE_MS) return false;
    return true;
  }
  return freshTrazosPlans.has(suffix);
}

/** Clave de store para un elemento en un piso (misma regla que loadTrazosFromDB: los
 *  stubs sintéticos AC-01-<calId> vuelven bajo `ac_<calId>_<plan>`). */
function fixtureStoreKey(net: string, id: string, planId: string | number): string {
  if (id.startsWith('AC-01-') && net === 'ac') return `ac_${id.slice('AC-01-'.length)}_${planId}`;
  return `${net}_${id}_${planId}`;
}

interface FixtureCarrier {
  id?: unknown;
  net?: unknown;
  fixtures?: Record<string, number>;
  hydroAcc?: { accesorios?: Record<string, number>; Lh?: number; nSalidas?: number };
  gasAcc?: Record<string, number>;
}

/** Re-ancla claves AUSENTES de aparatos/hidro/gas desde los fixtures de los trazos LOCALES
 *  (misma fusión que loadTrazosFromDB hace con la BD). Cubre el caso en que el store perdió
 *  claves pero los trazos aún traen sus fixtures (orig. usuario piso 2: símbolos intactos,
 *  conteos en 0). Solo rellena ausentes — jamás pisa. @returns claves restauradas. */
export function reanclarClavesDesdeTrazosLocales(plans: SyncPlanInput[]): number {
  if (!Array.isArray(plans) || plans.length === 0) return 0;
  const mergedAparatos = loadFromStorage<Record<string, Record<string, number>>>(
    APARATOS_BY_TRAMO_KEY,
    {},
  );
  const mergedHidro = loadFromStorage<
    Record<string, { accesorios: Record<string, number>; Lh: number; nSalidas: number }>
  >(HYDRO_DATA_STORAGE_KEY, {});
  const mergedGas = loadFromStorage<Record<string, Record<string, number>>>(GAS_ACC_KEY, {});
  let aparatosChanged = false;
  let hidroChanged = false;
  let gasChanged = false;
  let restored = 0;
  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    let data = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!data) continue;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as TraceData;
      } catch {
        continue;
      }
    }
    // Anti-resurrección (orig. usuario: Quitar/"-" sin efecto tras reentrar): la copia
    // `fixtures` de un RAMAL se escribe al CARGAR (BD) y nada la invalida al quitar el aparato
    // (el mapa es la verdad viva; el motor no la lee). Re-anclar esa copia stale devolvía el
    // conteo recién borrado en CADA sync — el símbolo sí desaparecía (campos del motor) pero la
    // cantidad y la tarjeta del menú volvían solas. Un ramal sin campo aparatoInicio/Fin ni
    // glifo de aparato (codo90rmSube/sifon en extremos) no puede tener aparato propio; los
    // espejos de salida y la herencia entre pisos (tampoco llevan campos) se re-escriben solos
    // desde su bajante dueño en el efecto de espejos del panel.
    // Anti-resurrección en la ventana del autosave (orig. usuario: "sigue pasando en ramales"):
    // tras borrar, el trazo LOCAL sigue stale (con el ramal borrado, sus campos y fixtures)
    // hasta el próximo saveWork (1.5 s). Si un sync corre en esa ventana (onDeleteHandler →
    // syncDrawings, panel de aparatos), el re-ancla por campos ve "aparato legítimo" y devuelve
    // la clave recién purgada. Para el piso CARGADO la verdad de vida es el engine (_loadedLive,
    // el mismo guard del GC): un id que ya no vive ahí NO se re-ancla. Para otros pisos no hay
    // verdad local — se conserva el comportamiento anterior.
    const elVivoEnCargado = (planIdStr: string, elId: string): boolean =>
      !_loadedLive || _loadedLive.planId !== planIdStr || _loadedLive.ids.has(elId);
    const ramalLlevaAparato = (r: FixtureCarrier & RawElement): boolean =>
      !!r.aparatoInicio ||
      !!r.aparatoFin ||
      r.accesorioInicio === 'codo90rmSube' ||
      r.accesorioFin === 'codo90rmSube' ||
      r.accesorioInicio === 'sifon' ||
      r.accesorioFin === 'sifon';
    for (const r of (data.ramales || []) as (FixtureCarrier & RawElement)[]) {
      if (!r || typeof r.id !== 'string' || typeof r.net !== 'string') continue;
      if (!elVivoEnCargado(String(plan.id), r.id)) continue;
      const apKey = fixtureStoreKey(r.net, r.id, String(plan.id));
      if (
        r.fixtures &&
        Object.keys(r.fixtures).length > 0 &&
        !mergedAparatos[apKey] &&
        ramalLlevaAparato(r)
      ) {
        mergedAparatos[apKey] = { ...r.fixtures };
        aparatosChanged = true;
        restored++;
      }
      if (
        r.hydroAcc &&
        (Object.keys(r.hydroAcc.accesorios ?? {}).length > 0 ||
          (r.hydroAcc.Lh ?? 0) > 0 ||
          (r.hydroAcc.nSalidas ?? 0) > 0) &&
        !mergedHidro[apKey]
      ) {
        mergedHidro[apKey] = r.hydroAcc as {
          accesorios: Record<string, number>;
          Lh: number;
          nSalidas: number;
        };
        hidroChanged = true;
      }
      if (r.gasAcc && Object.keys(r.gasAcc).length > 0 && !mergedGas[apKey]) {
        mergedGas[apKey] = { ...r.gasAcc };
        gasChanged = true;
      }
    }
    // Bajantes sin guard: sus UDs (bombas/cajas, claves net_<id>_<plan>) no tienen campo
    // portador equivalente — la copia del trazo es su única vía de restauración.
    for (const b of (data.bajantes || []) as FixtureCarrier[]) {
      if (!b || typeof b.id !== 'string' || typeof b.net !== 'string') continue;
      if (!elVivoEnCargado(String(plan.id), b.id)) continue;
      const apKey = fixtureStoreKey(b.net, b.id, String(plan.id));
      if (b.fixtures && Object.keys(b.fixtures).length > 0 && !mergedAparatos[apKey]) {
        mergedAparatos[apKey] = { ...b.fixtures };
        aparatosChanged = true;
        restored++;
      }
    }
  }
  if (aparatosChanged) saveToStorage(APARATOS_BY_TRAMO_KEY, mergedAparatos);
  if (hidroChanged) saveToStorage(HYDRO_DATA_STORAGE_KEY, mergedHidro);
  if (gasChanged) saveToStorage(GAS_ACC_KEY, mergedGas);
  return restored;
}
/** ¿Es una clave `<net>_<id>[_<plan>]` del piso cargado con id vivo en el engine? */
function isLoadedLiveKey(key: string): boolean {
  if (!_loadedLive) return false;
  const last = key.lastIndexOf('_');
  if (last <= 0) return false;
  const suffix = key.slice(last + 1);
  if (!/^\d+$/.test(suffix) || suffix !== _loadedLive.planId) return false;
  const base = key.slice(0, last);
  const first = base.indexOf('_');
  const id = first > 0 ? base.slice(first + 1) : base;
  return _loadedLive.ids.has(id);
}

/** Huérfanos vistos en esta sesión con ts del PRIMER avistamiento: el borrado exige ver la
 *  clave huérfana ≥GC_ORPHAN_MIN_MS. Motivo: writeSan y writeHydro corren GC en el MISMO
 *  round — con un Set, dos pasadas seguidas la borraban al instante si el área salía de
 *  validKeys, y la hidratación BD la resucitaba con valores viejos (ping-pong — orig. usuario:
 *  "aparece un momento y se borra" / "se resetean a los anteriores"). El tiempo real entre
 *  rounds de sync es lo que decide, no el número de pasadas. @returns true si ya se puede borrar. */
const GC_ORPHAN_MIN_MS = 1500;
const orphanSuspects = new Map<string, number>();
function shouldDeleteOrphan(key: string, stillOrphan: boolean): boolean {
  if (!stillOrphan) {
    orphanSuspects.delete(key);
    return false;
  }
  const first = orphanSuspects.get(key);
  if (first !== undefined) {
    if (Date.now() - first >= GC_ORPHAN_MIN_MS) {
      orphanSuspects.delete(key);
      return true;
    }
    return false;
  }
  orphanSuspects.set(key, Date.now());
  return false;
}

/** Clave `gas_AR…_<plan>` de un plan cuya caché de trazos NO trae campo `areas`: sin la lista
 *  no se puede PROBAR la orfandad (la pérdida puede ser de la caché — fila BD sin net vía
 *  rowToArea, escritor que suelte áreas —, no del área). No borrar. */
function areaSinPruebaDeOrfandad(key: string, sinAreas: Set<string>): boolean {
  const m = /^gas_(AR\d+)_(\d+)$/.exec(key);
  return !!m && sinAreas.has(m[2]);
}

export function performGarbageCollection(plans: SyncPlanInput[]) {
  if (!Array.isArray(plans) || plans.length === 0) return;
  const validKeys = new Set<string>();
  const validGasRamales = new Set<string>();
  const plansSinAreas = new Set<string>();
  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) {
      // Un plano sin trazos locales aún puede tener datos pendientes en la BD (recarga con
      // carga asíncrona, sesión sin guardar). Sin todos los planos legibles no se puede probar
      // que una clave sea huérfana; borrar aquí borra las UC/UD asignadas al recargar la página.
      return;
    }

    let data = raw;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as TraceData;
      } catch {
        continue;
      }
    }

    for (const r of data.ramales || []) {
      if (r && r.id && r.net) {
        // PUNTO 10: usar el MISMO mapeo de clave que reanclarClavesDesdeTrazosLocales y
        // loadTrazosFromDB (fixtureStoreKey) — el stub del calentador (`AC-01-<calId>`, net
        // 'ac') restaura `ac_<calId>_<plan>`, pero validKeys armaba `ac_AC-01-<calId>_<plan>`:
        // la clave era huérfana-para-GC y restaurable-para-reanclar → borrado/restauración en
        // CADA sync (ping-pong "GC sync: borradas" + Maximum update depth, orig. usuario).
        validKeys.add(fixtureStoreKey(r.net, r.id, String(plan.id)));
        if (r.net === 'gas') {
          validGasRamales.add(r.id);
        }
      }
    }

    for (const b of data.bajantes || []) {
      if (b && b.id && b.net) {
        validKeys.add(fixtureStoreKey(b.net, b.id, String(plan.id)));
        if (b.tipo === 'contador') {
          validKeys.add(`af_${b.id}_${plan.id}`);
        } else if (b.tipo === 'calentador') {
          validKeys.add(`ac_${b.id}_${plan.id}`);
        }
      }
    }

    // ÁREAS de sector (módulo Rejillas de ventilación): las claves gas_AR..._<plan> son
    // legítimas — sin esto el GC las borraba en cada sync (orig. usuario: "se resta uno o
    // se borra" al asignar aparatos al área desde el panel derecho).
    const areasRaw = (data as { areas?: unknown }).areas;
    if (!Array.isArray(areasRaw)) {
      // Sin campo areas en la caché no hay prueba de orfandad para gas_AR de este plan.
      plansSinAreas.add(String(plan.id));
    } else {
      for (const a of areasRaw as Array<{ id?: unknown; net?: unknown }>) {
        if (a && a.id && a.net) {
          validKeys.add(fixtureStoreKey(String(a.net), String(a.id), String(plan.id)));
        }
      }
    }
  }

  // 1. Clean APARATOS_BY_TRAMO_KEY
  const rawAparatos = loadFromStorage<Record<string, unknown>>(APARATOS_BY_TRAMO_KEY, {});
  const bakDeletedAparatos: Record<string, unknown> = {};
  let aparatosChanged = false;
  for (const key of Object.keys(rawAparatos)) {
    if (isLoadedLiveKey(key)) {
      orphanSuspects.delete(key);
      continue;
    }
    if (areaSinPruebaDeOrfandad(key, plansSinAreas)) {
      continue;
    }
    if (!canDeleteKey(key)) {
      continue;
    }
    if (!shouldDeleteOrphan(key, isOrphanKey(key, validKeys))) continue;
    bakDeletedAparatos[key] = rawAparatos[key];
    delete rawAparatos[key];
    aparatosChanged = true;
  }
  if (aparatosChanged) {
    saveToStorage(APARATOS_BY_TRAMO_KEY, rawAparatos);
  }

  // 2. Clean HYDRO_DATA_STORAGE_KEY
  const rawHidro = loadFromStorage<Record<string, unknown>>(HYDRO_DATA_STORAGE_KEY, {});
  const bakDeletedHidro: Record<string, unknown> = {};
  let hidroChanged = false;
  for (const key of Object.keys(rawHidro)) {
    if (isLoadedLiveKey(key)) {
      orphanSuspects.delete(key);
      continue;
    }
    if (!canDeleteKey(key)) {
      continue;
    }
    if (!shouldDeleteOrphan(key, isOrphanKey(key, validKeys))) continue;
    bakDeletedHidro[key] = rawHidro[key];
    delete rawHidro[key];
    hidroChanged = true;
  }
  if (hidroChanged) {
    saveToStorage(HYDRO_DATA_STORAGE_KEY, rawHidro);
  }

  // 3. Clean GAS_ACC_KEY (claves sin sufijo de plan: sin atribución, criterio anterior)
  const rawGas = loadFromStorage<Record<string, unknown>>(GAS_ACC_KEY, {});
  const bakDeletedGas: Record<string, unknown> = {};
  let gasChanged = false;
  for (const ramalId of Object.keys(rawGas)) {
    if (shouldDeleteOrphan(`gas:${ramalId}`, !validGasRamales.has(ramalId))) {
      bakDeletedGas[ramalId] = rawGas[ramalId];
      delete rawGas[ramalId];
      gasChanged = true;
    }
  }
  if (gasChanged) {
    saveToStorage(GAS_ACC_KEY, rawGas);
  }
  if (aparatosChanged || hidroChanged || gasChanged) {
    // Backup de la última tanda borrada (sin log: la consola spameaba en cada sync — orig. usuario).
    saveToStorage(GC_BAK_KEY, {
      ts: Date.now(),
      aparatos: bakDeletedAparatos,
      hidro: bakDeletedHidro,
      gas: bakDeletedGas,
    });
  }
}
