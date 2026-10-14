/** Claves compuestas del módulo (track C): un solo lugar para construir y partir.
 *  Hoja pura, cero dependencias. Reglas:
 *  - construir SIEMPRE con los constructores; partir SIEMPRE con los parseadores;
 *  - `lastIndexOf`, nunca `split` (los ids traen `-` y `_`: AC-01-X-P1, MAF1_af);
 *  - el legado sin sufijo/plano se conserva legible (dibu jos viejos deben cargar igual).
 */

/** Familias de red con conteos por tramo. */
export type Fam = 'san' | 'll' | 'vent' | 'af' | 'ac' | 'gas';

/** PlanId normalizado a string en el borde (los planos son bigint en BD, string en keys). */
export type PlanId = string;

/** `${fam}_${id}_${plan}` — stores de conteos (aparatos/hidro/gas). */
export type CountKey = `${Fam}_${string}_${PlanId}`;
/** `${id}-${plan}` — `_key` de Tramo. */
export type TramoKey = `${string}-${PlanId}`;
/** `${plan}|${id}` — punteros entrepisos (descargaEnId/origenId/bombaEnId...). */
export type Ptr = `${PlanId}|${string}`;

/**
 * Clave de store para un elemento en un piso (misma regla que loadTrazosFromDB: los
 * stubs sintéticos AC-01-<calId> vuelven bajo `ac_<calId>_<plan>`).
 * @param net - familia de red.
 * @param id - id del elemento.
 * @param planId - plano dueño.
 * @returns clave de conteos.
 */
export function countKey(net: string, id: string, planId: string | number): string {
  if (id.startsWith('AC-01-') && net === 'ac') return `ac_${id.slice('AC-01-'.length)}_${planId}`;
  return `${net}_${id}_${planId}`;
}

/**
 * Puntero entrepisos `plan|id`.
 * @param planId - plano dueño.
 * @param id - id del elemento.
 * @returns puntero.
 */
export function ptr(planId: string | number, id: string): string {
  return `${planId}|${id}`;
}

/**
 * Parte `fam_id_plan` en [fam, id, plan|null]. El id puede traer `_` (MAF1_af):
 * se corta por el ÚLTIMO guion bajo y el plan debe ser numérico.
 * @param key - clave a partir.
 * @returns tupla [familia, id, planId o null si legado/sin sufijo].
 */
export function splitCount(key: string): [string, string, string | null] {
  const i = key.lastIndexOf('_');
  if (i <= 0) return [key, '', null];
  const tail = key.slice(i + 1);
  if (!/^\d+$/.test(tail)) return [key, '', null];
  const head = key.slice(0, i);
  const j = head.indexOf('_');
  if (j <= 0) return [head, '', tail];
  return [head.slice(0, j), head.slice(j + 1), tail];
}

/**
 * Parte `id-planId` en [id, plan]. El id puede traer guiones (AC-01-X-P1):
 * se corta por el ÚLTIMO guion.
 * @param key - clave a partir.
 * @returns tupla [id, planId] (planId '' si no hay guion).
 */
export function splitTramo(key: string): [string, string] {
  const sep = key.lastIndexOf('-');
  if (sep <= 0) return [key, ''];
  return [key.slice(0, sep), key.slice(sep + 1)];
}

/**
 * Parte un puntero `plan|id` en [plan, id]. Acepta `null`/number como el viejo
 * `?.split('|')` (los punteros legacy y los selects con `''` pasan por aquí).
 * Legacy sin `|` (descargaEnId pelado): devuelve [fallbackPlanId, valor intacto].
 * Los sitios con guarda `includes('|')` nunca tocan el fallback (equivalencia exacta).
 * @param p - puntero a partir.
 * @param fallbackPlanId - plan a usar si no hay `|`.
 * @returns tupla [plan, id] (strings; '' si ausente).
 */
