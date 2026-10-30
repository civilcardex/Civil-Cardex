/**
 * Resolvedor de bajantes por piso: el motor guarda en el MISMO array las proyecciones de otros
 * pisos con el MISMO id, y un find() plano devolvía la proyección (con su libro rancio) en vez
 * del real — MAC1-P1 marcaba 15,5 con el real en 4,5. Sin imports de runtime (tipos
 * estructurales): testeable en node y sin ciclos de import.
 */

/** Bajante mínimo que necesita el resolvedor (el motor tiene más campos). */
export interface BajanteIdentificable {
  id: string;
  pisoBase?: string;
}

/**
 * Primer bajante del PISO ABIERTO que cumple un filtro (fallback: el primero que lo cumpla).
 * @param eng motor del plano (con `nivelActual.label` y `bajantes`).
 * @param filtro predicado sobre el bajante.
 * @returns el bajante del piso abierto; si no hay ninguno, `undefined`.
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
 * Bajante vivo por id, prefiriendo el del PISO ABIERTO: el motor guarda proyecciones de otros
 * pisos con el MISMO id y un `.find` plano devolvía la proyección (con su libro rancio).
 * @param eng motor del plano.
 * @param id identificador del bajante.
 * @returns el bajante del piso abierto; si no hay ninguno, `undefined`.
 */
export function bajanteLocalDe<T extends { id: string; pisoBase?: string }>(
  eng: { nivelActual?: { label?: string } | null; bajantes?: readonly T[] } | null | undefined,
  id: string,
): T | undefined {
  return bajanteLocalQueCumple(eng, (b) => b.id === id);
}

/**
 * Bajante de una LISTA (documento guardado) por id, prefiriendo la copia del piso dueño — el doc
 * arrastra proyecciones con el MISMO id y escribir la herencia en la copia equivocada dejaba al
 * real sin libro. Ej: doc del Piso 1 con BAN1 real + proyección del Piso 2 → gana `pisoBase 'Piso 1'`.
 * @param bajantes lista del documento.
 * @param id id a buscar (único solo por piso).
 * @param pisoLabel etiqueta del piso dueño; vacía = sin preferencia.
 * @returns la copia del piso dueño; si no hay, la primera con ese id.
 */
export function bajanteDePisoEn<T extends { id: string; pisoBase?: string }>(
  bajantes: readonly T[] | null | undefined,
  id: string,
  pisoLabel: string | null | undefined,
): T | undefined {
  const copias = (bajantes ?? []).filter((b) => b.id === id);
  if (copias.length === 0) return undefined;
  if (!pisoLabel) return copias[0];
  return copias.find((b) => (b.pisoBase ?? '') === pisoLabel) ?? copias[0];
}

/**
 * Clave de identidad de un bajante `id|pisoBase`: el id SOLO es único dentro de un piso (el dedup
 * por id conservaba la proyección de otro piso y el autosave subía su geometría a la BD).
 * @param b bajante (o cualquier elemento con id y pisoBase).
 * @returns la clave; cadena vacía si no tiene id (se conserva cada copia).
 */
export function claveBajante(b: { id?: string; pisoBase?: string } | null | undefined): string {
  if (!b?.id) return ''; // sin id NO es una clave: se conserva cada copia (como dedupPorId)
  return `${b.id}|${b.pisoBase ?? ''}`;
}

/**
 * Dedup por clave de identidad (no solo por id), conservando la última copia.
 * @param lista elementos a deduplicar.
 * @param clave identidad única de cada elemento (vacía = nunca colisiona).
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
