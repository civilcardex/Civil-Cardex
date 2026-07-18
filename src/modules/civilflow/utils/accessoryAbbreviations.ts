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
  llaveTerminal: 'LLT',
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
 * Get bajante display label with piso suffix (e.g. "BAN2-P1")
 */
export function bajanteLabel(b: { code?: string; id?: string; pisoBase?: string } | null | undefined, nivelLabel?: string): string {
  const code = b?.code || b?.id || '';
  const raw = b?.pisoBase || nivelLabel || '';
  const piso = shortenPiso(raw);
  return piso ? `${code}-${piso}` : code;
}

/**
 * Get ramal display label with the current-floor suffix (e.g. "RS1-P1") — matches the label
 * drawn on canvas by renderRamales, which always suffixes with the CURRENT floor (a ramal has
 * no pisoBase of its own, unlike a bajante).
 */
export function ramalLabel(r: { label?: string; id?: string } | null | undefined, nivelLabel?: string): string {
  const code = r?.label || r?.id || '';
  const piso = nivelLabel ? shortenPiso(nivelLabel) : '';
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
