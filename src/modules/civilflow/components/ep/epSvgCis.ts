/** SVGs esquemáticos de la cisterna EPC (F2, ped. 2026-11-19): planta (dimensiones internas,
 *  compartimentos, llenado/succión/desagüe por compartimento, tapa, caja de descarga) y corte
 *  (bandas a escala: sedimentos/RCI/sumergencia/útil/borde libre, NAM/NAV, toma con campana,
 *  rebose, cotas). Port de svgPlanta/svgCorte del HTML de referencia — funciones PURAS sobre
 *  EpcCis + cotas, string SVG listo para dangerouslySetInnerHTML (todo el contenido numérico
 *  sale de F() con toLocaleString — sin texto de usuario sin escapar). Ej: svgCorte(r) dentro
 *  de un <div dangerouslySetInnerHTML>. */

const C = { suc: '#2E6DA4', ink: '#1A3A5C', gr: '#888780', rd: '#A32D2D', azl: '#D6E4F0' };
const F = (n: number, d = 2): string =>
  isFinite(n)
    ? n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';
const ln = (x1: number, y1: number, x2: number, y2: number, c: string, w = 2, da = ''): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"${da ? ` stroke-dasharray="${da}"` : ''}/>`;
const tx = (
  x: number,
  y: number,
  t: string,
  o: { s?: number; c?: string; b?: number | boolean; a?: 'start' | 'middle' | 'end' } = {},
): string =>
  `<text x="${x}" y="${y}" font-size="${o.s ?? 9.5}" fill="${o.c ?? '#3A3A3A'}" font-weight="${o.b ? 700 : 400}" text-anchor="${o.a ?? 'middle'}" font-family="'Segoe UI',system-ui,sans-serif">${t}</text>`;

