/**
 * Índices para quitar las búsquedas lineales dentro de bucles (guard G8): construyen el mapa UNA
 * vez por operación sobre los datos vivos (300 ramales × 300 `.find` = 90 000 comparaciones por render).
 */

/**
 * Índice id→pieza: el PRIMERO gana (como haría un `.find`).
 * @param piezas piezas a indexar.
 * @param clave cómo sacar el id de cada pieza.
 * @returns mapa id→pieza.
 */
export function indicePorId<T>(
  piezas: readonly T[],
  clave: (p: T) => string | number | undefined | null,
): Map<string | number, T> {
  const m = new Map<string | number, T>();
  for (const p of piezas) {
    const k = clave(p);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, p);
  }
  return m;
}
