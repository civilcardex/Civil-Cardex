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
  // Comillas tipográficas de pulgada (U+2033 doble prima, U+201D comillas tipográficas) a la
  // comilla ASCII — los valores pegados/legados pueden usar cualquiera de las tres.
  s = s.replace(/[″”]/g, '"');
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

  // Sin comilla de pulgada llegado aquí. El diámetro puede venir con letras (RDE, mm, CPVC…) o
  // guardarse crudo (p. ej. `54.5 mm`, `107.7`, `42.68`). Solo se acepta un número en posición
  // INICIAL: una especificación desnuda como `RDE 21` o `SCH 80` tiene número pero NO es un
  // diámetro — leer "21" como pulgadas bloqueaba todo cambio de diámetro del ramal. Y un valor
  // métrico crudo leído como pulgadas (54.5 > cualquier opción real) disparaba alertas falsas.
  // Reglas:
  //  - si la etiqueta declara "mm", o es un número desnudo sin letras y mayor a 12" (el máximo
  //    real del catálogo es Concreto 12" / Novatec 315 mm) → es métrico → convertir (÷25.4);
  //  - el equivalente métrico de un diámetro nominal (54.5 mm ≈ 2") cae ~5% ARRIBA del nominal;
  //    redondear hacia abajo al 1/2" más cercano lo iguala con el valor en pulgadas del mismo
  //    elemento para que la comparación ramal >= accesorio no los vea distintos.
  const numMatch = s.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) {
    let inches = parseFloat(numMatch[1]);
    const isMetric = /mm/i.test(s) || (!/[a-z]/i.test(s) && inches > 12);
    if (isMetric) {
      inches = Math.floor((inches / 25.4) * 2) / 2;
    }
    return inches;
  }
  return 0;
}
