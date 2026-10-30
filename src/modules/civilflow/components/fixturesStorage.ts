/** Libros de aparatos en storage: conteo maestro por tramo (UC (Unidades de Consumo)/UD
 *  (Unidades de Desague)), fichas hidráulicas, accesorios gas y las fotos de lo propio de los
 *  espejos entre pisos. La puerta única que paneles, tablas y propagación consultan.
 *  Ej: loadAll()["af_RAF1_7"] -> { lav: 2 } (2 lavamanos en RAF1 del plano 7). */
import { NETS } from '../lib/PlanoEngine/PlanoState.ts';
import { APARATOS_DEF, UD_BASE_INIT, AF_UC_IDS, AC_UC_IDS } from '../constants';
import { loadFromStorage, saveToStorage } from '../services/storageService.ts';
import { bajanteLocalDe } from '../utils/bajanteLocal.ts';
import {
  GAS_ACC_KEY,
  APARATOS_BY_TRAMO_KEY,
  APARATOS_PROPIO_KEY,
  HYDRO_DATA_STORAGE_KEY,
} from '../constants/storage-keys.ts';

export const GAS_ID = 'gas';

/** Etiquetas de unidad que ve el usuario según la red: UC (Unidades de Consumo) en presión,
 *  UD (Unidades de Desague) en sanitarias y m³/h en gas. */
export const UNIDAD = {
  uc: 'UC',
  ud: 'UD',
  qgas: 'm³/h',
};

const SAN_UD_IDS = new Set(UD_BASE_INIT.map((d) => d.id));

/** El libro maestro de aparatos: clave de tramo (`<red>_<id>_<plano>`) → aparato → cantidad.
 *  Ej: { af_RAF1_7: { lav: 2 } } = 2 lavamanos en el ramal RAF1 del plano 7. */
export type CountsMap = Record<string, Record<string, number>>;
// ponytail: misma forma que utils/drawingSyncTypes.HidroDataEntry — una sola definición.
import type { HidroDataEntry } from '../utils/drawingSyncTypes.ts';
/** Re-exportado para que los consumidores de este módulo usen la única definición
 *  (utils/drawingSyncTypes). */
export type { HidroDataEntry };
/** Ficha hidráulica por clave de tramo: accesorios contados, Lh (longitud equivalente de los
 *  accesorios, en m) y nSalidas. */
export type HidroDataMap = Record<string, HidroDataEntry>;
/** Accesorios de gas por clave de tramo: accesorio → cantidad (codos, tees…) para las pérdidas
 *  por accesorios de la red gas. */
export type GasAccMap = Record<string, Record<string, number>>;

/** Lee el libro maestro de aparatos (APARATOS_BY_TRAMO_KEY) — la fuente que paneles, tablas y
 *  propagación consultan para saber cuántos aparatos hay en cada tramo. */
export function loadAll(): CountsMap {
  return loadFromStorage(APARATOS_BY_TRAMO_KEY, {}) as CountsMap;
}

/** Guarda el libro maestro de aparatos completo (reemplazo, no fusión). */
export function saveAll(map: CountsMap) {
  saveToStorage(APARATOS_BY_TRAMO_KEY, map);
}

/** Lee las fichas hidráulicas por tramo (accesorios + Lh + nSalidas). */
export function loadHidroData(): HidroDataMap {
  return loadFromStorage(HYDRO_DATA_STORAGE_KEY, {});
}

/** Guarda las fichas hidráulicas por tramo. */
export function saveHidroData(map: HidroDataMap) {
  saveToStorage(HYDRO_DATA_STORAGE_KEY, map);
}

/** Lee los accesorios de gas por tramo y PODA las entradas vacías o en ceros — un tramo sin
 *  accesorios no debe aparecer en la tabla de gas ni sumar pérdidas. */
