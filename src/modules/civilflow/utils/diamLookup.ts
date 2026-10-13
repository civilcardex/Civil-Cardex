/** Lookup exacto en catálogos de diámetros con Map cacheado por tabla (las búsquedas
 *  lineales `DIAM_*.find` se repetían por render y por fila).
 *  @param tabla - catálogo (DIAM_BAN, DIAM_VENT, PVC_SCH40...).
 *  @param prop - campo a indexar ('pulg', 'nom', 'dn').
 *  @param val - valor exacto a buscar.
 *  @returns entrada o undefined. */
const cache = new WeakMap<readonly unknown[], Map<string, Map<unknown, unknown>>>();

export function entradaPor<T>(tabla: readonly T[], prop: string, val: unknown): T | undefined {
  let porProp = cache.get(tabla);
  if (!porProp) {
    porProp = new Map();
    cache.set(tabla, porProp);
  }
  let m = porProp.get(prop);
  if (!m) {
    m = new Map((tabla as Record<string, unknown>[]).map((d) => [d[prop], d]));
    porProp.set(prop, m);
  }
  return m.get(val) as T | undefined;
}
