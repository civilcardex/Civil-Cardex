/**
 * Valor decimal de una etiqueta de di\u00e1metro ("1/2\"", "3/4\"", "1 1/4", "20 mm"...).
 *
 * \u00dcNICA fuente: la usaban el panel de acometida (SupplyConnection) y la tabla de rows
 * (waterRowsAcometida) con el mismo c\u00f3digo copiado - dos verdades que pod\u00edan divergir.
 *
 * Las fracciones COMPUESTAS ("1 1/2") se leen antes que las simples: si se buscara "1/2" primero,
 * "1 1/2" devolver\u00eda 0.5 (la rama "1 1/2" quedaba inalcanzable).
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
