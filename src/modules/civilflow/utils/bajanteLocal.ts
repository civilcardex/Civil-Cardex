/**
 * Resolvedor de bajantes por piso.
 *
 * Por qué existe: el motor guarda en el MISMO array los bajantes de otros pisos que
 * atraviesan esta altura (proyecciones de entrepiso con `pisoBase` ajeno y el MISMO id tras
 * un renombre). Un `find()` plano devolvía la proyección —con el libro rancio— en vez del
 * montante real (orig. usuario: MAC1-P1 marcaba 15,5 con el real en 4,5).
 *
 * Este módulo NO importa nada: usa tipos estructurales, así que ni el motor ni los utils
 * dependen de él en runtime (evita ciclos de import y lo deja testeable en node).
 */

/** Bajante mínimo que necesita el resolvedor (el motor tiene más campos). */
export interface BajanteIdentificable {
  id: string;
  pisoBase?: string;
}

/**
 * Primer bajante del PISO ABIERTO que cumple un filtro.
 *
 * @param eng motor del plano (con `nivelActual.label` y `bajantes`).
 * @param filtro predicado sobre el bajante.
 * @returns el bajante del piso abierto que cumple el filtro; si ninguno es del piso
 *   abierto, el primero que lo cumpla; si no hay ninguno, `undefined`.
 */
export function bajanteLocalQueCumple<T extends { id: string; pisoBase?: string }>(
  eng: { nivelActual?: { label?: string } | null; bajantes?: readonly T[] } | null | undefined,
  filtro: (b: T) => boolean,
): T | undefined {
  if (!eng?.bajantes) return undefined;
  const nivelLbl = eng.nivelActual?.label ?? '';
  const mismos = eng.bajantes.filter(filtro);
  if (mismos.length === 0) return undefined;
  return mismos.find((b) => (b.pisoBase ?? '') === nivelLbl) ?? mismos[0];
}

/**
 * Bajante vivo por id, prefiriendo el del PISO ABIERTO.
 *
 * @param eng motor del plano (con `nivelActual.label` y `bajantes`).
 * @param id identificador del bajante.
 * @returns el bajante del piso abierto; si ninguno tiene ese `pisoBase`, el primero que
 *   coincida; si no hay ninguno, `undefined`.
 */
export function bajanteLocalDe<T extends { id: string; pisoBase?: string }>(
  eng: { nivelActual?: { label?: string } | null; bajantes?: readonly T[] } | null | undefined,
  id: string,
): T | undefined {
  return bajanteLocalQueCumple(eng, (b) => b.id === id);
}

/**
 * Clave de identidad de un bajante: el id SOLO es único dentro de un piso.
 *
 * Por qué: `dedupPorId` (guardado) conservaba la última copia y, con la proyección de otro
 * piso en el array, el autosave escribía la geometría del fantasma en vez de la del montante
 * real — y `saveTrazosToDB` subía ese error a Supabase.
 *
 * @param b bajante (o cualquier elemento con id y pisoBase).
 * @returns clave `id|pisoBase`; cadena vacía si el elemento no tiene id (entonces no
 *   colisiona con nada y se conserva cada copia).
 */
export function claveBajante(b: { id?: string; pisoBase?: string } | null | undefined): string {
  if (!b?.id) return ''; // sin id NO es una clave: se conserva cada copia (como dedupPorId)
  return `${b.id}|${b.pisoBase ?? ''}`;
}

/**
 * Dedup por clave de identidad (no solo por id), conservando la última copia.
 *
 * @param lista elementos a deduplicar.
 * @param clave función que devuelve la identidad única de cada elemento.
 * @param merge combina la copia nueva con la previa cuando chocan.
 * @returns lista sin identidades repetidas.
 */
export function dedupPorClave<T>(
  lista: T[],
  clave: (el: T) => string,
  merge?: (base: T, previa: T) => T,
): T[] {
  const pos = new Map<string, number>();
  const out: T[] = [];
  for (const el of lista) {
    const k = clave(el);
    const i = k ? pos.get(k) : undefined;
    if (i !== undefined) out[i] = merge ? merge(el, out[i]) : el;
    else {
      if (k) pos.set(k, out.length);
      out.push(el);
    }
  }
  return out;
}
