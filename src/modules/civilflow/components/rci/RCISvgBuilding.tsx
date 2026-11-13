/**
 * Corte del edificio por tipologías (ElevSvg) y textos de apoyo del perfil de presiones.
 * El corte dibuja los pisos apilados por NPT (Nivel de Piso Terminado), coloreados por
 * tipología, con la columna del montante en rojo, los gabinetes marcados y la bomba en su
 * cota; con más de ELEV_MAX pisos agrupa pisos consecutivos de la misma tipología (sin
 * escala). Ej: <ElevSvg pisos={estado.pisos.rows} groups={tips} zBomba={estado.pisos.zBomba} />.
 *
 * Geometría portada LITERAL del HTML de referencia CIVILFLOW_RCI_v1.7.79 (mismos viewBox,
 * mismos px): elevSVG/elevBands/elevCompact/elevScale (~2801-2885), gabMark/GABLAB (~2643),
 * perfilSide (~3373) y PF_NOTAS (~3392) como datos/textos.
 */
import type { NumIn, PisoOut, PisoRow, Tipologia, Tips } from '../../lib/rci/types';
import { num } from '../../lib/rci/hydraulics';
import { COL_TEMA, colorTip, fmtNum, type TemaRci } from './RCISvgSchemas';
import type { ReactNode } from 'react';

/** Cota (m) del punto más alto dibujado en el eje de la bomba. */
const SVG_CSS = { width: '100%', height: 'auto', display: 'block' } as const;

/** Con más pisos con NPT que este número, el corte pasa a modo compacto (sin escala). */
const ELEV_MAX = 12;

/** Etiqueta por tipo de salida de montante (NFPA 14): la clase GABLAB del HTML. */
const GABLAB: Record<string, string> = {
  '2½"': 'Conexión 2½"',
  '1½"': 'Gabinete 1½"',
  '2½" + 1½"': 'Gabinete 2½" + 1½"',
};

/** Marca circular blanca de gabinete sobre la columna del montante (rojo al borde). */
const gabMark = (x: number, y: number, r = 5, key?: string) => (
  <circle
    key={key}
    cx={x}
    cy={y}
    r={r}
    fill="#fff"
    style={{ stroke: COL_TEMA.fire, strokeWidth: 2.5 }}
  />
);

/** Envoltura común de los cortes: svg con aria-label y la tipografía/fill por defecto (.sv). */
function svgWrap(w: number, h: number, cuerpo: ReactNode[], label: string) {
  const c = COL_TEMA;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={SVG_CSS}>
      <g style={{ fill: c.ink, font: `12px ${c.font}` }}>{cuerpo}</g>
    </svg>
  );
}

const VACIO_CSS = {
  padding: 26,
  textAlign: 'center' as const,
  color: COL_TEMA.muted,
  border: 0,
  fontSize: 12.5,
};

/* ---------------- Bandas de tipologías ---------------- */

/** Una fila del corte ya con su NPT resuelto. */
interface FilaElev {
  p: PisoRow;
  i: number;
  z: number;
}

/** Franja vertical del corte: pisos consecutivos de la misma tipología (o el representativo solo). */
interface BandaElev {
  t: string;
  g: Tipologia | null;
  rep: boolean;
  items: FilaElev[];
  /** Salidas de manguera en la franja (para las marcas de gabinete). */
  sal: number;
  /** Texto de la marca: "Gabinete 2½" + 1½" ×3", "Salidas mixtas"… */
  salTxt: string;
}

/** Agrupa los pisos con NPT en franjas por tipología (el elevBands del HTML), resolviendo por
 *  anticipado cuántas salidas de manguera trae cada franja y su etiqueta (así el dibujo no
 *  busca nada dentro del bucle). Ej: elevBands(pisos, tips.groups, tips.tipOf). */
