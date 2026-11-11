// @vitest-environment node
/**
 * Contraste WCAG OFFLINE de los tokens del tema: lee src/styles/tokens.css como TEXTO,
 * parsea los hex de :root y de .landing-root, y afirma que cada par exigido cumple
 * 4.5:1 (texto normal) o 3:1 (texto grande ≥18.66px o bold). Sin jsdom ni axe: jsdom no
 * computa estilos (por eso color-contrast está excluido de los tests axe) — aquí el
 * contraste se demuestra con matemática pura sobre los tokens reales. Ej: si alguien
 * aclara --txt3 a #8a9293 (4.0:1 sobre bg2), este test rompe y lo dice con números.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');

/** Extrae `--nombre: #rrggbb` de un bloque CSS (regex simple: los tokens son hex plano,
 *  sin var() anidados en los colores que este test mira). Ej: `--bg: #111317;` -> {bg}. */
function hexesDe(bloque: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of bloque.matchAll(/--([a-z0-9]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const raiz = hexesDe(css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '');
const landing = hexesDe(css.match(/\.landing-root\s*\{([^}]*)\}/)?.[1] ?? '');

/** Ratio de contraste WCAG (luminancia relativa): entre 1:1 (invisible) y 21:1
 *  (negro sobre blanco). Ej: #fff sobre #000 -> 21. */
function ratio(frente: string, fondo: string): number {
  const lum = (hex: string): number => {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [lum(frente), lum(fondo)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Pares de TEXTO NORMAL: [frente, fondo, mínimo]. Todos los textos del tema sobre sus
 *  superficies reales (bg/bg2/bg3) y los colores de estado usados como texto de alertas. */
const PARES_TEXTO: Array<[string, string, number]> = [
  ['txt', 'bg', 4.5],
  ['txt', 'bg2', 4.5],
  ['txt', 'bg3', 4.5],
  ['txt2', 'bg', 4.5],
  ['txt2', 'bg2', 4.5],
  ['txt3', 'bg2', 4.5],
  ['txt3', 'bg3', 4.5],
  ['acc2', 'bg', 4.5], // enlaces y énfasis azules (acc2 #3b82f6) sobre el fondo base
  ['ok', 'bg', 4.5],
  ['warn', 'bg', 4.5],
  ['err', 'bg', 4.5],
];

/** Pares GRANDES (≥18.66px o bold ≥14px, umbral 3:1): el acento azul primario #2563eb
 *  solo se usa como texto en tamaños grandes/bold (títulos de marca, botones). */
const PARES_GRANDES: Array<[string, string, number]> = [
  ['acc', 'bg', 3], // medido 3.60
  ['acc', 'bg2', 3], // medido 3.30
];

/** Excluidos con ratio real medido (el test documenta el estado, no rompe la ronda):
 *  acc3 (#1d4ed8) sobre bg = 2.77:1 — NO llega ni a 3:1. Hoy acc3 NO se usa como texto
 *  directo (solo es --color-primary-fixed-dim en la paleta Tailwind); si alguien lo pinta
 *  como texto, esto es el número contra el que discutir. */

describe('contraste WCAG de los tokens (tokens.css real)', () => {
  it('el parse encuentra las familias del tema (superficies, textos, acentos, estados)', () => {
    for (const k of [
      'bg',
      'bg2',
      'bg3',
      'bg4',
      'bg5',
      'txt',
      'txt2',
      'txt3',
      'acc',
      'acc2',
      'acc3',
      'ok',
      'warn',
      'err',
    ]) {
      expect(raiz[k], `--${k} debe ser hex #rrggbb`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    // .landing-root redefine solo los acentos (dorados).
    for (const k of ['acc', 'acc2', 'acc3']) {
      expect(landing[k], `.landing-root --${k}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('la función ratio calcula WCAG de referencia (negro/blanco = 21)', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('los pares de texto normal llegan a 4.5:1', () => {
    for (const [f, b, min] of PARES_TEXTO) {
      expect(ratio(raiz[f], raiz[b]), `${f} sobre ${b}`).toBeGreaterThanOrEqual(min);
    }
  });

  it('los pares de texto grande llegan a 3:1', () => {
    for (const [f, b, min] of PARES_GRANDES) {
      expect(ratio(raiz[f], raiz[b]), `${f} sobre ${b}`).toBeGreaterThanOrEqual(min);
    }
  });

  it('landing: acentos dorados sobre bg y el texto oscuro sobre dorado (4.5:1)', () => {
    // La landing redefine acc/acc2/acc3 a dorados: contraste de cada uno sobre el mismo
    // bg, y del texto oscuro #101216 (botones dorados usan texto casi negro) sobre ellos.
    expect(ratio(landing.acc, raiz.bg), 'landing acc sobre bg').toBeGreaterThanOrEqual(4.5);
    expect(ratio(landing.acc2, raiz.bg), 'landing acc2 sobre bg').toBeGreaterThanOrEqual(4.5);
    expect(ratio(landing.acc3, raiz.bg), 'landing acc3 sobre bg').toBeGreaterThanOrEqual(4.5);
    expect(ratio('#101216', landing.acc), '#101216 sobre landing acc').toBeGreaterThanOrEqual(4.5);
    expect(ratio('#101216', landing.acc2), '#101216 sobre landing acc2').toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
