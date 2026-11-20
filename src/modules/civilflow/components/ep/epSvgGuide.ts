/** Esquema GUÍA del EPC (ped. 2026-11-20 — port de svgGuia del HTML de referencia): corte de referencia
 *  con edificio/piso crítico/cuarto de bombas/cisterna y el recorrido real de presiones. Cada
 *  dato tiene un grupo `id="g-*"` (g-hf Hf_ac · g-hfo Hf_otros · g-pred Pred · g-zcis z_cis ·
 *  g-hfs Hf_suc · g-pm Pmin/aparato · g-zb z_bomba · g-zt z_top · g-hg Hg · g-lift elevación)
 *  que el panel flotante RESALTA con hover/click en los ⓘ de los campos. Función PURA sobre
 *  EpcR + apcrit — string SVG con contenido numérico formateado. Ej: svgGuia(calc,'Ducha'). */
import type { EpcR } from './epEngine.ts';

const C = {
  suc: '#2E6DA4',
  imp: '#D85A30',
  ink: '#1A3A5C',
  gr: '#888780',
  lt: '#D0D0D0',
  rd: '#A32D2D',
  am: '#BA7517',
  azl: '#D6E4F0',
};
const ln = (x1: number, y1: number, x2: number, y2: number, c: string, w = 2, da = ''): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"${da ? ` stroke-dasharray="${da}"` : ''}/>`;
const tx = (
  x: number,
  y: number,
  t: string,
  o: {
    s?: number;
    c?: string;
    b?: boolean | number;
    a?: 'start' | 'middle' | 'end';
    r?: number;
  } = {},
): string =>
  `<text x="${x}" y="${y}" font-size="${o.s ?? 9.5}" fill="${o.c ?? '#3A3A3A'}" font-weight="${o.b ? 700 : 400}" text-anchor="${o.a ?? 'middle'}" font-family="'Segoe UI',system-ui,sans-serif"${o.r ? ` transform="rotate(${o.r} ${x} ${y})"` : ''}>${t}</text>`;
const vc = (x: number, y: number, c: string): string =>
  `<path d="M${x - 5} ${y - 5} L${x - 5} ${y + 5} L${x + 5} ${y - 5} L${x + 5} ${y + 5} Z" fill="#fff" stroke="${c}" stroke-width="1.5"/>`;
const F = (n: number, d = 2): string =>
  isFinite(n)
    ? n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';
