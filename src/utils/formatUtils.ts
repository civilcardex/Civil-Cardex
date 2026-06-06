const FRAC: Record<number, string> = { 0.5: '½', 0.75: '¾', 0.25: '¼', 0.125: '⅛', 0.375: '⅜', 0.625: '⅝', 0.875: '⅞' };

export function fmtPulg(v: number): string {
  if (!v || v <= 0) return "—";
  const ent = Math.floor(v);
  const dec = Math.round((v - ent) * 100) / 100;
  const frac = FRAC[dec];
  if (frac) return ent > 0 ? `${ent}${frac}"` : `${frac}"`;
  if (dec === 0) return `${ent}"`;
  return `${v.toFixed(2)}"`;
}