function elevBands(
  pisos: PisoRow[],
  grupos: Tipologia[],
  tipOf: (string | null)[],
): { rows: FilaElev[]; bands: BandaElev[] } {
  const grupoPorId = new Map(grupos.map((g) => [g.id, g]));
  const rows = pisos
    .map((p, i) => ({ p, i, z: num(p.npt) }))
    .filter((x): x is FilaElev => x.z !== null)
    .sort((a, b) => a.z - b.z);
  const bands: BandaElev[] = [];
  for (const r of rows) {
    const t = tipOf[r.i] || '';
    const g = t ? grupoPorId.get(t) || null : null;
    const rep = !!(g && g.rep === r.i);
    const last = bands[bands.length - 1];
    if (last && !rep && !last.rep && last.t === t) last.items.push(r);
    else bands.push({ t, g, rep, items: [r], sal: 0, salTxt: '' });
  }
  for (const b of bands) {
    let sal = 0;
    const tipos = new Set<string>();
    for (const r of b.items) {
      const s = r.p.salida;
      if (s && s !== 'Ninguna') {
        sal++;
        tipos.add(s);
      }
    }
    const primero = tipos.values().next().value;
    b.sal = sal;
    b.salTxt = sal
      ? (tipos.size === 1 && primero ? GABLAB[primero] || primero : 'Salidas mixtas') +
        (sal > 1 ? ` ×${sal}` : '')
      : '';
  }
  return { rows, bands };
}

/** tipOf para cuando solo hay Tipologia[] (sin Tips): el id de cada grupo en los índices de sus pisos. */
function tipOfDeGrupos(n: number, grupos: Tipologia[]): (string | null)[] {
  const tipOf: (string | null)[] = new Array(n).fill(null);
  for (const g of grupos) for (const i of g.pisos) tipOf[i] = g.id;
  return tipOf;
}

/* ---------------- Corte compacto (sin escala) ---------------- */

/** Corte compacto: franjas de alto fijo (una por tipología o piso representativo), etiquetas
 *  "primer piso – último piso" y la bomba interpolada entre losas. */
