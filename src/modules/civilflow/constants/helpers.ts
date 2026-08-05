export function pisoLbl(n: number) {
  if (n < 0) return `Sótano ${Math.abs(n)}`;
  if (n === 99) return `Cubierta`;
  return `Piso ${n}`;
}

export function pisoCorto(n: number) {
  if (n < 0) return `S${Math.abs(n)}`;
  if (n === 99) return `C`;
  return `P${n}`;
}

export function pisoCortoLoose(v: unknown): string {
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  if (isNaN(n)) return '';
  return pisoCorto(n);
}

// The label a bajante actually renders with on the canvas (renderBajantes.ts) — code stripped of
// '#' and uppercased, plus the short floor suffix ("BAN1-P1", "MAF1-S2", "BALL1-C"). Reused by
// cross-floor association alerts so they quote the visual label, not the bare id/code.
export function buildBajanteVisualLabel(
  b: { code?: string | null; id?: string | null } | null | undefined,
  pisoCortoStr?: string,
): string {
  const code = (b?.code || '').replace(/#/g, '').toUpperCase();
  if (code) return `${code}${pisoCortoStr ? '-' + pisoCortoStr : ''}`;
  const id = (b?.id || '').replace(/#/g, '').toUpperCase();
  return `${id}${pisoCortoStr ? '-' + pisoCortoStr : ''}`;
}

// Short material label used ONLY on the canvas drawing labels (renderRamales/renderBajantes).
// Tables, memorias and catalogs keep the full material name — this map is a pure rendering
// abbreviation. Matching is case/accent-insensitive and also covers the short forms the app's
// own catalogs store (e.g. "Acero HG", "PE al PE"), so project-specific long names and the
// built-in short names both collapse to the same drawing label.
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

export function matDrawingLabel(material?: string | null): string {
  if (!material) return '';
  const norm = material
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  for (const [re, abbr] of MAT_DRAWING_ABBREV) {
    if (re.test(norm)) return abbr;
  }
  return material;
}

// Full display name for the material dropdown in the ramal context menu — the stored values are
// the short catalog forms ("Acero HG", "PE al PE", "A.C.", ...) but the user picks from the full
// names ("Acero galvanizado", "Polietileno", "Acero al carbono", ...). The abbreviation mapping
// (matDrawingLabel) is applied only to the canvas drawing label, never here.
const MAT_FULLNAME: Array<[RegExp, string]> = [
  [/acero\s*galvanizado|acero\s*hg/i, 'Acero galvanizado'],
  [/polietileno|pe\s*al\s*pe|^pead$/i, 'Polietileno'],
  [/acero\s*al\s*carbono|^a\.c\.$/i, 'Acero al carbono'],
  [/cobre\s*flexible/i, 'Cobre flexible'],
  [/cobre\s*rigido|rígido/i, 'Cobre rígido'],
];

export function matFullName(material?: string | null): string {
  if (!material) return '';
  const norm = material
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  for (const [re, name] of MAT_FULLNAME) {
    if (re.test(norm)) return name;
  }
  return material;
}
