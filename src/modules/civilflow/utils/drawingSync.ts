import { matManning } from '../constants';
import { loadFromStorage, saveToStorage } from '../services/storageService';
import { devError } from '../../../utils/devError';
import {
  TRAZOS_PREFIX,
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  HYDRO_DATA_STORAGE_KEY,
  HYDRO_SYNC_KEY,
  SAN_SYNC_KEY,
  HYDRO_FAMILIES,
  SAN_FAMILIES,
} from '../constants/storage-keys';
import { diamPulgFromLabel } from './diamPulgFromLabel';

/** Elemento de dibujo crudo cargado de los datos de trazo en localStorage. */
export interface RawElement {
  id: string;
  net: string;
  tipo: string;
  padre?: string | null;
  totalL?: number;
  ini?: string;
  fin?: string;
  diametro?: string;
  pendiente?: number;
  material?: string;
  dz?: string;
  lvert?: string;
  piso?: string;
  pts?: number[][];
  nSalidas?: number;
  descargaEnId?: string | null;
  code?: string;
  dNominal?: string;
  hVert?: number;
  recibeDeIds?: string[];
  mergesFrom?: [string, string];
  alimentaIds?: string[];
  area_m2?: number;
  pisoBase?: string;
  pisoCima?: string;
  nptBase?: number;
  nptCima?: number;
  bajR?: number;
  bajDprop?: unknown;
  ventDprop?: unknown;
  bajLong?: unknown;
  bajFDarcy?: unknown;
  label?: string;
  acoDiam?: string;
  accesorioInicio?: string;
  accesorioFin?: string;
  aparatoInicio?: string;
  aparatoFin?: string;
  diametroInicio?: string;
  diametroFin?: string;
  accMed?: Record<string, string>;
  caudal?: number;
  /** Ramal de canal: id del canal del que nace (extremo inicial dentro de su rect). */
  esCanalId?: string | null;
  labelX?: number;
  labelY?: number;
  /** Flag de inversión de dirección para redes pts-driven (dos nombres según la vía de guardado). */
  _tribReversed?: boolean;
  trib_reversed?: boolean;
  [key: string]: unknown;
}