/** Planta esquemática de la cisterna (dimensiones internas, por compartimento). */
export function svgPlantaCis(cis: { nC: number; lC: number; bC: number; A: number }): string {
  const { nC, lC, bC, A } = cis;
  if (!lC || !bC) return '';
  const W = 460,
    H = 270,
    x0 = 95,
    y0 = 46;
  const sc = Math.min(230 / lC, 165 / (nC * bC));
  const w = lC * sc,
    h = nC * bC * sc,
    x1 = x0 + w,
    y1 = y0 + h,
    hb = bC * sc;
  let g = '';
  g += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${C.azl}" stroke="${C.ink}" stroke-width="5"/>`;
  for (let i = 1; i < nC; i++)
    g += `<rect x="${x0}" y="${y0 + i * hb - 3}" width="${w}" height="6" fill="#B8C4D0" stroke="${C.ink}" stroke-width="1"/>`;
  const vcS = (x: number, y: number, fill: number | boolean): string =>
    `<path d="M${x - 5} ${y - 5} L${x - 5} ${y + 5} L${x + 5} ${y - 5} L${x + 5} ${y + 5} Z" fill="${fill ? C.ink : '#fff'}" stroke="${C.ink}" stroke-width="1.3"/>`;
  const xe = x0 - 46,
    xs = x1 + 40;
  for (let i = 0; i < nC; i++) {
    const ya = y0 + i * hb + hb * 0.32,
      yb = y0 + (i + 1) * hb - hb * 0.22,
      lab = nC === 2 ? 'AB'[i] : '';
    // Llenado con flotador (lado opuesto a la succión)
    g +=
      ln(xe, ya, x0 + 14, ya, C.suc, 3) +
      vcS(x0 - 24, ya, false) +
      `<line x1="${x0 + 14}" y1="${ya}" x2="${x0 + 26}" y2="${ya + 8}" stroke="${C.suc}" stroke-width="1.6"/><circle cx="${x0 + 30}" cy="${ya + 10}" r="5" fill="#fff" stroke="${C.suc}" stroke-width="1.5"/>`;
    // Pozo de succión + salida
    const px = x1 - 24;
    g +=
      `<rect x="${px - 11}" y="${ya - 11}" width="22" height="22" fill="none" stroke="${C.ink}" stroke-dasharray="3 2"/><circle cx="${px}" cy="${ya}" r="5" fill="${C.ink}"/>` +
      ln(px, ya, xs, ya, C.ink, 3.5) +
      vcS(x1 + 20, ya, false);
    // Sumidero + desagüe
    g +=
      `<rect x="${x0 + 6}" y="${yb - 7}" width="14" height="14" fill="none" stroke="#8D6E63" stroke-dasharray="3 2"/>` +
      ln(x0 + 6, yb, x0 - 60, yb, '#8D6E63', 2.2) +
      vcS(x0 - 24, yb, true);
    // Tapa
    const tw = Math.max(10, 0.6 * sc),
      tx0 = x0 + w * 0.5 - tw / 2;
    g += `<rect x="${tx0}" y="${ya - tw / 2}" width="${tw}" height="${tw}" fill="#fff" stroke="${C.ink}"/><path d="M${tx0} ${ya - tw / 2} l${tw} ${tw} M${tx0 + tw} ${ya - tw / 2} l${-tw} ${tw}" stroke="${C.ink}" stroke-width=".8"/>`;
    if (lab) g += tx(x0 + w * 0.5 + tw / 2 + 12, ya + 4, lab, { s: 13, b: 1, c: C.suc });
  }
  // Colector de succión y salida común
  g +=
    ln(xs, y0 + hb * 0.32, xs, y0 + (nC - 1) * hb + hb * 0.32, C.ink, 3.5) +
    `<path d="M${xs} ${y0 + hb * 0.32 + ((nC - 1) * hb) / 2} H${x1 + 60}" stroke="${C.ink}" stroke-width="3.5"/><path d="M${x1 + 56} ${y0 + hb * 0.32 + ((nC - 1) * hb) / 2 - 5} l8 5 l-8 5z" fill="${C.ink}"/>`;
  if (nC === 2) g += ln(xe, y0 + hb * 0.32, xe, y0 + hb * 1.32, C.suc, 3);
  g +=
    tx(xs + 4, y0 + hb * 0.32 + ((nC - 1) * hb) / 2 + (nC === 2 ? 13 : -8), 'al equipo', {
      a: 'start',
      s: 8,
      c: C.ink,
    }) + tx(xe - 4, y0 + hb * 0.32 - 7, 'Llenado', { a: 'start', s: 8, c: C.suc });
  // Desagüe a caja de descarga libre
  g +=
    ln(x0 - 60, y0 + hb - hb * 0.22, x0 - 60, H - 34, '#8D6E63', 2.2) +
    (nC === 2 ? ln(x0 - 60, y0 + hb - hb * 0.22, x0 - 60, y1 - hb * 0.22, '#8D6E63', 2.2) : '') +
    `<path d="M${x0 - 60} ${H - 34} H${x0 + 40}" stroke="#8D6E63" stroke-width="2.2" fill="none"/><rect x="${x0 + 40}" y="${H - 42}" width="20" height="16" fill="#F7F1EC" stroke="#8D6E63"/>` +
    tx(x0 + 66, H - 30, 'caja de descarga libre → sifón → desagüe', {
      a: 'start',
      s: 8,
      c: '#8D6E63',
    });
  // Cotas
  const dH = (xa: number, xb: number, y: number, t: string): string =>
    ln(xa, y, xb, y, C.gr, 1) +
    ln(xa, y - 4, xa, y + 4, C.gr, 1) +
    ln(xb, y - 4, xb, y + 4, C.gr, 1) +
    tx((xa + xb) / 2, y - 4, t, { s: 9, b: 1, c: C.ink });
  const dV = (x: number, ya: number, yb: number, t: string): string =>
    ln(x, ya, x, yb, C.gr, 1) +
    ln(x - 4, ya, x + 4, ya, C.gr, 1) +
    ln(x - 4, yb, x + 4, yb, C.gr, 1) +
    tx(x + 5, (ya + yb) / 2 + 3, t, { a: 'start', s: 9, b: 1, c: C.ink });
  g += dH(x0, x1, y0 - 12, `${F(lC)} m`);
  for (let i = 0; i < nC; i++) g += dV(x1 + 82, y0 + i * hb, y0 + (i + 1) * hb, `${F(bC)} m`);
  g += tx(
    x0 + w / 2,
    12,
    `Planta esquemática · dimensiones internas · ${nC === 2 ? '2 compartimentos · ' : ''}A = ${F(A)} m²`,
    { s: 8.5, c: C.gr },
  );
  return `<svg viewBox="0 0 ${W + 40} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"><title>Planta de la cisterna</title>${g}</svg>`;
}

