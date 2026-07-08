const FRAC: Record<number, string> = {
  0.5: '½',
  0.75: '¾',
  0.25: '¼',
  0.125: '⅛',
  0.375: '⅜',
  0.625: '⅝',
  0.875: '⅞'
};

export const fmt = (v: unknown, d = 2) => v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d);

export function fmtPulg(v: number): string {
  if (!v || v <= 0) return "—";
  const ent = Math.floor(v);
  const dec = Math.round((v - ent) * 1000) / 1000;
  const frac = FRAC[dec];
  if (frac) return ent > 0 ? `${ent} ${frac}"` : `${frac}"`;
  if (dec === 0) return `${ent}"`;
  return `${v.toFixed(2)}"`;
}

const FRAC_MAP: Record<string, string> = {
  '⅜': '3/8', '½': '1/2', '⅔': '2/3', '⅓': '1/3',
  '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅝': '5/8', '⅞': '7/8',
};

export function normalizeDnLabel(dn: string): string {
  let out = dn;
  for (const [uni, ascii] of Object.entries(FRAC_MAP)) {
    if (out.includes(uni)) out = out.split(uni).join(ascii);
  }
  out = out.replace(/^(\d+) (\d+\/\d+)/, '$1-$2');
  return out;
}