function elevCompact(
  pisos: PisoRow[],
  grupos: Tipologia[],
  tipOf: (string | null)[],
  zb: number,
  c: TemaRci,
) {
  const { rows, bands } = elevBands(pisos, grupos, tipOf);
  if (!rows.length) return <div style={VACIO_CSS}>El corte aparece al ingresar los NPT.</div>;
  const hb = (b: BandaElev) => (b.items.length > 1 ? 46 : 28);
  const W = 500,
    top = 34,
    bot = 46,
    x0 = 128,
    x1 = 300,
    xr = x1 - 14;
  const H = top + bands.reduce((a, b) => a + hb(b), 0) + bot;
  let y = H - bot;
  const marks: [number, number][] = [];
  const gabs: [number, string][] = [];
  const cuerpo: ReactNode[] = [];
  for (const b of bands) {
    const h = hb(b),
      y0 = y,
      y1 = y - h;
    const f = b.items[0],
      l = b.items[b.items.length - 1];
    const g = b.g,
      many = b.items.length > 1;
    marks.push([f.z, y0]);
    cuerpo.push(
      <rect
        key={cuerpo.length}
        x={x0}
        y={y1 + 1}
        width={x1 - x0}
        height={h - 2}
        fill={g ? colorTip(g.id) : c.calc}
        fillOpacity={g ? (b.rep ? 0.9 : 0.35) : 1}
        style={{ stroke: c.lineStrong, strokeWidth: 0.5 }}
      />,
    );
    const capas = Math.min(b.items.length, 8);
    if (many)
      for (let i = 1; i < capas; i++) {
        const yy = y0 - (h * i) / capas;
        cuerpo.push(
          <line
            key={cuerpo.length}
            x1={x0}
            y1={yy}
            x2={x1}
            y2={yy}
            style={{ stroke: c.lineStrong, strokeWidth: 0.5, strokeDasharray: '3 3' }}
          />,
        );
      }
    if (many) {
      const ym = y0 - h / 2 + 5;
      cuerpo.push(
        <path
          key={cuerpo.length}
          d={`M${x0 - 8} ${ym}l8 -6m-8 12l8 -6`}
          fill="none"
          style={{ stroke: c.muted }}
        />,
      );
      cuerpo.push(
        <path
          key={cuerpo.length}
          d={`M${x1} ${ym}l8 -6m-8 12l8 -6`}
          fill="none"
          style={{ stroke: c.muted }}
        />,
      );
    }
    cuerpo.push(
      <line
        key={cuerpo.length}
        x1={x0 - 6}
        y1={y0}
        x2={x1 + 6}
        y2={y0}
        style={{ stroke: c.ink, strokeWidth: 2 }}
      />,
    );
    const nm = many ? `${f.p.nombre} – ${l.p.nombre}` : f.p.nombre;
    cuerpo.push(
      <text
        key={cuerpo.length}
        x={x0 - 12}
        y={y0 - h / 2 + (many ? -1 : 4)}
        textAnchor="end"
        style={{ fontSize: 12 }}
      >
        {nm}
      </text>,
    );
    if (many)
      cuerpo.push(
        <text
          key={cuerpo.length}
          x={x0 - 12}
          y={y0 - h / 2 + 13}
          textAnchor="end"
          style={{ fontSize: 10.5, fill: c.muted }}
        >
          {b.items.length} pisos
        </text>,
      );
    cuerpo.push(
      <text
        key={cuerpo.length}
        x={(x0 + x1) / 2}
        y={y0 - h / 2 + 4}
        textAnchor="middle"
        style={{ fontSize: 12, fill: b.rep ? '#fff' : c.ink, fontWeight: 600 }}
      >
        {g ? `${g.id}${b.rep ? ' ★' : ''}` : 'sin rociadores'}
      </text>,
    );
    cuerpo.push(
      <text key={cuerpo.length} x={x1 + 10} y={y0 - 2} style={{ fontSize: 11 }}>
        {fmtNum(f.z)}
      </text>,
    );
    if (many)
      cuerpo.push(
        <text key={cuerpo.length} x={x1 + 10} y={y1 + 16} style={{ fontSize: 10.5, fill: c.muted }}>
          … {fmtNum(l.z)}
        </text>,
      );
    if (b.sal) gabs.push([y0 - h / 2, b.salTxt]);
    y = y1;
  }
  const yTop = y;
  // bomba: interpolar entre losas (el elevCompact del HTML, tal cual)
  let yB: number;
  if (zb <= marks[0][0]) yB = Math.min(H - 14, marks[0][1] + Math.min(24, (marks[0][0] - zb) * 6));
  else {
    const k = marks.findIndex((_m, i) => i === marks.length - 1 || marks[i + 1][0] > zb);
    const [za, ya] = marks[k];
    const [zc, yc] = marks[k + 1] || [za + 3, ya - hb(bands[k])];
    yB = ya + ((yc - ya) * (zb - za)) / (zc - za || 1);
  }
  cuerpo.push(
    <line
      key={cuerpo.length}
      x1={xr}
      y1={yB + 13}
      x2={xr}
      y2={yTop + 10}
      style={{ stroke: c.fire, strokeWidth: 3 }}
    />,
  );
  for (const [yy, t] of gabs) {
    cuerpo.push(gabMark(xr, yy, 5, `g${cuerpo.length}`));
    cuerpo.push(
      <line
        key={cuerpo.length}
        x1={xr + 6}
        y1={yy}
        x2={x1 + 58}
        y2={yy}
        style={{ stroke: c.lineStrong, strokeDasharray: '2 2' }}
      />,
    );
    cuerpo.push(
      <text key={cuerpo.length} x={x1 + 62} y={yy + 4} style={{ fontSize: 11, fill: c.ink }}>
        {t}
      </text>,
    );
  }
  const xb = x1 + 22;
  cuerpo.push(
    <path
      key={cuerpo.length}
      d={`M${xr} ${yB + 13}H${xb - 12}`}
      fill="none"
      style={{ stroke: c.fire, strokeWidth: 3 }}
    />,
  );
  cuerpo.push(
    <rect
      key={cuerpo.length}
      x={xb - 12}
      y={yB + 4}
      width={24}
      height={18}
      rx={3}
      fill={c.steel}
    />,
  );
  cuerpo.push(
    <text
      key={cuerpo.length}
      x={xb}
      y={yB + 17}
      textAnchor="middle"
      style={{ fill: c.surf, fontWeight: 600, fontSize: 11 }}
    >
      B
    </text>,
  );
  cuerpo.push(
    <text
      key={cuerpo.length}
      x={xb + 18}
      y={Math.min(H - 4, yB + 18)}
      style={{ fontSize: 11, fill: c.muted }}
    >
      eje bomba {fmtNum(zb)}
    </text>,
  );
  cuerpo.push(
    <text key={cuerpo.length} x={x1 + 10} y={18} style={{ fontSize: 11, fill: c.muted }}>
      NPT (m)
    </text>,
  );
  cuerpo.push(
    <text key={cuerpo.length} x={10} y={18} style={{ fontSize: 11, fill: c.muted }}>
      Sin escala · {rows.length} pisos
    </text>,
  );
  return svgWrap(W, H, cuerpo, 'Corte esquemático del edificio por tipologías (pisos agrupados)');
}

