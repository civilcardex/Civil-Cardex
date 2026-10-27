/**
 * Sanitiza una celda para export a Excel: Excel/LibreOffice interpretan como FÓRMULA todo
 * string que empiece por =, +, -, @, tab o CR (inyección de fórmulas, CWE-1236 — un nombre
 * hostil `=WEBSERVICE(...)` se ejecutaba al abrir el archivo); el apóstrofo inicial lo fuerza
 * a texto. REGLA: todo aoa_to_sheet con input del usuario pasa por aquí.
 * Ej: '=SUM(A1)' → "'=SUM(A1)'; los números pasan intactos.
 * @param v valor de la celda (string, número, null…).
 * @returns valor seguro para aoa_to_sheet.
 */
export function sanitizarCelda<T>(v: T): T | string {
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return `'${v}`;
  return v;
}

/** Aplica {@link sanitizarCelda} a toda una fila (tupla de una aoa_to_sheet). */
export function filaSegura<F extends unknown[]>(fila: F): F {
  return fila.map(sanitizarCelda) as unknown as F;
}
