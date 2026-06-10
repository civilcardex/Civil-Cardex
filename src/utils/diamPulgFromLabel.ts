export function diamPulgFromLabel(d: unknown): number {
  if (!d) return 0;
  const s = String(d).trim();

  const FRAC = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

  const inchPart = s.split('"')[0];
  if (inchPart && inchPart !== s) {
    for (const [ch, val] of Object.entries(FRAC)) {
      const idx = inchPart.indexOf(ch);
      if (idx !== -1) {
        const before = inchPart.slice(0, idx).trim();
        const whole = before ? parseFloat(before) || 0 : 0;
        return whole + val;
      }
    }
    const n = parseFloat(inchPart);
    if (!isNaN(n)) return n;
  }

  const dashFrac = s.match(/^(\d+)\s*[\u2013\u2014-]\s*(\d+)\s*\/\s*(\d+)$/);
  if (dashFrac) {
    const whole = parseFloat(dashFrac[1]);
    const num = parseFloat(dashFrac[2]);
    const den = parseFloat(dashFrac[3]);
    return whole + num / den;
  }

  const fracMatch = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (fracMatch) return parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);

  const simple = s.match(/(\d+(?:\.\d+)?)/);
  return simple ? parseFloat(simple[1]) : 0;
}
