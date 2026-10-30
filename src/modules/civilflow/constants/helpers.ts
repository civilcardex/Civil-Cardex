import { sanitizeMojibake } from '../utils/formatUtils.ts';

/** Quita acentos/diacríticos de un texto (comparar "Rígido" con "Rigido"). Ej: sinAcentos('Cobre rígido') → 'Cobre rigido'. */
export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Etiqueta completa del piso para paneles y alertas. Ej: -1 → "Sótano 1", 2 → "Piso 2", 99 → "Cubierta". */
export function pisoLbl(n: number) {
  if (n < 0) return `Sótano ${Math.abs(n)}`;
  if (n === 99) return `Cubierta`;
  return `Piso ${n}`;
}

/** Etiqueta corta del piso para chips y claves compuestas. Ej: -1 → "S1", 2 → "P2", 99 → "C". */
export function pisoCorto(n: number) {
  if (n < 0) return `S${Math.abs(n)}`;
  if (n === 99) return `C`;
  return `P${n}`;
}

/** pisoCorto tolerante: acepta número o string ("2", "P2") y devuelve "" si no parsea —
 *  para datos de fila que pueden venir vacíos. Ej: "2" → "P2", "x" → "". */
export function pisoCortoLoose(v: unknown): string {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (isNaN(n)) return '';
  return pisoCorto(n);
}

/** Convierte el valor de piso de una tabla a su etiqueta corta ("P1", "S2", "C"): acepta un
 *  número ("2"), el nombre completo ("Piso 2", "Sótano 2") o "Cubierta", y lo resuelve contra la
 *  lista de pisos del proyecto para no inventar etiquetas de pisos inexistentes. */
export function fmtPiso(val: string, pisos: { n: number }[]): string {
  if (!val) return '—';
  const num = parseInt(val);
  if (!isNaN(num) && pisos.some((p) => p.n === num)) return pisoCorto(num);
  for (const p of pisos) {
    const lbl = `Piso ${p.n}`;
    if (val === lbl || val === `Sótano ${Math.abs(p.n)}` || (val === 'Cubierta' && p.n === 99))
      return pisoCorto(p.n);
  }
  return val;
}

/** La etiqueta con la que un bajante realmente se dibuja en el canvas (renderBajantes.ts) — código
 *  sin '#' y en mayúsculas, más el sufijo corto de piso ("BAN1-P1", "MAF1-S2", "BALL1-C"). La
 *  reutilizan las alertas de asociación entre pisos para citar la etiqueta visual, no el id/código
 *  pelado. */
export function buildBajanteVisualLabel(
  b: { code?: string | null; id?: string | null } | null | undefined,
  pisoCortoStr?: string,
): string {
  const code = (b?.code || '').replace(/#/g, '').toUpperCase();
  if (code) return `${code}${pisoCortoStr ? '-' + pisoCortoStr : ''}`;
  const id = (b?.id || '').replace(/#/g, '').toUpperCase();
  return `${id}${pisoCortoStr ? '-' + pisoCortoStr : ''}`;
}

/** Ordena bajantes/montantes por código visible en listas y dropdowns (code, o id si no tiene código)
 *  con orden numérico natural — BAN9 después de BAN2, no "BAN10" antes de "BAN2". Ej: [BAN2, BAN10]
 *  queda [BAN2, BAN10], mientras un sort alfabético plano daría [BAN10, BAN2].
 *  @param a - bajante con code/id opcionales; @param b - el otro bajante a comparar. */
export function compararPorCodigo(
  a: { code?: string | null; id?: string | null },
  b: { code?: string | null; id?: string | null },
): number {
  // !: el crash con ambas ausentes es el comportamiento original de los 4 callers (preservado).
  return (a.code || a.id)!.localeCompare((b.code || b.id)!, undefined, { numeric: true });
}

/** Abreviaturas de material para el dibujo del canvas (ver matDrawingLabel). */
const MAT_DRAWING_ABBREV: Array<[RegExp, string]> = [
  [/acero\s*galvanizado/i, 'H.G.'],
  [/acero\s*hg/i, 'H.G.'],
  [/polietileno/i, 'PEAD'],
  [/pe\s*al\s*pe/i, 'PEAD'],
  [/^pead$/i, 'PEAD'],
  [/acero\s*al\s*carbono/i, 'A.C.'],
  [/^a\.c\.$/i, 'A.C.'],
  [/cobre\s*flexible/i, 'CUFLEX'],
  [/cobre\s*rigido|rígido/i, 'CURIG'],
];

/** Etiqueta corta de material usada SOLO en las etiquetas de dibujo del canvas
 *  (renderRamales/renderBajantes). Tablas, memorias y catálogos conservan el nombre completo —
 *  este mapa es una abreviación puramente de render. La comparación ignora mayúsculas/acentos y
 *  también cubre las formas cortas que guardan los propios catálogos de la app (p. ej. "Acero HG",
 *  "PE al PE"), de modo que nombres largos específicos del proyecto y los nombres cortos de fábrica
 *  colapsan a la misma etiqueta de dibujo.
 *  @param material nombre del material (de catálogo o libre); @returns abreviatura de dibujo o el nombre saneado. */
export function matDrawingLabel(material?: string | null): string {
  if (!material) return '';
  const norm = sinAcentos(material).trim();
  for (const [re, abbr] of MAT_DRAWING_ABBREV) {
    if (re.test(norm)) return abbr;
  }
  return sanitizeMojibake(material);
}

// Nombre completo para el dropdown de material en el menú contextual del ramal — los valores
// guardados son las formas cortas de catálogo ("Acero HG", "PE al PE", "A.C.", ...) pero el
// usuario elige entre los nombres completos ("Acero galvanizado", "Polietileno", "Acero al
// carbono", ...). El mapeo de abreviaturas (matDrawingLabel) se aplica solo a la etiqueta de
// dibujo del canvas, nunca aquí.
const MAT_FULLNAME: Array<[RegExp, string]> = [
  [/acero\s*galvanizado|acero\s*hg/i, 'Acero galvanizado'],
  [/polietileno|pe\s*al\s*pe|^pead$/i, 'Polietileno'],
  [/acero\s*al\s*carbono|^a\.c\.$/i, 'Acero al carbono'],
  [/cobre\s*flexible/i, 'Cobre flexible'],
  [/cobre\s*rigido|rígido/i, 'Cobre rígido'],
];

/** Nombre completo para el dropdown de material en el menú contextual del ramal — los valores
 *  guardados son las formas cortas de catálogo ("Acero HG", "PE al PE", "A.C.", ...) pero el
 *  usuario elige entre los nombres completos ("Acero galvanizado", "Polietileno", "Acero al
 *  carbono", ...). El mapeo de abreviaturas (matDrawingLabel) se aplica solo a la etiqueta de
 *  dibujo del canvas, nunca aquí.
 *  @param material forma corta guardada; @returns nombre completo o el mismo valor saneado. */
export function matFullName(material?: string | null): string {
  if (!material) return '';
  const norm = sinAcentos(material).trim();
  for (const [re, name] of MAT_FULLNAME) {
    if (re.test(norm)) return name;
  }
  return sanitizeMojibake(material);
}
