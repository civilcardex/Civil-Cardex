/** Barra de SETPOINT del EPC (ped. 2026-11-20 — port de svgSetpoint del HTML de referencia): línea de
 *  presiones mín. descarga → arranque → P objetivo → parada con la marca de la parada máxima
 *  admisible del Perfil (si existe); etiquetas arriba y abajo con resolución de colisión.
 *  Función PURA sobre EpcR + unidad de presentación. Ej: svgSetpoint(calc, 'm.c.a.', 1). */
import type { EpcR } from './epEngine.ts';

const F = (n: number, d = 2): string =>
  isFinite(n)
    ? n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

const UNI: Record<string, { f: number; s: string; d: number }> = {
  mca: { f: 1, s: 'm.c.a.', d: 1 },
  bar: { f: 0.0980665, s: 'bar', d: 2 },
  psi: { f: 1.42197, s: 'psi', d: 1 },
  kpa: { f: 9.80665, s: 'kPa', d: 0 },
};

/** Barra SVG del setpoint. Ej: svgSetpoint(calc,'m.c.a.',1) con las 5 marcas. */
export function svgSetpoint(r: EpcR, unidad: string): string {
  const U = UNI[unidad] || UNI.mca;
  const P = (v: number): string => F(v * U.f, U.d);
  const { pdesc, ponMca, pset, poffMca, poffmax } = r;
  const lo = Math.floor(Math.min(pdesc) - 4);
  const hi = Math.ceil(Math.max(poffMca, poffmax || 0) + 4);
  const W = 380,
    H = 74,
    x0 = 8,
    x1 = W - 8;
  const X = (v: number): number => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const yB = 30;
  const vrp = poffmax != null && poffMca > poffmax + 1e-6;
  const cM = vrp ? '#2E6DA4' : '#A32D2D';
  const FF = "'Segoe UI',system-ui,sans-serif";
  let g = `<rect x="${x0}" y="${yB}" width="${x1 - x0}" height="10" rx="5" fill="#EEF2F6"/>`;
  g +=
    `<rect x="${X(pdesc)}" y="${yB}" width="${X(ponMca) - X(pdesc)}" height="10" fill="#B7D4C2"/>` +
    `<rect x="${X(ponMca)}" y="${yB}" width="${X(poffMca) - X(ponMca)}" height="10" fill="#2D6A4F" opacity=".75"/>`;
  if (poffmax != null && poffmax < hi)
    g += `<rect x="${X(poffmax)}" y="${yB - 6}" width="${Math.max(x1 - X(poffmax), 0)}" height="22" fill="${cM}" opacity=".12"/><line x1="${X(poffmax)}" y1="${yB - 10}" x2="${X(poffmax)}" y2="${yB + 20}" stroke="${cM}" stroke-width="2" stroke-dasharray="4 2"/>`;
  const top: Array<[number, string, string]> = [
    [ponMca, `arranque ${P(ponMca)}`, '#2D6A4F'],
    [poffMca, `parada ${P(poffMca)}`, '#D85A30'],
  ];
  const bot: Array<[number, string, string]> = [
    [pdesc, `mín ${P(pdesc)}`, '#5B7A99'],
    [pset, `P objetivo ${P(pset)}`, '#1A3A5C'],
  ];
  if (poffmax != null)
    top.push([poffmax, vrp ? `máx sin VRP ${P(poffmax)}` : `máx ${P(poffmax)}`, cM]);
  const lay = (L2: Array<[number, string, string]>, rows: number[]): string => {
    const used: Array<Array<[number, number]>> = rows.map(() => []);
    return L2.sort((a, b) => a[0] - b[0])
      .map(([v, t, c]) => {
        const w = t.length * 4.7;
        const x = Math.min(Math.max(X(v), x0 + w / 2), x1 - w / 2);
        let row = 0;
        while (
          row < rows.length - 1 &&
          used[row].some(([a, b]) => x - w / 2 < b + 4 && x + w / 2 > a - 4)
        )
          row++;
        used[row].push([x - w / 2, x + w / 2]);
        return `<text x="${x}" y="${rows[row]}" font-size="8.5" text-anchor="middle" fill="${c}" font-weight="700" font-family="${FF}">${t}</text>`;
      })
      .join('');
  };
  const tick = (v: number, c: string): string =>
    `<line x1="${X(v)}" y1="${yB - 4}" x2="${X(v)}" y2="${yB + 14}" stroke="${c}" stroke-width="2"/>`;
  g +=
    tick(pdesc, '#5B7A99') +
    tick(ponMca, '#2D6A4F') +
    tick(pset, '#1A3A5C') +
    tick(poffMca, '#D85A30') +
    lay(top, [yB - 8, yB - 19]) +
    lay(bot, [yB + 24, yB + 35]);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block" role="img"><title>Setpoint: P mínima en la descarga, arranque, P objetivo, parada y parada máxima admisible</title>${g}</svg>`;
}