/** Estructura de datos de dibujo sincronizado guardada en las claves sync de localStorage. */
export interface DrawingData {
  planes?: Record<string, unknown>;
  aparatosByTramo?: Record<string, unknown>;
  hidroData?: Record<string, unknown>;
  updatedAt?: number;
  id?: string | number;
  nivel?: string | number | null;
  name?: string;
  npt?: number;
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

/** Descriptor de plano de entrada para operaciones de sync. */
export interface SyncPlanInput {
  id: string | number;
  name?: string;
  nivel?: string | number | null;
  npt?: number;
  status?: string;
}

interface TraceData {
  ramales?: RawElement[];
  bajantes?: RawElement[];
  [key: string]: unknown;
}

interface HidroDataEntry {
  accesorios: Record<string, number>;
  Lh: number;
  nSalidas: number;
}

interface RamalSyncObj {
  id: string;
  label: string;
  tipo: string;
  padre: string | null;
  totalL: number;
  ini: string;
  fin: string;
  diametro: string;
  diamPulg: number;
  pendiente: number;
  material: string;
  maning: number | null;
  piso: string;
  _aparatosKey: string;
  _net: string;
  nSalidas: number;
  descargaEnId: string | null;
  aparatoInicio: string;
  aparatoFin: string;
  caudal?: number;
  accMed?: Record<string, string>;
  yeeDobleAt?: number[][];
}

interface SyncDataResult {
  planes: Record<string, unknown>;
  aparatosByTramo?: Record<string, unknown>;
  hidroData?: Record<string, unknown>;
  updatedAt: number;
}

function collectAparatos(out: SyncDataResult) {
  const rawAparatos = loadFromStorage<Record<string, unknown>>(APARATOS_BY_TRAMO_KEY, {});
  out.aparatosByTramo = {};
  for (const [key, counts] of Object.entries(rawAparatos)) {
    if (!counts || typeof counts !== 'object') continue;
    out.aparatosByTramo[key] = counts;
  }
}

function inferNivelFromDrawing(data: TraceData): string {
  const all = [...(data.ramales || []), ...(data.bajantes || [])];
  for (const el of all) {
    if (el.piso) return el.piso;
  }
  return '0';
}

function buildPrefixedSyncData(plans: SyncPlanInput[], families: Set<string>): SyncDataResult {
  const out: SyncDataResult = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  const rawHidro =
    loadFromStorage<Record<string, HidroDataEntry>>(HYDRO_DATA_STORAGE_KEY, {}) || {};

  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as TraceData;
      } catch {
        continue;
      }
    }
    const nivel = String(plan.nivel ?? inferNivelFromDrawing(data));

    for (const family of families) {
      const ramales: unknown[] = [];
      for (const r of data.ramales || []) {
        if (r.net === family) {
          const rKey = family + '_' + r.id + '_' + plan.id;

          ramales.push({
            id: r.id,
            label: r.label || r.id,
            tipo: r.tipo,
            padre: r.padre || null,
            totalL: r.totalL || 0,
            ini: r.ini || '',
            fin: r.fin || '',
            diametro: r.diametro || '',
            diamPulg: diamPulgFromLabel(r.diametro),
            pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
            material: r.material || '',
            maning: matManning(r.material || ''),
            dz: parseFloat(r.dz ?? r.lvert ?? '0') || 0,
            piso: r.piso || nivel,
            _aparatosKey: rKey,
            _net: r.net || family,
            pts: r.pts || [],
            lvert: parseFloat(r.lvert ?? r.dz ?? '0') || 0,
            nSalidas: r.nSalidas || 0,
            descargaEnId: r.descargaEnId || null,
            accesorioInicio: r.accesorioInicio || '',
            accesorioFin: r.accesorioFin || '',
            diametroInicio: r.diametroInicio || '',
            diametroFin: r.diametroFin || '',
            aparatoInicio: r.aparatoInicio || '',
            aparatoFin: r.aparatoFin || '',
            yeeDobleAt: (r as { yeeDobleAt?: number[][] }).yeeDobleAt,
          });
        }
      }
      // Clave con planId: dos planos podían compartir nivel (o caer ambos al fallback '0'
      // sin confirmar) y el segundo SOBRESCRIBÍA al primero — sus ramales desaparecían de
      // las tablas. El nivel viaja en el valor; los lectores ya lo prefieren a la clave.
      const bajantes = (data.bajantes || [])
        .filter((b) => b.net === family)
        .map((b) => ({
          id: b.id,
          code: b.code || b.id,
          tipo: b.tipo,
          net: b.net,
          x: b.x,
          y: b.y,
          pisoBase: b.pisoBase,
          pisoCima: b.pisoCima,
        }));
      // Mantener el plano prefijado incluso con cero ramales cuando el piso aloja bajantes (p.
      // ej. un calentador anclado en el dibujo AF sin ramal AC dibujado aún) — buildTramos
      // genera el stub sintético AC-01-{calId} por plano prefijado, y sin él los fixtures del
      // calentador nunca llegan a las tablas de selección de calentador.
      if (ramales.length === 0 && bajantes.length === 0) continue;
      out.planes[`${family}_${nivel}_${plan.id}`] = {
        planoId: plan.id,
        planoName: plan.name || '',
        nivel,
        npt: plan.npt ?? parseInt(nivel),
        ramales,
        bajantes,
      };
    }
  }

  collectAparatos(out);

  out.hidroData = {};
  for (const [key, val] of Object.entries(rawHidro)) {
    out.hidroData[key] = val;
  }

  return out;
}

