/**
 * Convierte un string a float aceptando coma como separador decimal. Devuelve null si la
 * entrada es inválida.
 * @param val - String de entrada, posiblemente con comas.
 * @returns Número parseado o null.
 */
export function parseDecimalInput(val: string): number | null {
  const raw = val.replace(/,/g, '.');
  const v = parseFloat(raw);
  return !isNaN(v) && raw !== '' ? v : null;
}

/**
 * Convierte un string a entero aceptando coma como separador decimal. Devuelve null si la
 * entrada está vacía o no es un casi-entero.
 * @param val - String de entrada, posiblemente con comas.
 * @returns Entero parseado o null.
 */
export function parseIntInput(val: string): number | null {
  const raw = val.replace(/,/g, '.').trim();
  if (raw === '') return null;
  const v = parseFloat(raw);
  if (isNaN(v)) return null;
  const intVal = Math.round(v);
  if (Math.abs(v - intVal) > 0.001) return null;
  return intVal;
}

/**
 * Convierte un string a float devolviendo 0 ante fallo.
 * @param s - String de entrada.
 * @returns Número parseado o 0.
 */
export const dec = (s: string) => parseDecimalInput(s) ?? 0;
