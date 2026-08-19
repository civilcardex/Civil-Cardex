import { FRAC_CHAR_TO_DEC } from './diamPulgFromLabel';

const DEC_KEYS = [0.5, 0.75, 0.25, 0.125, 0.375, 0.625, 0.875];
const FRAC: Record<number, string> = Object.fromEntries(
  Object.entries(FRAC_CHAR_TO_DEC)
    .filter(([, dec]) => DEC_KEYS.includes(dec))
    .map(([ch, dec]) => [dec, ch]),
);

/**
 * Formatea un valor a un número fijo de decimales, devolviendo "—" para null/NaN.
 * @param v - Valor a formatear.
 * @param d - Número de decimales (default 2).
 * @returns String formateado o "—".
 */
export const fmt = (v: unknown, d = 2) =>
  v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d);

/**
 * Sanitiza un nombre para usarlo como nombre de archivo: solo letras, dígitos,
 * espacios, guiones y guiones bajos.
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

/**
 * Formatea un valor en pulgadas decimales como string de pulgadas fraccionarias (p. ej.
 * 1.5 → "1 ½"").
 * @param v - Valor en pulgadas decimales.
 * @returns String en pulgadas fraccionarias o "—" si ≤0.
 */
export function fmtPulg(v: number): string {
  if (!v || v <= 0) return '—';
  const ent = Math.floor(v);
  const dec = Math.round((v - ent) * 1000) / 1000;
  const frac = FRAC[dec];
  if (frac) return ent > 0 ? `${ent} ${frac}"` : `${frac}"`;
  if (dec === 0) return `${ent}"`;
  return `${v.toFixed(2)}"`;
}

const FRAC_MAP: Record<string, string> = {
  '⅜': '3/8',
  '½': '1/2',
  '⅔': '2/3',
  '⅓': '1/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅛': '1/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

/**
 * Repara mojibake Latin-1/CP1252 (doble codificación UTF-8→CP1252→UTF-8) persistido por
 * versiones anteriores de la app o presente en textos viejos: "â€\u201D" → "—", "á" → "á",
 * "⇄" → "⇄", "½" → "½", etc. Los textos afectados muestran "Â"/"â" ("A con sombrero") en
 * etiquetas, menús, tablas y exports.
 *
 * Algoritmo: cada run de caracteres mapeables a bytes CP1252 se convierte a bytes y se
 * decodifica como UTF-8 con un decodificador TOLERANTE — las secuencias UTF-8 válidas se
 * reparan y los bytes sueltos inválidos se re-emiten como su carácter CP1252 original, así
 * un texto que mezcla caracteres limpios ("ó") con mojibake ("â€\u201D") se repara sin
 * tocar lo limpio. El texto ya limpio queda idéntico (cada carácter se re-emite a sí mismo).
 */
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
 * Normaliza una etiqueta de diámetro reemplazando los caracteres Unicode de fracción por
 * equivalentes ASCII (p. ej. "1½" → "1-1/2").
 * @param dn - String de etiqueta de diámetro cruda.
 * @returns Etiqueta normalizada.
 */
export function normalizeDnLabel(dn: string): string {
  let out = sanitizeMojibake(dn);
  for (const [uni, ascii] of Object.entries(FRAC_MAP)) {
    out = out.replace(new RegExp(`(\\d)(${uni})`, 'g'), `$1-${ascii}`);
    out = out.split(uni).join(ascii);
  }
  out = out.replace(/(\d+) (\d+\/\d+)/, '$1-$2');
  return out;
}