/* ---------------- Corte a escala de NPT ---------------- */

/** Corte a escala: losa por piso con alto proporcional a su altura, color de tipología con
 *  estrella en el representativo, marcas de gabinete y la bomba en su cota. */
function elevScale(
  pisos: PisoRow[],
  grupos: Tipologia[],
  tipOf: (string | null)[],
  zb: number,
  c: TemaRci,
) {
  const { rows } = elevBands(pisos, grupos, tipOf);
  if (!rows.length) return <div style={VACIO_CSS}>El corte aparece al ingresar los NPT.</div>;
  const grupoPorId = new Map(grupos.map((g) => [g.id, g]));
  const zs = rows.map((r) => r.z);
  const gaps = zs
    .slice(1)
    .map((z, j) => z - zs[j])
    .filter((g) => g > 0.3);
  const hTyp = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 3;
  const zTop = zs[zs.length - 1] + hTyp;
  const zMin = Math.min(zs[0], zb - 0.5);
  const W = 500;
  const slab = Math.max(14, Math.min(30, 560 / rows.length));
  const H = Math.max(260, 70 + (slab * (zTop - zMin)) / hTyp + 30);
  const sc = (H - 70) / (zTop - zMin);
  const Y = (z: number) => H - 40 - (z - zMin) * sc;
  const x0 = 120,
    x1 = 300;
  const gabs: [number, string][] = [];
  const cuerpo: ReactNode[] = [];
  rows.forEach((r, j) => {
    const zNext = j < rows.length - 1 ? rows[j + 1].z : r.z + hTyp;
    const y0 = Y(r.z),
      y1 = Y(zNext);
    const t = tipOf[r.i];
    const g = t ? grupoPorId.get(t) || null : null;
    cuerpo.push(
      <rect
        key={cuerpo.length}
        x={x0}
        y={y1 + 1}
        width={x1 - x0}
        height={Math.max(y0 - y1 - 2, 2)}
        fill={g ? colorTip(g.id) : c.calc}
        fillOpacity={g ? (g.rep === r.i ? 0.9 : 0.35) : 1}
        style={{ stroke: c.lineStrong, strokeWidth: 0.5 }}
      />,
    );
    cuerpo.push(
      <line
        key={cuerpo.length}
        x1={x0 - 6}
        y1={y0}
        x2={x1 + 6}
        y2={y0}
        style={{ stroke: c.ink, strokeWidth: 2 }}
      />,
    );
    const fs = Math.min(12, slab * 0.55);
    if (y0 - y1 >= 10) {
      cuerpo.push(
        <text key={cuerpo.length} x={x0 - 10} y={y0 - 3} textAnchor="end" style={{ fontSize: fs }}>
          {r.p.nombre}
        </text>,
      );
      cuerpo.push(
        <text
          key={cuerpo.length}
          x={x1 + 10}
          y={y0 - 2}
          style={{ fontSize: Math.min(11, fs), fill: c.muted }}
        >
          {fmtNum(r.z)}
        </text>,
      );
      cuerpo.push(
        <text
          key={cuerpo.length}
          x={(x0 + x1) / 2}
          y={(y0 + y1) / 2 + 4}
          textAnchor="middle"
          style={{ fontSize: fs, fill: g && g.rep === r.i ? '#fff' : c.ink, fontWeight: 600 }}
        >
          {g ? `${g.id}${g.rep === r.i ? ' ★' : ''}` : 'sin rociadores'}
        </text>,
      );
    }
    if (r.p.salida && r.p.salida !== 'Ninguna')
      gabs.push([(y0 + y1) / 2, GABLAB[r.p.salida] || r.p.salida]);
  });
  const xr = x1 - 14;
  const yB = Y(zb);
  const yT = gabs.length ? Math.min(...gabs.map((g) => g[0])) : Y(rows[rows.length - 1].z);
  const xb = x1 + 22;
  cuerpo.push(
    <line
      key={cuerpo.length}
      x1={xr}
      y1={yB + 13}
      x2={xr}
      y2={yT}
      style={{ stroke: c.fire, strokeWidth: 3 }}
    />,
  );
  for (const [yy, t] of gabs) {
    cuerpo.push(gabMark(xr, yy, Math.min(5, slab / 4), `g${cuerpo.length}`));
    cuerpo.push(
      <line
        key={cuerpo.length}
        x1={xr + 6}
        y1={yy}
        x2={x1 + 58}
        y2={yy}
        style={{ stroke: c.lineStrong, strokeDasharray: '2 2' }}
      />,
    );
    cuerpo.push(
      <text key={cuerpo.length} x={x1 + 62} y={yy + 4} style={{ fontSize: 11, fill: c.ink }}>
        {t}
      </text>,
    );
  }
  cuerpo.push(
    <path
      key={cuerpo.length}
      d={`M${xr} ${yB + 13}H${xb - 12}`}
      fill="none"
      style={{ stroke: c.fire, strokeWidth: 3 }}
    />,
  );
  cuerpo.push(
    <rect
      key={cuerpo.length}
      x={xb - 12}
      y={yB + 4}
      width={24}
      height={18}
      rx={3}
      fill={c.steel}
    />,
  );
  cuerpo.push(
    <text
      key={cuerpo.length}
      x={xb}
      y={yB + 17}
      textAnchor="middle"
      style={{ fill: c.surf, fontWeight: 600, fontSize: 11 }}
    >
      B
    </text>,
  );
  cuerpo.push(
    <text key={cuerpo.length} x={xb + 18} y={yB + 18} style={{ fontSize: 11, fill: c.muted }}>
      eje bomba {fmtNum(zb)}
    </text>,
  );
  cuerpo.push(
    <text key={cuerpo.length} x={x1 + 10} y={18} style={{ fontSize: 11, fill: c.muted }}>
      NPT (m)
    </text>,
  );
  return svgWrap(W, H, cuerpo, 'Corte esquemático del edificio por tipologías');
}