export function loadGasAcc(): GasAccMap {
  const raw = loadFromStorage<GasAccMap>(GAS_ACC_KEY, {});
  const next: GasAccMap = { ...raw };
  for (const [tramoId, map] of Object.entries(next)) {
    if (!map || typeof map !== 'object') continue;
    const vals = Object.values(map).filter((v) => typeof v === 'number');
    if (vals.length === 0 || vals.every((v) => v <= 0)) {
      delete next[tramoId];
    }
  }
  return next;
}

/** Guarda los accesorios de gas por tramo. */
export function saveGasAcc(map: GasAccMap) {
  saveToStorage(GAS_ACC_KEY, map);
}

type ApUnitKey = 'qgas' | 'uc_ac' | 'uc_af' | 'ud';

/** Qué unidad maneja una red: 'qgas' en gas, 'uc_af'/'uc_ac' (UC (Unidades de Consumo) de af
 *  (Agua Fria)/ac (Agua Caliente)) y 'ud' en sanitarias.
 *  @param netId - id de la red ('af', 'ac', 'gas', 'san'…).
 *  @returns la clave de unidad para leer el catálogo, o null si la red no cuenta aparatos. */
export function unitFor(netId: string): ApUnitKey | null {
  const net = NETS.find((n) => n.id === netId);
  if (!net) return null;
  if (netId === GAS_ID) return 'qgas';
  if (net.ucType === 'uc') return netId === 'ac' ? 'uc_ac' : 'uc_af';
  if (net.ucType === 'ud') return 'ud';
  return null;
}

/** ¿Este aparato aplica a esta red? En gas solo aparatos del grupo 'g' con caudal; en
 *  sanitarias solo los que tienen UD; en af/ac solo los del catálogo de UC correspondiente.
 *  Ej: la estufa (grupo 'g') solo aparece en la red gas.
 *  @returns true si el panel de esa red debe listar el aparato. */
export function esAplicable(
  ap: (typeof APARATOS_DEF)[number],
  netId: string,
  unitKey: ApUnitKey | null,
) {
  if (netId === GAS_ID) return ap.grupo === 'g' && (ap.qgas || 0) > 0;
  if (unitKey === 'ud') return SAN_UD_IDS.has(ap.id);
  if (unitKey === 'uc_af') return AF_UC_IDS.includes(ap.id);
  if (unitKey === 'uc_ac') return AC_UC_IDS.includes(ap.id);
  return false;
}

/** Elemento del dibujo seleccionable en el panel de aparatos (ramal, bajante, montante, caja):
 *  lo mínimo que el panel necesita para identificarlo y calcular su tolerancia geométrica. */
export interface SelectableTarget {
  id?: string;
  tipo?: string;
  label?: string;
  code?: string;
  mergesFrom?: [string, string];
  net?: string;
  pts?: number[][];
  _tribReversed?: boolean;
}

/** ¿Puede este elemento recibir conteo de aparatos? Cubre ramales/bajantes/tributarios (por
 *  prefijo de id), montantes, cajas san/ll, el LD_ entre pisos (espejo de solo lectura) y
 *  calentadores. Ej: 'RAF1' o 'MON1_ac' → true; una línea guía → false. */
export function isCountableTarget(el: SelectableTarget | null): boolean {
  if (!el) return false;
  return (
    el.id?.startsWith('R') ||
    el.id?.startsWith('B') ||
    el.id?.startsWith('T') ||
    // MONTANTES (orig. usuario): panel de aparatos con las UDs que se les propagan — igual que
    // bajantes (original/fantasma/asociado). Los ids `MON{n}_{red}` no entran por prefijo.
    el.tipo === 'montante' ||
    el.id?.startsWith('MON') ||
    // Cajas CAN/CALL (aguas negras/lluvias): panel de UDs en modo solo lectura.
    el.tipo === 'caja_san' ||
    el.tipo === 'caja_ll' ||
    // Ldesvio entre pisos: espejo de las UDs del bajante (seleccionable pero de solo lectura).
    el.id?.startsWith('LD_') ||
    el.tipo === 'calentador'
  );
}

