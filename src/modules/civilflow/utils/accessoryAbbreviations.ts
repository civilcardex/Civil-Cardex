/**
 * Abreviaturas para accesorios sanitarios e hidráulicos.
 * Usadas en los campos ini/fin de ramal para mostrar de forma compacta.
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
  teeLlaveTerminal: 'TLLTERM',
  codo90rc: 'C90C',
  codo45rc: 'C45C',
  codo90rm: 'C90M',
  codo90rl: 'C90L',
  teeDirecto: 'TDIR',
  teeReduccion: 'TRED',
  teeLado: 'TLAD',
  valvPie: 'VPIE',
  reduccion: 'RED',
  ampliacion: 'AMP',
  otros: 'OTR',
  yeeSimple: 'YSIM',
  yeeDoble: 'YDOB',
  codo90rmSube: 'CSUB',
  codo90rmBaja: 'CBAJ',
  codos_90_std: 'C90S',
  codos_90_std_sube: 'C90S_SUB',
  codos_90_std_baja: 'C90S_BAJ',
  codos_90_rl: 'C90L',
  codos_90_rl_sube: 'C90L_SUB',
  codos_90_rl_baja: 'C90L_BAJ',
  te_linea: 'TLIN',
  te_ramal: 'TRAM',
  valvula_bola: 'VBOL',
};

/**
 * Etiqueta de visualización de bajante con sufijo de piso (p. ej. "BAN2-P1").
 * @param b - Objeto tipo bajante con code, id, pisoBase opcionales.
 * @param nivelLabel - Etiqueta de nivel de respaldo si pisoBase está ausente.
 * @returns Etiqueta formateada como "BAN2-P1" o code pelado.
 */
export function bajanteLabel(
  b: { code?: string; id?: string; pisoBase?: string } | null | undefined,
  nivelLabel?: string,
): string {
  const code = b?.code || b?.id || '';
  const raw = b?.pisoBase || nivelLabel || '';
  const piso = shortenPiso(raw);
  return piso ? `${code}-${piso}` : code;
}

/**
 * Etiqueta de visualización de ramal con el sufijo del piso actual (p. ej. "RS1-P1") — coincide
 * con la etiqueta dibujada en canvas por renderRamales, que siempre añade el sufijo del PISO
 * ACTUAL (un ramal no tiene pisoBase propio, a diferencia de un bajante).
 * @param r - Objeto tipo ramal con label, id opcionales.
 * @param nivelLabel - Etiqueta del piso actual para el sufijo.
 * @returns Etiqueta formateada como "RS1-P1" o id pelado.
 */
export function ramalLabel(
  r: { label?: string; id?: string } | null | undefined,
  nivelLabel?: string,
): string {
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
