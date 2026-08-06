export const FRAC_CHAR_TO_DEC: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

export function diamPulgFromLabel(d: unknown): number {
  if (!d) return 0;
  let s = String(d).trim();
  if (s.includes('—')) {
    s = s.split('—').pop()!.trim();
  }

  // Primero, ver si tiene una fracción Unicode en cualquier parte del string recortado
  for (const [ch, val] of Object.entries(FRAC_CHAR_TO_DEC)) {
    const idx = s.indexOf(ch);
    if (idx !== -1) {
      const before = s.slice(0, idx).trim();
      const whole = before ? parseFloat(before) || 0 : 0;
      return whole + val;
    }
  }

  const inchPart = s.split('"')[0].trim();
  if (inchPart && inchPart !== s) {
    const spaceFrac = inchPart.match(/^(\d+)\s+([1-9]\d*)\s*\/\s*([1-9]\d*)$/);
    if (spaceFrac) {
      const whole = parseFloat(spaceFrac[1]);
      const num = parseFloat(spaceFrac[2]);
      const den = parseFloat(spaceFrac[3]);
      return whole + num / den;
    }
    const simpleFrac = inchPart.match(/^([1-9]\d*)\s*\/\s*([1-9]\d*)$/);
    if (simpleFrac) {
      return parseFloat(simpleFrac[1]) / parseFloat(simpleFrac[2]);
    }
    const n = parseFloat(inchPart);
    if (!isNaN(n)) return n;
  }

  const spaceFrac = s.match(/^(\d+)\s+([1-9]\d*)\s*\/\s*([1-9]\d*)/);
  if (spaceFrac) {
    const whole = parseFloat(spaceFrac[1]);
    const num = parseFloat(spaceFrac[2]);
    const den = parseFloat(spaceFrac[3]);
    return whole + num / den;
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