function buildNonPrefixedSyncData(plans: SyncPlanInput[], families: Set<string>): SyncDataResult {
  const out: SyncDataResult = { planes: {}, updatedAt: Date.now() };
  if (!Array.isArray(plans)) return out;

  for (const plan of plans) {
    if (!plan || plan.id === undefined) continue;
    const raw = loadFromStorage<TraceData | null>(TRAZOS_PREFIX + plan.id, null);
    if (!raw) continue;
    let data = raw;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data) as TraceData;
      } catch {
        continue;
      }
    }
    const nivel = String(plan.nivel ?? inferNivelFromDrawing(data));

    const ramales: unknown[] = [];
    const bajantes: unknown[] = [];
    for (const r of data.ramales || []) {
      if (families.has(r.net)) {
        const rKey = r.net + '_' + r.id + '_' + plan.id;
        const ramalObj: RamalSyncObj = {
          id: r.id,
          label: r.label || r.id,
          tipo: r.tipo,
          padre: r.padre || null,
          totalL: r.totalL || 0,
          ini: r.ini || '',
          fin: r.fin || '',
          diametro: r.diametro || '',
          diamPulg: diamPulgFromLabel(r.diametro),
          pendiente: typeof r.pendiente === 'number' ? r.pendiente : 0,
          material: r.material || '',
          maning: matManning(r.material || ''),
          piso: r.piso || nivel,
          _aparatosKey: rKey,
          _net: r.net,
          nSalidas: r.nSalidas || 0,
          descargaEnId: r.descargaEnId || null,
          aparatoInicio: r.aparatoInicio || '',
          aparatoFin: r.aparatoFin || '',
        };
        if (r.caudal !== undefined) ramalObj.caudal = r.caudal;
        if (r.accMed) ramalObj.accMed = r.accMed;
        const yeeRaw = (r as { yeeDobleAt?: number[][] }).yeeDobleAt;
        if (yeeRaw) ramalObj.yeeDobleAt = yeeRaw;
        ramales.push(ramalObj);
      }
    }
    for (const b of data.bajantes || []) {
      if (families.has(b.net)) {
        const bKey = b.net + '_' + b.id + '_' + plan.id;
        bajantes.push({
          id: b.id,
          code: b.code || b.id,
          tipo: b.tipo || 'bajante',
          dNominal: b.dNominal || '',
          diamPulg: diamPulgFromLabel(b.dNominal),
          hVert: b.hVert || 0,
          material: b.material || '',
          maning: matManning(b.material || ''),
          _aparatosKey: bKey,
          _net: b.net,
          recibeDeIds: b.recibeDeIds || [],
          descargaEnId: b.descargaEnId || null,
          area_m2: b.area_m2 || 0,
          pisoBase: b.pisoBase || '',
          pisoCima: b.pisoCima || '',
          nSalidas: b.nSalidas || 0,
          bajR: b.bajR ?? 7 / 24,
          bajDprop: b.bajDprop,
          ventDprop: b.ventDprop,
          bajLong: b.bajLong,
          bajFDarcy: b.bajFDarcy,
          aparato: b.aparato || '',
        });
      }
    }
    if (ramales.length === 0 && bajantes.length === 0) continue;
    out.planes[String(plan.id)] = {
      planoId: plan.id,
      planoName: plan.name || '',
      nivel: String(plan.nivel || ''),
      npt: plan.npt || 0,
      ramales,
      bajantes,
    };
  }

  collectAparatos(out);

  return out;
}

export const hasNumericPlanSuffix = (key: string): boolean => {
  const lastUnderscore = key.lastIndexOf('_');
  return lastUnderscore > 0 && /^\d+$/.test(key.slice(lastUnderscore + 1));
};

// Una clave aparato/hidro es huérfana solo si el ramal/bajante NO existe en NINGÚN plano
// legible: se conserva si algún key válido coincide exactamente (clave `net_id_planId` con su
// plan) o comparte el prefijo del elemento (`net_id`, o el mismo `net_id` en otro plan — un
// plan puede tener trazos locales desactualizados y re-sincronizarse después desde la BD).
export const isOrphanKey = (key: string, validKeys: Set<string>): boolean => {
  const base = hasNumericPlanSuffix(key) ? key.slice(0, key.lastIndexOf('_')) : key;
  for (const vk of validKeys) {
    if (vk === key || vk.startsWith(base + '_')) return false;
  }
  return true;
};