const esc = (t: string): string =>
  String(t ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** Corte de referencia. Ej: svgGuia(calc, 'Ducha') resalta el aparato y los recorridos. */
export function svgGuia(r: EpcR, apcrit: string): string {
  const isRed = r.hsuc < 0;
  const W = 600,
    H = 470;
  const yG = 330,
    yB = 392,
    yRoof = 120,
    yNPT = 180,
    yAp = 150;
  const xM = 330,
    xA = 470,
    xPump = 200,
    xDesc = 268,
    xB0 = 300,
    xB1 = 540;
  const dim = (
    id: string,
    x: number,
    y1: number,
    y2: number,
    t: string,
    side: 'l' | 'r' | null,
    c?: string,
  ): string => {
    c = c || C.ink;
    return `<g class="gg"${id ? ` id="${id}"` : ''}>${ln(x, y1, x, y2, c, 1.2)}<path d="M${x - 4} ${y1 + 7} L${x} ${y1} L${x + 4} ${y1 + 7}M${x - 4} ${y2 - 7} L${x} ${y2} L${x + 4} ${y2 - 7}" fill="none" stroke="${c}" stroke-width="1.2"/>${tx(x + (side === 'l' ? -6 : 6), (y1 + y2) / 2 + 3, t, { a: side === 'l' ? 'end' : 'start', s: 9.5, c, b: true })}</g>`;
  };
  let g = '';
  // edificio
  g += `<rect x="${xB0}" y="${yRoof}" width="${xB1 - xB0}" height="${yNPT - yRoof}" fill="#FFF4DD"/>`;
  [yRoof, yNPT, 230, 280].forEach((y) => (g += ln(xB0, y, xB1, y, '#C9C9C9', 3)));
  g += ln(xB0, yRoof, xB0, yG, '#C9C9C9', 2) + ln(xB1, yRoof, xB1, yG, '#C9C9C9', 2);
  g +=
    TX(xB1 - 4, yNPT - 6, 'Piso crítico', { a: 'end', s: 8.5, c: C.am, b: 1 }) +
    TX(xB1 - 4, yNPT + 12, 'NPT', { a: 'end', s: 8, c: C.gr }) +
    TX(xB1 - 4, 306, '⋮ pisos intermedios', { a: 'end', s: 8, c: C.gr });
  // terreno
  g +=
    ln(10, yG, W - 10, yG, '#8D6E63', 2) +
    TX(W - 12, yG - 5, 'Terreno', { a: 'end', s: 8, c: '#8D6E63' });
  // cuarto de bombas
  g +=
    `<rect x="140" y="${yB - 30}" width="${xM - 120}" height="62" fill="none" stroke="#BDBDBD" stroke-dasharray="5 3"/>` +
    TX(xM + 16, yB + 28, 'Cuarto de bombas', { a: 'start', s: 8, c: C.gr });
  g += `<circle cx="${xPump}" cy="${yB}" r="13" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/><path d="M${xPump - 6} ${yB + 7} L${xPump + 7} ${yB} L${xPump - 6} ${yB - 7} Z" fill="${C.ink}"/>`;
  g += `<g class="gg" id="g-hfo">${ln(xPump + 13, yB, xDesc, yB, C.imp, 3)}${TX((xPump + xDesc) / 2 + 6, yB - 8, `Hf_otros ${F(r.hfotros, 1)}`, { s: 8.5, c: C.imp, b: 1 })}</g>`;
  g += `<g class="gg" id="g-zb"><circle cx="${xDesc}" cy="${yB}" r="5" fill="${C.ink}"/>${TX(xDesc, yB + 18, 'Descarga · transductor', { s: 8.5, c: C.ink, b: 1 })}${TX(xDesc, yB + 30, `z_bomba ${F(r.zbomba)} m`, { s: 8.5, c: C.ink })}</g>`;
  // recorrido Hf_ac
  const yR = yNPT - 14;
  g += `<g class="gg" id="g-hf"><path d="M${xDesc} ${yB} H${xM} V${yR} H${xA} V${yAp + 6}" fill="none" stroke="${C.imp}" stroke-width="3"/><rect x="${xM + 28}" y="${yR - 8}" width="22" height="16" rx="2" fill="#fff" stroke="${C.imp}" stroke-width="1.3"/>${TX(xM + 39, yR + 3.5, 'CC', { s: 7.5, c: C.imp, b: 1 })}${TX(xM + 10, 250, `Hf_ac ${F(r.hfac, 1)} m.c.a.`, { a: 'start', s: 9.5, c: C.imp, b: 1 })}${TX(xM + 10, 264, 'descarga → montante → centro de medidores', { a: 'start', s: 8, c: C.gr })}${TX(xM + 10, 276, '→ medidor → red interna → aparato', { a: 'start', s: 8, c: C.gr })}${TX(xM - 8, 300, 'Montante', { a: 'end', s: 8.5, c: C.imp, r: -90 })}</g>`;
  // aparato crítico
  g += `<g class="gg" id="g-pm"><path d="M${xA - 12} ${yAp - 10} h24 l-4 10 h-16 z" fill="#fff" stroke="${C.ink}" stroke-width="1.4"/>${TX(xA + 16, yAp - 12, esc(apcrit) || 'Aparato crítico', { a: 'start', s: 8.5, c: C.ink, b: 1 })}${TX(xA + 16, yAp, `Pmin ${F(r.pmin)} m.c.a.`, { a: 'start', s: 8.5, c: C.rd, b: 1 })}</g>`;
  g += `<g class="gg" id="g-zt">${ln(xB0 + 20, yAp, xA - 14, yAp, C.ink, 1, '3 2')}${TX(xB0 + 22, yAp - 5, `z_top ${F(r.ztop)} m (salida)`, { a: 'start', s: 8.5, c: C.ink, b: 1 })}</g>`;
  g += dim('', xA - 30, yAp, yNPT, 'h', null, C.gr);
  // Hg
  g += dim('g-hg', W - 24, yAp, yB, `Hg ${F(r.hg, 1)} m`, 'l');
  g += ln(xA + 6, yAp, W - 18, yAp, C.lt, 1, '2 3') + ln(xDesc + 8, yB, W - 18, yB, C.lt, 1, '2 3');
  // succión
  if (isRed) {
    g +=
      ln(14, yB, xPump - 13, yB, C.suc, 3) +
      vc(40, yB, C.ink) +
      `<rect x="58" y="${yB - 8}" width="18" height="16" rx="2" fill="#fff" stroke="${C.suc}"/>` +
      TX(67, yB + 4, 'M', { s: 8, c: C.suc, b: 1 }) +
      TX(16, yB - 14, 'Acometida', { a: 'start', s: 9, c: C.suc, b: 1 });
    g += `<g class="gg" id="g-pred">${ln(158, yB, 158, yB - 20, C.gr, 1.2)}<circle cx="158" cy="${yB - 28}" r="8" fill="#fff" stroke="${C.suc}" stroke-width="1.4"/>${TX(158, yB - 25, 'P', { s: 7.5, c: C.suc, b: 1 })}${TX(158, yB - 42, `Pred ${F(r.pred, 1)} m.c.a.`, { s: 8.5, c: C.suc, b: 1 })}${TX(158, yB - 54, 'en la succión', { s: 8, c: C.gr })}</g>`;
  } else {
    const cx0 = 14,
      cw = 104,
      cy0 = yB - 18,
      chh = H - 12 - cy0,
      yN = cy0 + chh - 20;
    g +=
      `<rect x="${cx0}" y="${cy0}" width="${cw}" height="${chh}" fill="${C.azl}" stroke="${C.suc}" stroke-width="1.4"/>` +
      TX(cx0 + 2, cy0 - 6, 'Cisterna', { a: 'start', s: 9, c: C.suc, b: 1 }) +
      ln(cx0, cy0 + 12, cx0 + cw, cy0 + 12, C.suc, 1, '4 3') +
      TX(cx0 + cw - 4, cy0 + 10, 'NAV', { a: 'end', s: 7.5, c: C.suc });
    g += `<g class="gg" id="g-zcis">${ln(cx0, yN, cx0 + cw, yN, C.rd, 1.6, '4 3')}${TX(cx0 + 4, yN - 4, `NAM ${F(r.zcis)} m`, { a: 'start', s: 8.5, c: C.rd, b: 1 })}</g>`;
    g += `<g class="gg" id="g-hfs"><path d="M${cx0 + cw - 18} ${cy0 + chh - 6} V${yB} H${xPump - 13}" fill="none" stroke="${C.suc}" stroke-width="3"/><path d="M${cx0 + cw - 24} ${cy0 + chh - 6} h12 l-6 7 z" fill="${C.suc}"/>${TX(150, yB - 10, `Hf_suc ${F(r.hfcis, 1)}`, { s: 8.5, c: C.suc, b: 1 })}</g>`;
    g += dim('g-lift', 132, yB, yN, `${F(r.zbomba - r.zcis, 1)}`, 'r', C.rd);
  }
  // resumen
  g +=
    `<rect x="12" y="12" width="262" height="60" rx="5" fill="#F4F7FA" stroke="${C.lt}"/>` +
    TX(20, 29, 'P mín. descarga = Hg + Hf_ac + Pmin', { a: 'start', s: 9.5, c: C.ink, b: 1 }) +
    TX(20, 45, `= ${F(r.hg, 1)} + ${F(r.hfac, 1)} + ${F(r.pmin, 2)} = ${F(r.pdesc, 1)} m.c.a.`, {
      a: 'start',
      s: 9.5,
      c: C.ink,
    }) +
    TX(20, 61, `arranque ${F(r.ponMca, 1)} · parada ${F(r.poffMca, 1)} · HMT ${F(r.hmt, 1)}`, {
      a: 'start',
      s: 9,
      c: C.gr,
    });
  if (r.ztop <= r.zbomba)
    g += TX(W / 2, 100, '⚠ z_top debe estar por encima de z_bomba', { s: 10, c: C.rd, b: 1 });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" class="guia-svg"><title>Esquema guía de cotas y presiones del equipo</title>${g}</svg>`;
}

function TX(x: number, y: number, t: string, o: Parameters<typeof tx>[3]): string {
  return tx(x, y, t, o);
}
