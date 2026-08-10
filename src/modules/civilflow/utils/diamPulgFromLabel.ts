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
  // Un diámetro puede venir con especificación extra (p. ej. `1-1/2" RDE 21` o `1/2" — 42.7 mm`).
  // Cuando hay separador '—', elegir el segmento que realmente describe pulgadas (contiene '"' o
  // una fracción); el otro segmento es el equivalente métrico/especificación y NO debe usarse.
  if (s.includes('—')) {
    const parts = s.split('—').map((x) => x.trim());
    const inchLike = parts.find(
      (x) => x.includes('"') || /[½⅓⅔¼¾⅛⅜⅝⅞]/.test(x) || /(\d+\s*-\s*)?\d+\s*\/\s*\d+/.test(x),
    );
    if (inchLike) s = inchLike;
    else s = parts[0];
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

  // Números mixtos ASCII: "1 1/2" o "1-1/2" (p. ej. `1-1/2" RDE 21`).
  const mixed =
    s.match(/(\d+)\s*[\u2013\u2014-]\s*(\d+)\s*\/\s*(\d+)/) ||
    s.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    return parseFloat(mixed[1]) + parseFloat(mixed[2]) / parseFloat(mixed[3]);
  }

  const inchPart = s.split('"')[0].trim();
  if (inchPart && inchPart !== s) {
    const simpleFrac = inchPart.match(/^([1-9]\d*)\s*\/\s*([1-9]\d*)$/);
    if (simpleFrac) {
      return parseFloat(simpleFrac[1]) / parseFloat(simpleFrac[2]);
    }
    const n = parseFloat(inchPart);
    if (!isNaN(n)) return n;
  }

  const fracMatch = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (fracMatch) return parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);

  const simple = s.match(/(\d+(?:\.\d+)?)/);
  return simple ? parseFloat(simple[1]) : 0;
}
