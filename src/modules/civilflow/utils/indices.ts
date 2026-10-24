/**
 * Índices para quitar las búsquedas lineales dentro de bucles (guard G8).
 *
 * El patrón que más se repite en la app: dentro de un bucle sobre las piezas de un plano se
 * busca una pieza por id (`.find`), o se comprueba si algo ya está en una lista (`.includes`,
 * `.some`). Con un plano de 300 ramales eso son 300 × 300 comparaciones por cada render.
 *
 * Estos helpers construyen el índice UNA vez y lo reutilizan. No son cachés globales: el
 * índice se construye donde se usa, sobre los datos vivos de esa operación.
 */

/**
 * Índice id→pieza. El PRIMERO gana (como haría un `.find`).
 * @param piezas - las piezas a indexar.
 * @param clave - cómo sacar el id de cada pieza.
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
