import { FRAC_CHAR_TO_DEC } from './diamPulgFromLabel';

const DEC_KEYS = [0.5, 0.75, 0.25, 0.125, 0.375, 0.625, 0.875];
const FRAC: Record<number, string> = Object.fromEntries(
  Object.entries(FRAC_CHAR_TO_DEC)
    .filter(([, dec]) => DEC_KEYS.includes(dec))
    .map(([ch, dec]) => [dec, ch]),
);

/**
 * Formats a value to a fixed number of decimal places, returning "—" for null/NaN.
 * @param v - Value to format.
 * @param d - Number of decimal places (default 2).
 * @returns Formatted string or "—".
 */
export const fmt = (v: unknown, d = 2) =>
  v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d);

/**
 * Formats a decimal-inch value as a fractional-inch string (e.g. 1.5 → "1 ½"").
 * @param v - Decimal inches value.
 * @returns Fractional-inch string or "—" if ≤0.
 */
export function fmtPulg(v: number): string {
  if (!v || v <= 0) return '—';
  const ent = Math.floor(v);
  const dec = Math.round((v - ent) * 1000) / 1000;
  const frac = FRAC[dec];
  if (frac) return ent > 0 ? `${ent} ${frac}"` : `${frac}"`;
  if (dec === 0) return `${ent}"`;
  return `${v.toFixed(2)}"`;
}

const FRAC_MAP: Record<string, string> = {
  '⅜': '3/8',
  '½': '1/2',
  '⅔': '2/3',
  '⅓': '1/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅛': '1/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

/**
 * Normalizes a diameter label by replacing Unicode fraction characters with ASCII equivalents (e.g. "1½" → "1-1/2").
 * @param dn - Raw diameter label string.
 * @returns Normalized label.
 */
export function normalizeDnLabel(dn: string): string {
  let out = dn;
  for (const [uni, ascii] of Object.entries(FRAC_MAP)) {
    out = out.replace(new RegExp(`(\\d)(${uni})`, 'g'), `$1-${ascii}`);
    out = out.split(uni).join(ascii);
  }
  out = out.replace(/(\d+) (\d+\/\d+)/, '$1-$2');
  return out;
}
