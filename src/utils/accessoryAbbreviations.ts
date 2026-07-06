/**
 * Abbreviations for sanitary and hydraulic accessories.
 * Used in ramal ini/fin fields for compact display.
 */
export const ACC_ABBR: Record<string, string> = {
  sifon: 'SIF',
  codoSube: 'CSUB',
  codoBaja: 'CBAJ',
  codoReventilado: 'CREV',
  valvCompuerta: 'VCOM',
  valvGlobo: 'VGLO',
  valvCheque: 'VCHE',
  valvAngulo: 'VANG',
  codo90rc: 'C90C',
  codo45rc: 'C45C',
  codo90rm: 'C90M',
  codo90rl: 'C90L',
  teeDirecto: 'TDIR',
  teeReduccion: 'TRED',
  teeLado: 'TLAD',
  teeBilateral: 'TBIL',
  valvPie: 'VPIE',
  reduccion: 'RED',
  ampliacion: 'AMP',
  otros: 'OTR',
  yeeSimple: 'YSIM',
  yeeDoble: 'YDOB',
  codo90rmSube: 'CSUB',
  codo90rmBaja: 'CBAJ',
  codos_90_std: 'C90S',
  codos_90_rl: 'C90L',
  te_linea: 'TLIN',
  te_ramal: 'TRAM',
  valvula_bola: 'VBOL',
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
  'SIF': 'sifon',
  'CSUB': 'codoSube',
  'CBAJ': 'codoBaja',
  'CREV': 'codoReventilado',
  'VCOM': 'valvCompuerta',
  'VGLO': 'valvGlobo',
  'VCHE': 'valvCheque',
  'VANG': 'valvAngulo',
  'C90C': 'codo90rc',
  'C45C': 'codo45rc',
  'C90M': 'codo90rm',
  'C90L': 'codo90rl',
  'TDIR': 'teeDirecto',
  'TRED': 'teeReduccion',
  'TLAD': 'teeLado',
  'TBIL': 'teeBilateral',
  'VPIE': 'valvPie',
  'RED': 'reduccion',
  'AMP': 'ampliacion',
  'OTR': 'otros',
  'YSIM': 'yeeSimple',
  'YDOB': 'yeeDoble',
  'C90S': 'codos_90_std',
  'TLIN': 'te_linea',
  'TRAM': 'te_ramal',
  'VBOL': 'valvula_bola',
};