interface BajanteLikeSalida {
  id: string;
  code?: string;
  net: string;
  x: number;
  y: number;
  /** Piso dueño del bajante (las proyecciones de entrepiso traen el ajeno). */
  pisoBase?: string;
  _circ?: { r?: number };
  recibeDeIds?: string[];
  alimentaIds?: string[];
}
interface RamalLikeSalida {
  id: string;
  net?: string;
  tipo?: string;
  pts?: number[][];
  _tribReversed?: boolean;
  ini?: string;
  fin?: string;
}

/** JSON con claves ordenadas (comparar mapas sin falsos positivos por orden de inserción).
 *  Se usa para recargar estado solo si el contenido cambió y no entrar en loop sync→reload. */
export function stableStringify(m: unknown): string {
  return JSON.stringify(m, (_k, v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return v as unknown;
    const o = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) sorted[k] = o[k];
    return sorted;
  });
}
/** Reduce el libro de herencia cross-floor (`ucAplicado`) a UN mapa por aparato: el MÁXIMO de cada entrada.
 * El libro guarda una entrada por clave destino (+ la del Ldesvio (ramal desvio entrepisos)) y todas contienen el MISMO agregado aplicado — sumarlas mostraba 2×/3× la herencia (12 → 24). */
export function libroHeredado(baj: {
  ucAplicado?: Record<string, Record<string, number>>;
}): Record<string, number> {
  let out: Record<string, number> = {};
  for (const m of Object.values(baj.ucAplicado || {})) out = mezclarMax(out, m);
  return out;
}

/** Foto de lo PROPIO de cada clave espejo de un bajante entre pisos (sin la herencia). */
export interface PropioBajanteSnap {
  uc: Record<string, Record<string, number>>;
  hidro: Record<string, Record<string, number>>;
}
/** `${planId}|${bajId}` → foto de sus claves espejo. */
export type PropioSnapMap = Record<string, PropioBajanteSnap>;

/** Foto persistida de lo propio de los espejos entre pisos (ver APARATOS_PROPIO_KEY). */
export function loadPropioSnap(): PropioSnapMap {
  return loadFromStorage<PropioSnapMap>(APARATOS_PROPIO_KEY, {}) || {};
}

/** Guarda la foto de lo propio de los espejos entre pisos (la escritura de loadPropioSnap). */
export function savePropioSnap(map: PropioSnapMap): void {
  saveToStorage(APARATOS_PROPIO_KEY, map);
}

/** Lo PROPIO de una clave espejo = disco menos lo que el libro dice haber heredado.
 *  Si el libro no tiene entrada para esa clave (doc viejo, escritura perdida), manda la foto
 *  guardada: tomar el disco entero volvería a sumar la herencia en cada pase y el conteo
 *  crecería sin techo al cambiar de piso. Ej: cur {lav:3} con libro {lav:2} → propio {lav:1}.
 *  @param cur - conteos actuales de la clave.
 *  @param libroPrev - lo que la herencia anterior escribió en esa clave.
 *  @param foto - foto de lo propio guardada en el pase anterior.
 *  @param tieneEntradaLibro - ¿el libro trae una entrada (aunque sea vacía) para la clave? */
export function propioDeClave(
  cur: Record<string, number> | undefined,
  libroPrev: Record<string, number> | undefined,
  foto: Record<string, number> | undefined,
  tieneEntradaLibro: boolean,
): Record<string, number> {
  if (!tieneEntradaLibro && foto) return { ...foto };
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(cur || {}), ...Object.keys(libroPrev || {})])) {
    const v = Math.max(0, ((cur || {})[k] || 0) - ((libroPrev || {})[k] || 0));
    if (v > 0) out[k] = v;
  }
  return out;
}

/** Valor a espejar en los ramales de SALIDA de un bajante: EXACTAMENTE lo que muestra su panel — libro de herencia si lo hay (bajante asociado entre
 * pisos), si no el agregado del árbol. null = nada que copiar (vacío). */
