import { FRAC_CHAR_TO_DEC } from './diamPulgFromLabel.ts';

const DEC_KEYS = [0.5, 0.75, 0.25, 0.125, 0.375, 0.625, 0.875];
const FRAC: Record<number, string> = Object.fromEntries(
  Object.entries(FRAC_CHAR_TO_DEC)
    .filter(([, dec]) => DEC_KEYS.includes(dec))
    .map(([ch, dec]) => [dec, ch]),
);

/**
 * Formatea un número para las tablas (p. ej. 3.1416 con 2 decimales → '3.14'); si no hay dato muestra "—".
 * @param v - Valor a formatear.
 * @param d - Número de decimales (default 2).
 * @returns String formateado o "—".
 */
export const fmt = (v: unknown, d = 2) =>
  v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d);

/**
 * Deja un nombre listo para usarlo como nombre de archivo (solo letras, dígitos,
 * espacios, guiones y guiones bajos; sin acentos ni símbolos raros).
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

/**
 * Pasa pulgadas decimales a la notación comercial de plomería (1.5 → '1-1/2"').
 * @param v - Valor en pulgadas decimales.
 * @returns String en pulgadas fraccionarias o "—" si ≤0.
 */
// Fracciones unicode → ASCII '3/4' + guion comercial en enteros mixtos ('1 ½' → '1-1/2').
const FRAC_ASCII: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};
/** Unicode a ASCII comercial ('½'→'1/2', '1 ½'→'1-1/2'; no-op si ya es ASCII). */
export function fracAscii(s: string): string {
  return s.replace(/(\d)?\s*[\u00a0]?([½⅓⅔¼¾⅛⅜⅝⅞])/g, (_m, ent: string | undefined, f: string) =>
    ent ? `${ent}-${FRAC_ASCII[f] ?? f}` : (FRAC_ASCII[f] ?? f),
  );
}

export function fmtPulg(v: number): string {
  if (!v || v <= 0) return '—';
  const ent = Math.floor(v);
  const dec = Math.round((v - ent) * 1000) / 1000;
  const frac = FRAC[dec];
  if (frac) return ent > 0 ? `${ent}-${fracAscii(frac)}"` : `${fracAscii(frac)}"`;
  if (dec === 0) return `${ent}"`;
  return `${v.toFixed(2)}"`;
}

/** Repara texto que se guardó doble-codificado (los símbolos raros tipo "â€"" o "Â½" vuelven a — y ½); lo que está limpio queda igual. */
// Bytes 0x80-0x9F que CP1252 define (el resto coincide con Latin-1 / es indefinido).
const CP1252_CHAR: Record<number, string> = {
  0x80: '€',
  0x82: '‚',
  0x83: 'ƒ',
  0x84: '„',
  0x85: '…',
  0x86: '†',
  0x87: '‡',
  0x88: 'ˆ',
  0x89: '‰',
  0x8a: 'Š',
  0x8b: '‹',
  0x8c: 'Œ',
  0x8e: 'Ž',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x98: '˜',
  0x99: '™',
  0x9a: 'š',
  0x9b: '›',
  0x9c: 'œ',
  0x9e: 'ž',
  0x9f: 'Ÿ',
};
const CP1252_BYTE: Record<number, number> = Object.fromEntries(
  Object.entries(CP1252_CHAR).map(([b, ch]) => [ch.charCodeAt(0), Number(b)]),
);

function charToByte(ch: string): number | null {
  const o = ch.charCodeAt(0);
  if (o < 0x80) return o;
  if (o < 0x100) return o;
  return CP1252_BYTE[o] ?? null;
}

function lenientUtf8(bytes: number[]): string {
  let out = '';
  const emitRaw = (b: number) => {
    out +=
      b < 0x80 || b > 0x9f ? String.fromCharCode(b) : (CP1252_CHAR[b] ?? String.fromCharCode(b));
  };
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i++;
      continue;
    }
    const len = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 0;
    if (len === 0 || i + len > bytes.length) {
      emitRaw(b);
      i++;
      continue;
    }
    let cp = b & (0xff >> (len + 1));
    let ok = true;
    for (let j = 1; j < len; j++) {
      const c = bytes[i + j];
      if ((c & 0xc0) !== 0x80) {
        ok = false;
        break;
      }
      cp = (cp << 6) | (c & 0x3f);
    }
    if (ok && cp >= 0x80) {
      out += String.fromCodePoint(cp);
      i += len;
    } else {
      emitRaw(b);
      i++;
    }
  }
  return out;
}

export function sanitizeMojibake(s: string): string {
  if (!s) return s;
  let out = '';
  let run: number[] = [];
  const flush = () => {
    if (run.length) out += lenientUtf8(run);
    run = [];
  };
  for (const ch of s) {
    const b = charToByte(ch);
    if (b == null) {
      flush();
      out += ch;
    } else {
      run.push(b);
    }
  }
  flush();
  // "Â" que sobrevive al decodificador es un primer byte huérfano (p. ej. "Â" solo) — sobra.
  return out.replace(/\u00c2(?![\u0080-\u00bf])/g, '');
}

/**
 * Normaliza la etiqueta de un diámetro a ASCII comercial ("1½" → '1-1/2"'): repara texto
 * viejo mal codificado y quita los caracteres Unicode de fracción.
 * @param dn - String de etiqueta de diámetro cruda.
 * @returns Etiqueta normalizada.
 */
export function normalizeDnLabel(dn: string): string {
  // fracAscii cubre los 3 casos unicode; el guion en mixtos ya-ASCII ('1 1/2') se conserva.
  return fracAscii(sanitizeMojibake(dn)).replace(/(\d+) (\d+\/\d+)/, '$1-$2');
}

/** Primer segmento de una clave compuesta ("SECTOR-resto" → "SECTOR"). */
export function sectorDe(chip: string): string {
  return chip.split('-')[0];
}

/** Último segmento de una clave compuesta ("id-con-guiones-planId" → "planId").
 *  Con lastIndexOf: `split('-')[1]` truncaba ids con guion (AC-01-X-P1). */
export function planIdDeKey(key: string | undefined): string {
  if (!key) return '';
  const sep = key.lastIndexOf('-');
  return sep <= 0 ? '' : key.slice(sep + 1);
}