export function splitPtr(
  p: string | number | null | undefined,
  fallbackPlanId: string | number | null,
): [string, string] {
  const s = p == null ? '' : String(p);
  if (!s.includes('|')) return [fallbackPlanId == null ? '' : String(fallbackPlanId), s];
  const i = s.indexOf('|');
  return [s.slice(0, i), s.slice(i + 1)];
}

/**
 * Sufijo de plano de una clave `${net}_${id}_${planId}` — solo dígitos finales, o null.
 * @param key - clave a inspeccionar.
 * @returns sufijo numérico o null (legado).
 */
export function keyPlanSuffixOf(key: string): string | null {
  const i = key.lastIndexOf('_');
  if (i <= 0) return null;
  const tail = key.slice(i + 1);
  return /^\d+$/.test(tail) ? tail : null;
}

/**
 * ¿Pertenece esta clave de conteos al plano dado? Sin este filtro, renumerar el piso
 * cargado borraba o renombraba claves de OTROS pisos (cada piso numera RS1..RSn).
 * Claves sin sufijo numérico (legado) o sin plano conocido se procesan como antes.
 * @param key - clave de conteos.
 * @param planId - plano en cuestión (null = todo vale).
 * @returns true si la clave es de ese plano o sin sufijo.
 */
export function isPlanKeyFor(key: string, planId: string | number | null | undefined): boolean {
  if (planId == null) return true;
  const sfx = keyPlanSuffixOf(key);
  return sfx == null || sfx === String(planId);
}

/**
 * ¿La clave termina en sufijo numérico de plano?
 * @param key - clave a inspeccionar.
 * @returns true si el último segmento tras `_` son dígitos.
 */
export const hasNumericPlanSuffix = (key: string): boolean => {
  const lastUnderscore = key.lastIndexOf('_');
  return lastUnderscore > 0 && /^\d+$/.test(key.slice(lastUnderscore + 1));
};

/**
 * Una clave aparato/hidro es huérfana solo si el ramal/bajante NO existe en NINGÚN plano
 * legible: se conserva si algún key válido coincide exactamente o comparte prefijo.
 * @param key - clave candidata.
 * @param validKeys - claves vivas conocidas.
 * @returns true si huérfana.
 */
export const isOrphanKey = (key: string, validKeys: Set<string>): boolean => {
  const base = hasNumericPlanSuffix(key) ? key.slice(0, key.lastIndexOf('_')) : key;
  for (const vk of validKeys) {
    if (vk === key || vk.startsWith(base + '_')) return false;
  }
  return true;
};

/**
 * Renombra un id de ramal dentro de una clave `fam_id_plan` (renumerado por piso).
 * El id es TODO lo que hay entre la familia y el plan: puede traer `_` (MAF1_af) — el
 * indexOf-por-segmento antiguo no lo encontraba y la clave quedaba sin renombrar. Con ≥3
 * segmentos el ÚLTIMO es el plan (numérico o no: `san_RS3_planA` de los tests legacy);
 * con 2 no hay plan. Cubre el label de tributario `T{n}{id}` (el scope por plano lo decide
 * el caller con isPlanKeyFor ANTES de llamar).
 * @param key - clave original.
 * @param oldId - id a reemplazar.
 * @param newId - id nuevo.
 * @returns clave renombrada o null si el id no aparece.
 */
export function renombrarIdEnClave(key: string, oldId: string, newId: string): string | null {
  const segs = key.split('_');
  if (segs.length < 2) return null;
  const fam = segs[0];
  const plan = segs.length > 2 ? segs[segs.length - 1] : null;
  const id = segs.length > 2 ? segs.slice(1, -1).join('_') : segs[1];
  let renamed: string | null = null;
  if (id === oldId) renamed = newId;
  else {
    const m = id.match(/^T(\d+)(.+)$/);
    if (m && m[2] === oldId) renamed = `T${m[1]}${newId}`;
  }
  if (renamed == null) return null;
  return `${fam}_${renamed}${plan != null ? `_${plan}` : ''}`;
}