// Registro del piso CARGADO (lo escribe el visor antes de cada sincronización): ids/códigos
// vivos del engine del plano activo. El GC construye sus claves válidas desde las cachés
// locales de los pisos; si la caché del piso cargado quedó vieja (el loader la puede reemplazar
// por la copia de BD en cualquier momento), las claves de aparatos/hidro de ramales recientes
// parecían huérfanas y se borraban — "recargar reseteaba las UDs a 0" (orig. usuario). Con el
// guard, una clave del piso cargado cuyo id exista en el engine nunca se borra.
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

function performGarbageCollection(plans: SyncPlanInput[]) {
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

function buildSyncData(
  plans: SyncPlanInput[],
  families: Set<string>,
  prefix: string,
  _storageKey: string,
): SyncDataResult {
  try {
    // Re-anclar primero: si el store perdió claves pero los trazos traen fixtures, se
    // restauran ANTES de evaluar huérfanos (si no, el GC las vería huérfanas... no las
    // borraría con caché vieja, pero tampoco volverían solas — orig. usuario piso 2).
    reanclarClavesDesdeTrazosLocales(plans);
    performGarbageCollection(plans);
  } catch (e) {
    devError('Garbage collection error:', e);
  }

  return prefix
    ? buildPrefixedSyncData(plans, families)
    : buildNonPrefixedSyncData(plans, families);
}

/**
 * Construye y persiste los datos de sync de dibujo hidráulico (af/ac) a partir de los datos de
 * trazo del plano. Corre la recolección de basura de claves aparato/hydro/gas huérfanas antes
 * de sincronizar.
 * @param plans - Array de descriptores de plano.
 * @returns El SyncDataResult construido o null ante error.
 */
export function writeHydroDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, HYDRO_FAMILIES, 'h', HYDRO_SYNC_KEY);
    saveToStorage(HYDRO_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_hidro_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    devError('writeHydroDrawingSync error:', e);
    return null;
  }
}

/**
 * Lee los datos de sync de dibujo hidráulico (af/ac) persistidos de localStorage.
 * @returns Datos de sync con planes, aparatosByTramo, hidroData, updatedAt.
 */
export function readHydroDrawingSync() {
  return loadFromStorage(HYDRO_SYNC_KEY, {
    planes: {},
    aparatosByTramo: {},
    hidroData: {},
    updatedAt: 0,
  }) as {
    planes: Record<string, unknown>;
    aparatosByTramo: Record<string, unknown>;
    hidroData: Record<string, unknown>;
    updatedAt: number;
  };
}

/**
 * Construye y persiste los datos de sync de dibujo sanitario (san/ll/vent) a partir de los datos
 * de trazo del plano. Corre la recolección de basura de claves aparato/hydro/gas huérfanas antes
 * de sincronizar.
 * @param plans - Array de descriptores de plano.
 * @returns El SyncDataResult construido o null ante error.
 */
export function writeSanDrawingSync(plans: SyncPlanInput[]) {
  try {
    const data = buildSyncData(plans, SAN_FAMILIES, '', SAN_SYNC_KEY);
    saveToStorage(SAN_SYNC_KEY, data);
    window.dispatchEvent(new CustomEvent('civilflow_san_sync_changed', { detail: data }));
    return data;
  } catch (e) {
    devError('writeSanDrawingSync error:', e);
    return null;
  }
}

/**
 * Lee los datos de sync de dibujo sanitario (san/ll/vent) persistidos de localStorage.
 * @returns Datos de sync con planes, aparatosByTramo, updatedAt.
 */
export function readSanDrawingSync() {
  return loadFromStorage(SAN_SYNC_KEY, { planes: {}, aparatosByTramo: {}, updatedAt: 0 }) as {
    planes: Record<string, unknown>;
    aparatosByTramo: Record<string, unknown>;
    updatedAt: number;
  };
}
