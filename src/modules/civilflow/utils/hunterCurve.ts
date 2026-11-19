// Curva de Hunter SIMPLIFICADO — ÚNICA copia de la fórmula en toda la app (decisión de
// producto 2026-11-16): el caudal probable depende SOLO de las unidades (UC en agua, UD en
// desagüe) — sin factor K de simultaneidad ni número de descargas. Si la norma cambia, se
// parchea ESTE archivo y los 4 módulos (agua, sanitaria, bomba, calentador) quedan al día.

/** Curva de Hunter cruda, SIN redondear. Ej: 60 → 1.941148…; 40 → 1.468913… [L/s]. */
export function hunterCurva(n: number): number {
  if (n <= 0) return 0;
  // Quiebre en 240 (240 cae en la rama alta). Coeficientes verificados contra los docs (/docs).
  return n < 240 ? 0.1163 * Math.pow(n, 0.6875) : 0.074 * Math.pow(n, 0.7504);
}

/** Caudal probable redondeado a 3 decimales (L/s) — la variante que usan las tablas de agua. Ej: hunterQ(60) -> 1.953. */
export function hunterQ(n: number): number {
  return Math.round(hunterCurva(n) * 1000) / 1000;
}