export function aggParaEspejoSalida(
  treeAgg: Record<string, number>,
  libro: Record<string, number>,
): Record<string, number> | null {
  const agg = Object.keys(libro).length ? libro : treeAgg;
  return Object.keys(agg).length ? { ...agg } : null;
}

/** Ids de los ramales que SALEN (nacen) del bajante/caja dado.
 * La referencia explícita manda: un ramal de salida con `_tribReversed (flag de flujo invertido en tributario)` invertía la geometría cola/cabeza y dejaba de detectarse — el agregado del bajante volvía a caminar su subárbol y re-fusionaba las UDs (Unidades de Desague) en su propia clave de salida (crecían en cada pasada, orig. usuario: "la caja AN duplica las UDs (Unidades de Desague) del ramal de salida"). */
export function idsSalidasDeBajante(
  baj: BajanteLikeSalida,
  ramales: RamalLikeSalida[],
  zoom: number,
): Set<string> {
  const out = new Set<string>();
  const tol = (baj._circ?.r || 8 * (zoom || 1)) / (zoom || 1) + 1;
  const code = baj.code || baj.id;
  for (const r of ramales) {
    if (r.tipo === 'tributario' || (r.net ?? '') !== baj.net) continue;
    // Geometría cola/cabeza (con _tribReversed): la usa el veto entrante de abajo. Un ramal sin
    // puntos (mock viejo, doc a medio hidratar) NO se descarta: la referencia explícita
    // (fin/ini/alimentaIds) decide sola.
    const pts = r.pts && r.pts.length >= 2 ? r.pts : null;
    const t = pts ? (r._tribReversed ? pts[pts.length - 1] : pts[0]) : null;
    const h = pts ? (r._tribReversed ? pts[0] : pts[pts.length - 1]) : null;
    const tailAt = !!t && Math.hypot(t[0] - baj.x, t[1] - baj.y) < tol;
    const headAt = !!h && Math.hypot(h[0] - baj.x, h[1] - baj.y) < tol;
    // ENTRANTE (precedencia 3b, igual que la entrega de montantes) — gana a cualquier lista:
    // (a) su FIN es el código del elemento; (b) su CABEZA descarga sobre él y la cola está
    // lejos. Sin el veto geométrico, un ramal en un `alimentaIds` rancio (era de roles
    // invertidos) seguía siendo "salida" aunque terminara en el bajante, y el espejo
    // re-fusionaba el agregado del elemento (que camina recibeDeIds e incluye la clave del
    // entrante) en su propia clave: crecía/reescría en cada pase de espejos (orig. usuario
    // RS2-P2 → BAN1-P2: la BD recargaba el valor y el Ldesvio del piso de abajo arrastraba
    // el mismo grupo).
    if (r.fin && r.fin === code) continue;
    // Nace aquí (dibujado desde el elemento): la evidencia más fuerte de salida.
    if (r.ini && r.ini === code) {
      out.add(r.id);
      continue;
    }
    // Listado como receptor sin nacer aquí: entrante también (el checkbox de asociación) —
    // gana sobre un `alimentaIds` rancio de la misma era.
    // (b) CABEZA sobre el elemento y cola lejos: entrante geometrico. Va DESPUES del `ini`
    // porque `_tribReversed` invierte cola/cabeza en los ramales que nacen aqui.
    if (headAt && !tailAt) continue;
    if ((baj.recibeDeIds || []).includes(r.id)) continue;
    if ((baj.alimentaIds || []).includes(r.id)) {
      out.add(r.id);
      continue;
    }
    // Sin geometría útil no queda más evidencia que la referencia (ya resuelta arriba).
    if (!t || !h) continue;
    if (tailAt && !headAt) {
      out.add(r.id);
      continue;
    }
    // Caso ambiguo (AMBOS extremos dentro de la tolerancia — p.ej. cajas, cuyo _circ es la
    // semidiagonal del cuadro y se traga ramales cortos): decide la DIRECCIÓN DE FLUJO —
    // es salida si el extremo de DESCARGA está lejos del elemento.
    if (tailAt && headAt) {
      const hDist = Math.hypot(h[0] - baj.x, h[1] - baj.y);
      const tDist = Math.hypot(t[0] - baj.x, t[1] - baj.y);
      if (hDist > tDist) out.add(r.id);
    }
  }
  return out;
}

