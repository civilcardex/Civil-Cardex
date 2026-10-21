/** Claves compuestas del módulo: se construyen con las funciones de aquí y se parten con los parseadores (siempre cortando por el ÚLTIMO separador, porque los ids pueden traer guiones). */

/** Familias de red que guardan conteos de aparatos: san (Sanitaria), ll (Lluvias), vent (Ventilacion), af (Agua Fria), ac (Agua Caliente), gas (Gas). */
export type Fam = 'san' | 'll' | 'vent' | 'af' | 'ac' | 'gas';

/** PlanId normalizado a string en el borde (los planos son bigint en BD, string en keys). */
export type PlanId = string;

/**
 * Número de un bajante/montante a partir de su id o code, sin importar el sufijo de piso.
 *
 * Por qué: había DOS criterios distintos para el mismo número. El orden de renumeración
 * usaba `replace(pfx,'')` ('BAN9-P1' -> 9) y el "menor número libre" usaba el regex del
 * FINAL del id ('BAN9-P1' -> 1, el 1 del piso). Con ids legacy con sufijo de piso, el
 * segundo veía el número del piso: creaba 'BAN2' cuando ya había 'BAN2-P1' y el motor
 * acababa con DOS bajantes de id 'BAN2' (que el guardado fusionaba, perdiendo geometría).
 *
 * @param idOrCode - id o code del bajante ('BAN9-P1', 'BAN9', 'M1_af').
 * @param pfx - prefijo de la familia ('BAN', 'MAC', 'M1'…).
 * @returns el número, o 0 si no se puede leer.
 */
export function numDeBajante(idOrCode: string | undefined | null, pfx: string): number {
  const s = idOrCode ?? '';
  if (!s) return 0;
  const esc = pfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('^' + esc + '(\\d+)').exec(s);
  if (m) return parseInt(m[1], 10);
  // Prefijo alterno (los montantes usan 'M' + etiqueta de red: 'M1_af' con pfx 'M1').
  const alt = new RegExp('^(\\d+)').exec(s.replace(/^M/, ''));
  return alt ? parseInt(alt[1], 10) : 0;
}

/**
 * Clave de conteos de un elemento en su piso. Misma regla que loadTrazosFromDB: los stubs
 * sintéticos AC-01-<calId> vuelven bajo `ac_<calId>_<plan>`.
 * Ej: ('san', 'RS1', 2) → 'san_RS1_2'.
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
 * Puntero entrepisos `plan|id` (así un bajante de un piso apunta al del otro).
 * Ej: ptr(2, 'BAN1') → '2|BAN1'.
 * @param planId - plano dueño.
 * @param id - id del elemento.
 * @returns puntero.
 */
export function ptr(planId: string | number, id: string): string {
  return `${planId}|${id}`;
}

/**
 * Parte `fam_id_plan` en [familia, id, plan o null]. El id puede traer `_` (MAF1_af):
 * se corta por el ÚLTIMO guion bajo y el plan debe ser numérico.
 * Ej: 'san_RS1_2' → ['san', 'RS1', '2'].
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
 * Ej: 'AC-01-X-P1' → ['AC-01-X', 'P1'].
 * @param key - clave a partir.
 * @returns tupla [id, planId] (planId '' si no hay guion).
 */
export function splitTramo(key: string): [string, string] {
  const sep = key.lastIndexOf('-');
  if (sep <= 0) return [key, ''];
  return [key.slice(0, sep), key.slice(sep + 1)];
}

/** Parte un puntero `plan|id` en [plan, id]; el formato legacy sin `|` cae al plan dado.
 *  @param p - puntero a partir.
 *  @param fallbackPlanId - plan si no hay `|`.
 *  @returns tupla [plan, id]. */
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

/** ¿La clave de conteos es de ESTE plano? Sin este filtro el renumero tocaba claves de otros pisos (RS1 del piso 1 y RS1 del piso 2 son distintas).
 *  @param key - clave de conteos.
 *  @param planId - plano en cuestión (null = todo vale).
 *  @returns true si es de ese plano o sin sufijo. */
export function isPlanKeyFor(key: string, planId: string | number | null | undefined): boolean {
  if (planId == null) return true;
  const sfx = keyPlanSuffixOf(key);
  return sfx == null || sfx === String(planId);
}

/**
 * ¿El último segmento tras `_` es un número de plano? (así se distingue 'san_RS1_2' del legado sin piso)
 * @param key - clave a inspeccionar.
 * @returns true si el último segmento tras `_` son dígitos.
 */
export const hasNumericPlanSuffix = (key: string): boolean => {
  const lastUnderscore = key.lastIndexOf('_');
  return lastUnderscore > 0 && /^\d+$/.test(key.slice(lastUnderscore + 1));
};

/**
 * ¿Sobró una clave cuyo ramal/bajante ya no existe en NINGÚN plano? Solo entonces se borra
 * (basura): si alguna clave viva coincide exacta o comparte prefijo, se conserva.
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

/** Renombra id dentro de `fam_id_plan` (el id admite `_` y label `T{n}{id}`).
 *  @param key - clave original.
 *  @param oldId - id a reemplazar.
 *  @param newId - id nuevo.
 *  @returns clave renombrada o null si el id no aparece. */
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
