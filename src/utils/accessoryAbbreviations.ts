/**
 * Abbreviations for sanitary and hydraulic accessories.
 * Used in ramal ini/fin fields for compact display.
 */
export const ACC_ABBR: Record<string, string> = {
  sifon: 'Sif',
  codoSube: 'CSub',
  codoBaja: 'CBaj',
  codoReventilado: 'CRev',
  valvCompuerta: 'VCom',
  valvGlobo: 'VGlo',
  valvCheque: 'VChe',
  valvAngulo: 'VAng',
};

/**
 * Get abbreviated label for an accessory key.
 * Falls back to original value if not found.
 */
export function getAccAbbr(key: string): string {
  return ACC_ABBR[key] || key;
}

/**
 * Get bajante display label with piso suffix (e.g. "BAN2-P1")
 */
export function bajanteLabel(b: { code?: string; id?: string; pisoBase?: string } | null | undefined, nivelLabel?: string): string {
  const code = b?.code || b?.id || '';
  const raw = b?.pisoBase || nivelLabel || '';
  const piso = shortenPiso(raw);
  return piso ? `${code}-${piso}` : code;
}

function shortenPiso(s: string): string {
  const m = s.match(/^Piso\s+(\d+)$/i);
  if (m) return `P${m[1]}`;
  const m2 = s.match(/^S[óo]tano\s+(\d+)$/i);
  if (m2) return `S${m2[1]}`;
  if (/^Cubierta$/i.test(s)) return 'C';
  return s;
}

/**
 * Reverse mapping: full label → key
 */
export const ACC_LABEL_TO_KEY: Record<string, string> = {
  'Sif': 'sifon',
  'CSub': 'codoSube',
  'CBaj': 'codoBaja',
  'CRev': 'codoReventilado',
  'VCom': 'valvCompuerta',
  'VGlo': 'valvGlobo',
  'VChe': 'valvCheque',
  'VAng': 'valvAngulo',
};