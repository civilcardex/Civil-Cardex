/**
 * Valor decimal de una etiqueta de diámetro ("1/2\"" -> 0.5, "2 3/4\"" -> 2.75, "20 mm" -> 20).
 * ÚNICA fuente: panel de acometida y tabla de acometida la compartían copiada (dos verdades).
 * @param valStr etiqueta del diámetro.
 * @returns el valor decimal; 0 si no hay número legible.
 */
export function diamFractionValue(valStr: string): number {
  if (!valStr) return 0;
  const s = String(valStr).trim();
  // Compuesta: "1 1/2" -> 1.5, "2 3/4" -> 2.75 (con comillas u otras marcas detr\u00e1s).
  const compuesta = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (compuesta) {
    const entero = parseInt(compuesta[1]);
    const num = parseInt(compuesta[2]);
    const den = parseInt(compuesta[3]);
    if (den) return entero + num / den;
  }
  // Simple: "1/2" -> 0.5, "3/4" -> 0.75.
  const simple = s.match(/(\d+)\/(\d+)/);
  if (simple) {
    const den = parseInt(simple[2]);
    if (den) return parseInt(simple[1]) / den;
  }
  if (s.includes('1/2')) return 0.5;
  if (s.includes('3/4')) return 0.75;
  const num = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
}