/* ---------------- Componente ---------------- */

/** Corte del edificio por tipologías: a escala de NPT hasta ELEV_MAX pisos con NPT; arriba de
 *  eso (o con compact) agrupa pisos consecutivos de la misma tipología. `groups` acepta el Tips
 *  del motor (usa tipOf) o directamente Tipologia[] (reconstruye tipOf). Ej:
 *  <ElevSvg pisos={estado.pisos.rows} groups={tips} zBomba={estado.pisos.zBomba} compact />. */
export function ElevSvg({
  pisos,
  groups,
  zBomba,
  compact,
}: {
  pisos: PisoRow[];
  groups: Tips | Tipologia[];
  zBomba?: NumIn;
  compact?: boolean;
}) {
  const grupos = Array.isArray(groups) ? groups : groups.groups;
  const tipOf = Array.isArray(groups) ? tipOfDeGrupos(pisos.length, grupos) : groups.tipOf;
  const n = pisos.filter((p) => num(p.npt) !== null).length;
  const zb = num(zBomba) ?? 0;
  const usarCompact = compact ?? n > ELEV_MAX;
  const c = COL_TEMA;
  return usarCompact
    ? elevCompact(pisos, grupos, tipOf, zb, c)
    : elevScale(pisos, grupos, tipOf, zb, c);
}

/* ---------------- Textos del perfil (datos, sin dibujo) ---------------- */

/** Una nota técnica del perfil de presiones: título en negrita + cuerpo. */
export interface NotaRci {
  t: string;
  d: string;
}

/** Notas técnicas del perfil de presiones (el PF_NOTAS del HTML, como datos): estática vs
 *  componentes, VRP (Válvula Reductora de Presión), válvulas reguladoras 1½", zonas, jockey y
 *  cheques. Ej: pfNotas(edif.Pc).map(n => <li><b>{n.t}:</b> {n.d}</li>). */