/** Ramales que SALEN de un bajante (por id): delega en idsSalidasDeBajante con el zoom del
 *  motor. Casa natural del helper que el panel envolvía en useCallback solo por engineRef.
 *  Resuelve el bajante del PISO ABIERTO: con una proyección de otro piso primero, el `find`
 *  plano devolvía sus listas y el espejo escribía claves que no son de este piso. */
export function salidasDeBajante(
  eng: {
    bajantes: BajanteLikeSalida[];
    ramales: RamalLikeSalida[];
    zoom: number;
    nivelActual?: { label?: string } | null;
  } | null,
  bajId: string,
): Set<string> {
  const baj = bajanteLocalDe(eng, bajId);
  if (!eng || !baj) return new Set<string>();
  return idsSalidasDeBajante(baj, eng.ramales, eng.zoom || 1);
}

/** Espeja `next` sobre la clave (reemplazo, no fusión) y devuelve si cambió — comparación JSON contra el valor en disco. */
export function syncMirrorKey(
  disk: Record<string, Record<string, number>>,
  key: string,
  next: Record<string, number>,
  deleteEmpty: boolean,
): boolean {
  if (!Object.keys(next).length) {
    if (deleteEmpty && disk[key]) {
      delete disk[key];
      return true;
    }
    return false;
  }
  if (stableStringify(disk[key] || {}) === stableStringify(next)) return false;
  disk[key] = { ...next };
  return true;
}

import { leerHeredadosPresion, mezclarMax } from '../utils/propagation';

/** Accesorios hidráulicos (codos, tees) guardados del tramo; entrada vacía si no tiene. */
export function hidroDeClave(hidroData: HidroDataMap, storageKey: string | null): HidroDataEntry {
  if (!storageKey) return { accesorios: {}, Lh: 0, nSalidas: 0 };
  return hidroData[storageKey] || { accesorios: {}, Lh: 0, nSalidas: 0 };
}

/** Total de UD (Unidades de Desague) del tramo: suma de cada aparato (cuántos hay × las UD que gasta cada uno). */
export function totalDeUnidades(
  items: readonly { id: string; [campo: string]: unknown }[],
  currentMap: Record<string, number> | undefined,
  unitKey: string | null,
  storageKey: string | null,
): number {
  if (!storageKey) return 0;
  let s = 0;
  for (const ap of items) {
    const u = (unitKey ? (ap[unitKey] as number | undefined) : undefined) || 0;
    s += (currentMap?.[ap.id] || 0) * u;
  }
  return s;
}

/** Unidades MANUALES propias de este tramo: la carga de la clave MENOS lo heredado por
 *  propagación (antes se sumaba la carga completa y un tramo con solo heredado no
 *  podía recibir su primer aparato manual). */
export function ownTotalDe(counts: CountsMap, storageKey: string | null): number {
  if (!storageKey) return 0;
  const libro = leerHeredadosPresion(storageKey);
  return Object.entries(counts[storageKey] || {}).reduce(
    (s, [k, v]) => s + Math.max(0, v - (libro[k] || 0)),
    0,
  );
}

/** ¿El aparato lo asignó el usuario acá (y no es solo una copia heredada de la propagación)? */
export function esPropioDe(counts: CountsMap, storageKey: string | null, apId: string): boolean {
  if (!storageKey) return false;
  const libro = leerHeredadosPresion(storageKey);
  return (counts[storageKey]?.[apId] || 0) - (libro[apId] || 0) > 0;
}