/** Corte esquemático de la cisterna (bandas de alturas con cotas reales). */
export function svgCorteCis(
  cis: {
    hs: number;
    hrci: number;
    subS: number;
    hu: number;
    hbl: number;
    hTot: number;
    A: number;
    vgeo: number;
    zToma: number;
    zFondo: number;
    zNAV: number;
    zLosa: number;
  },
  zcis: number,
  hayRci: boolean,
): string {
  if (!cis.hTot) return '';
  const W = 390,
    H = 250,
    x0 = 86,
    x1 = 230,
    yTop = 22,
    yBot = 226;
  const bands: Array<{ n: string; h: number; bg: string; c: string; y: number }> = (
    [
      ['Sedimentos', cis.hs, '#E8DCCB', '#8D6E63'],
      ...(hayRci ? [['Reserva RCI', cis.hrci, '#F6D8D3', C.rd]] : []),
      ['Sumergencia', cis.subS, '#E4ECF3', C.gr],
      ['Útil', cis.hu, C.azl, C.suc],
      ['Borde libre', cis.hbl, '#FFFFFF', C.gr],
    ] as Array<[string, number, string, string]>
  )
    .filter((b) => b[1] > 0)
    .map(([n, h, bg, c]) => ({ n, h, bg, c, y: yBot }));
  const minH = 16,
    avail = yBot - yTop;
  const tot = bands.reduce((a, b) => a + b.h, 0);
  let px = bands.map((b) => Math.max(minH, (b.h / tot) * avail));
  const k = avail / px.reduce((a, b) => a + b, 0);
  px = px.map((p) => p * k);
  let g = '',
    y = yBot;
  bands.forEach((b, i) => {
    const h = px[i];
    y -= h;
    b.y = y;
    g +=
      `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" fill="${b.bg}"/>` +
      tx(x1 + 8, y + h / 2 + 3, `${b.n} ${F(b.h)} m`, {
        a: 'start',
        s: 8.5,
        c: b.c,
        b: b.n === 'Útil',
      });
  });
  const yOf = (n: string): number | null => {
    const b = bands.find((x) => x.n === n);
    return b ? b.y : null;
  };
  const iU = bands.findIndex((x) => x.n === 'Útil');
  const yNAM = yOf('Útil') !== null ? (yOf('Útil') as number) + px[iU] : yBot;
  const yNAV = yOf('Útil') ?? yBot;
  g += `<rect x="${x0}" y="${yTop}" width="${x1 - x0}" height="${yBot - yTop}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  g += ln(x0, yNAV, x1, yNAV, C.suc, 1.3, '5 3') + ln(x0, yNAM, x1, yNAM, C.rd, 1.5, '5 3');
  // Toma con campana en el fondo de la sumergencia
  const iS = bands.findIndex((x) => x.n === 'Sumergencia');
  const yS = yOf('Sumergencia'),
    ySb = yS != null ? yS + px[iS] : yBot;
  const xt = x1 - 34;
  g += `<path d="M${x1 + 2} ${ySb - 12} H${xt} V${ySb - 3}" fill="none" stroke="${C.suc}" stroke-width="4"/><path d="M${xt - 8} ${ySb} L${xt - 4} ${ySb - 5} H${xt + 4} L${xt + 8} ${ySb} Z" fill="${C.suc}"/>`;
  // Rebose en el NAV
  g +=
    `<path d="M${x0 + 18} ${yNAV} V${yNAV - 6} H${x0 - 2}" fill="none" stroke="${C.gr}" stroke-width="2.5"/>` +
    tx(x0 + 20, yNAV - 9, 'Rebose', { a: 'start', s: 7.5, c: C.gr });
  [
    [yTop, `Losa ${F(cis.zLosa)}`, C.ink],
    [yNAV, `NAV ${F(cis.zNAV)}`, C.suc],
    [yNAM, `NAM ${F(zcis)}`, C.rd],
    [ySb, `Toma ${F(cis.zToma)}`, C.suc],
    [yBot, `Fondo ${F(cis.zFondo)}`, C.ink],
  ].forEach(([yy, t, cc]) => {
    g +=
      ln(x0 - 6, yy as number, x0, yy as number, cc as string, 1.2) +
      tx(x0 - 8, (yy as number) + 3, t as string, { a: 'end', s: 8.5, c: cc as string, b: true });
  });
  g +=
    tx(
      x0 + (x1 - x0) / 2,
      H - 8,
      `A = ${F(cis.A, 1)} m² · H = ${F(cis.hTot)} m · ${F(cis.vgeo, 1)} m³`,
      { s: 9, c: C.ink, b: 1 },
    ) +
    tx(x0 + (x1 - x0) / 2, 13, 'Corte esquemático · cotas en m · fondo con pendiente al sumidero', {
      s: 8,
      c: C.gr,
    });
  return `<svg viewBox="0 0 ${W + 60} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"><title>Corte de la cisterna</title>${g}</svg>`;
}