export const PF_NOTAS = (Pc = 175): NotaRci[] => [
  {
    t: 'Estática y materiales',
    d: `la presión estática máxima debe compararse con la presión de trabajo de cada componente (tubería, uniones, válvulas, rociadores, mangueras). Los componentes estándar son de ${Pc} psi; por encima se requieren componentes listados de mayor presión (p. ej. clase 300).`,
  },
  {
    t: 'La VRP protege el piso, no el montante',
    d: 'se instala en la derivación, después de la VCP (Válvula de Control de Piso). El montante sigue con la presión completa a esa altura.',
  },
  {
    t: 'Válvula reguladora en salidas de 1½"',
    d: 'válvula de manguera listada con regulador incorporado, cuando la residual pasa de 100 psi. Un dispositivo restrictor solo limita con flujo; el regulador controla también la estática y es obligatorio si esta pasa de 175 psi. Es distinta de la VRP del piso.',
  },
  {
    t: 'Con VRP',
    d: 'manómetros antes y después, válvula de alivio aguas abajo y prueba periódica de la válvula.',
  },
  {
    t: 'Sobre 350 psi en el punto más bajo',
    d: 'se debe dividir el edificio en zonas de presión.',
  },
  {
    t: 'Jockey',
    d: 'se ajusta para parar cerca de la presión de cierre de la bomba principal más la succión mínima, y arrancar unos 10 psi abajo; la principal arranca 5 psi por debajo de la jockey. Así la red pasa casi todo el tiempo cerca de la estática máxima, y por eso esa presión es la que deben soportar los componentes.',
  },
  {
    t: 'Cheques de retención',
    d: 'NFPA 13 y 14 no los exigen a lo largo del montante ni en el conjunto de control del piso. Sí van en la descarga de la bomba, en la línea de la siamesa, en cada conexión de abastecimiento y entre zonas de presión. Un cheque intermedio en el montante suma pérdidas y puede impedir que el agua de la siamesa llegue a los pisos de abajo.',
  },
];

/** "Para qué sirve" del panel lateral del perfil (los 3 puntos del HTML, como datos). */
export const PERFIL_SIDE_INFO = (Pc = 175): NotaRci[] => [
  {
    t: '¿Alcanza arriba?',
    d: 'En cada piso la disponible debe superar la requerida: holgura ≥ 0.',
  },
  {
    t: '¿Se pasa abajo?',
    d: `La estática no debe exceder ${Pc} psi (componentes) ni la residual de las salidas de 1½" 100 psi.`,
  },
  {
    t: 'En reposo',
    d: '(franja gris) la jockey mantiene la red entre su arranque y su parada, fijados en la bomba; a cada piso llega ese valor menos 1,42 psi por metro de altura.',
  },
];

/** Una fila del panel lateral del perfil: estado (chip) + piso + texto del aviso. */
export interface FilaPerfilSide {
  st: string;
  piso: string;
  txt: string;
}

/** Diagnóstico piso a piso del perfil (el perfilSide del HTML, como datos): qué hacer en cada
 *  piso sin holgura, con VRP o válvula reguladora pendiente, más el aviso del montante cuando
 *  la estática supera Pc. Ej: perfilSideFilas(edif.pf, edif.Pc, edif.hmin). */
export function perfilSideFilas(pf: PisoOut[], Pc = 175, hmin = 0): FilaPerfilSide[] {
  const filas: FilaPerfilSide[] = [];
  for (const o of pf) {
    const a: string[] = [];
    let st = 'OK';
    if (!o.res) {
      a.push(o.f.sinRoc ? 'sin rociadores' : `tipología ${o.tId || ''} sin red`);
      st = 'PENDIENTE';
    } else if (!o.okH) {
      a.push(`faltan ${fmtNum(-(o.holg ?? 0) + hmin, 1)} psi: suba la bomba o reduzca pérdidas`);
      st = 'NO';
    }
    if (o.vrp) {
      a.push(
        `VRP en la derivación (estática ${fmtNum(o.Pst, 1)} > ${Pc})${o.vrpSet ? `, ajuste ≈ ${o.vrpSet} psi` : ''}`,
      );
      if (st === 'OK') st = 'REVISAR';
    }
    if (o.vrpFalta) {
      a.push('requiere VRP y está marcada «No» en Tipologías');
      st = 'NO';
    }
    if (o.reg || o.regFalta) {
      a.push(
        `${o.regFalta ? 'requiere válvula reguladora y está marcada «No» en Tipologías' : 'válvula reguladora en la salida'} (${
          o.regEst
            ? `estática ${fmtNum(o.PstS, 0)} psi > 175`
            : o.regRes
              ? `residual 1½" ${fmtNum(o.res15, 0)} psi > 100`
              : 'elegida por el diseñador'
        })`,
      );
      if (o.regFalta) st = 'NO';
      else if (st === 'OK') st = 'REVISAR';
    }
    if (a.length) filas.push({ st, piso: o.f.nombre, txt: `${a.join('; ')}.` });
  }
  const sobre = pf.some((o) => (o.Pst ?? 0) > Pc);
  if (sobre)
    filas.push({
      st: 'REVISAR',
      piso: 'Montante',
      txt: `tramo con estática > ${Pc} psi (en rojo en el esquema): componentes listados de mayor presión.`,
    });
  return filas;
}
