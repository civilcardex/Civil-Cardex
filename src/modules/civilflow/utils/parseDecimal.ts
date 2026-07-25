/**
 * Parses a string into a float, accepting comma as decimal separator. Returns null on invalid input.
 * @param val - Input string, possibly with commas.
 * @returns Parsed number or null.
 */
export function parseDecimalInput(val: string): number | null {
  const raw = val.replace(/,/g, '.');
  const v = parseFloat(raw);
  return !isNaN(v) && raw !== '' ? v : null;
}

/**
 * Parses a string into an integer, accepting comma as decimal separator. Returns null if input is empty or not a near-integer.
 * @param val - Input string, possibly with commas.
 * @returns Parsed integer or null.
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
 * Parses a string into a float, returning 0 on failure.
 * @param s - Input string.
 * @returns Parsed number or 0.
 */
export const dec = (s: string) => parseDecimalInput(s) ?? 0;
