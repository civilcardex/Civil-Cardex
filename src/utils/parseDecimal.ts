export function parseDecimalInput(val: string): number | null {
  const raw = val.replace(/,/g, '.');
  const v = parseFloat(raw);
  return (!isNaN(v) && raw !== '') ? v : null;
}

export function parseIntInput(val: string): number | null {
  const raw = val.replace(/,/g, '.').trim();
  if (raw === '') return null;
  const v = parseFloat(raw);
  if (isNaN(v)) return null;
  const intVal = Math.round(v);
  if (Math.abs(v - intVal) > 0.001) return null;
  return intVal;
}

export const dec = (s: string) => parseDecimalInput(s) ?? 0;