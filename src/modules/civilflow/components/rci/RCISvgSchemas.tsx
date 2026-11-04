/**
 * Esquemas estáticos del módulo RCI (Red Contra Incendio) + paleta compartida de los SVG.
 * Aquí viven: los colores del tema (fijos para memoria impresa / variables CSS del repo),
 * el formateador numérico es-CO, el esquema de soportes sísmicos (NFPA 13 cap. 18), el
 * esquema típico del cuarto de bombas (NFPA 20) y las dos curvas de canvas (rectángulo de
 * fuego y curva de la bomba). Ej: <SismoSvg losaRestr /> dibuja la guía de riostras con
 * "la losa hace de apoyo" en lugar de la riostra intermedia.
 *
 * Geometría portada LITERAL del HTML de referencia CIVILFLOW_RCI_v1.7.79 (mismos viewBox,
 * mismos px): sismoSVG, pumpSVG, drawRect, drawPump, niceStep, fmt.
 */
import type { BombaResult, Criterios } from '../../lib/rci/types';
import type { CSSProperties, ReactNode } from 'react';

/** svg a ancho completo del contenedor, sin salto de línea (equivale a .sv / .pumpsvg del HTML). */
const SVG_CSS: CSSProperties = { width: '100%', height: 'auto', display: 'block' };

/** Nota al pie de los esquemas tipo "referencia" (la clase .note del HTML). */
const NOTA_CSS: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 11.5,
  lineHeight: 1.45,
  color: 'var(--txt2)',
};

/* ---------------- Paleta ---------------- */

/** Paleta de un esquema RCI: cada clave es un color listo para SVG/canvas (fill/stroke).
 *  Con el tema del repo los valores son var(--x) (solo SVG); para canvas use hex resueltos. */
export interface TemaRci {
  fire: string;
  fireS: string;
  steel: string;
  warn: string;
  warnS: string;
  ok: string;
  okS: string;
  muted: string;
  ink: string;
  line: string;
  lineStrong: string;
  surf: string;
  calc: string;
  /** Fondo de la zona "Análisis del montante" (rgba verde muy suave, como .zm del HTML). */
  zmF: string;
  /** Fondo de la zona "Red del piso" (rgba rojo muy suave, como .zr del HTML). */
  zrF: string;
  /** Familia tipográfica para los <text> del SVG o el font corto de canvas. */
  font: string;
}

/** Paleta FIJA del HTML (memoria impresa / rep=true / canvas): hex directos, sin variables. */
export const COL_RCI: TemaRci = {
  fire: '#B3131B',
  fireS: '#F8E3E4',
  steel: '#2F5D7C',
  warn: '#9A600C',
  warnS: '#FBEFD6',
  ok: '#1E7A4C',
  okS: '#E1F2E8',
  muted: '#5A6875',
  ink: '#17222B',
  line: '#D3DAE0',
  lineStrong: '#AEB8C1',
  surf: '#FFFFFF',
  calc: '#F4F6F8',
  zmF: 'rgba(30,122,76,.08)',
  zrF: 'rgba(179,19,27,.05)',
  font: 'sans-serif',
};

/** Variante con las variables CSS del repo (pantalla): misma estructura que COL_RCI.
 *  Solo sirve en SVG/JSX (los var(--x) no se resuelven dentro de un canvas). */
export const COL_TEMA: TemaRci = {
  fire: 'var(--rci, #f87171)',
  fireS: 'rgba(240,69,69,.12)',
  steel: 'var(--af, #2F5D7C)',
  warn: 'var(--warn, #f5a623)',
  warnS: 'rgba(245,166,35,.12)',
  ok: 'var(--succ, #5DBB83)',
  okS: 'rgba(93,187,131,.14)',
  muted: 'var(--txt2)',
  ink: 'var(--txt)',
  line: 'var(--line)',
  lineStrong: 'var(--txt3, #8a9496)',
  surf: 'var(--bg2)',
  calc: 'var(--bg3)',
  zmF: 'rgba(30,122,76,.10)',
  zrF: 'rgba(179,19,27,.08)',
  font: 'var(--body, sans-serif)',
};

/** Elige paleta: rep (memoria impresa) usa los hex fijos del HTML; pantalla usa el tema. */
export const temaRci = (rep = false): TemaRci => (rep ? COL_RCI : COL_TEMA);

/** Paleta con colores RESUELTOS (hex) leídos de las variables CSS del documento: la que hay
 *  que pasarle a dibujaRectangulo/dibujaCurvaBomba cuando el esquema va sobre canvas.
 *  Ej: const cv = document.querySelector('canvas'); dibujaRectangulo(cv.getContext('2d')!, cv.clientWidth, 360, roc, temaResuelto()). */
export function temaResuelto(): TemaRci {
  const fijo = COL_RCI;
  if (typeof window === 'undefined' || typeof document === 'undefined') return fijo;
  const cs = getComputedStyle(document.documentElement);
  const v = (nombre: string, defecto: string): string =>
    (cs.getPropertyValue(nombre) || '').trim() || defecto;
  return {
    ...fijo,
    fire: v('--rci', fijo.fire),
    steel: v('--af', fijo.steel),
    warn: v('--warn', fijo.warn),
    ok: v('--succ', '#5DBB83'),
    muted: v('--txt2', fijo.muted),
    ink: v('--txt', fijo.ink),
    line: v('--line', fijo.line),
    lineStrong: v('--txt3', fijo.lineStrong),
    surf: v('--bg2', fijo.surf),
    calc: v('--bg3', fijo.calc),
    font: 'sans-serif',
  };
}

/* ---------------- Colores de tipología (TCOL del HTML: sin rojos) ---------------- */

/** Colores por tipología del HTML (T1..Tn): sin rojos, que quedan para montante y gabinetes. */
export const TCOL = [
  '#2F5D7C',
  '#1E7A4C',
  '#B07A12',
  '#6B4FA0',
  '#0F7C86',
  '#4E5A65',
  '#8A5A2B',
  '#3B7A2A',
  '#5B6FB5',
  '#7A8B2E',
];

/** Color de una tipología por su id ("T3" → tercera de la lista, cíclico). Ej: colorTip('T11') === TCOL[0]. */
export const colorTip = (id: string): string => TCOL[(+id.slice(1) - 1) % TCOL.length] || TCOL[0];

/* ---------------- Números ---------------- */

/** Coma decimal es-CO, "—" si no es finito — canónico en lib/rci/fmtEs (el fmt del HTML).
 *  Ej: fmtNum(12.5) === "12,50"; fmtNum(NaN) === "—". */
export { fmtEs as fmtNum } from '../../lib/rci/fmtEs.ts';
import { fmtEs as fmtNum } from '../../lib/rci/fmtEs.ts';

/** fmtNum a 2 decimales (el n2 del HTML, usado dentro de las cotas de los esquemas). */
export const n2 = (x: number | null | undefined): string => fmtNum(x, 2);

/** Paso "bonito" para ejes de gráfico (1/2/5×10^n): reparte ~5-6 divisiones.
 *  Ej: niceStep(28) === 20 (m = 2,8 → 2×10); niceStep(0.04) === 0.05. */
export function niceStep(x: number): number {
  if (!(x > 0) || !isFinite(x)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

/* ---------------- Sismo: guía de ubicación de soportes (NFPA 13 cap. 18) ---------------- */

/** Riostra lateral (L) del esquema en planta: barra roja con flecha hacia abajo y etiqueta. */
const RiostraLat = (x: number, y0: number, c: TemaRci) => (
  <g key={`lat${x}`}>
    <line x1={x} y1={y0 + 4} x2={x} y2={y0 + 34} style={{ stroke: c.fire, strokeWidth: 2.5 }} />
    <path
      d={`M${x - 6} ${y0 + 26}l6 8l6 -8`}
      fill="none"
      style={{ stroke: c.fire, strokeWidth: 2 }}
    />
    <text
      x={x}
      y={y0 + 50}
      textAnchor="middle"
      style={{ fontSize: 11, fill: c.fire, fontWeight: 600 }}
    >
      L
    </text>
  </g>
);

/** Riostra longitudinal (Lg) del esquema en planta: barra ámbar sobre el troncal con flecha. */
const RiostraLon = (x: number, y0: number, c: TemaRci) => (
  <g key={`lon${x}`}>
    <line
      x1={x - 18}
      y1={y0 - 10}
      x2={x + 18}
      y2={y0 - 10}
      style={{ stroke: c.warn, strokeWidth: 2.5 }}
    />
    <path
      d={`M${x + 10} ${y0 - 16}l8 6l-8 6`}
      fill="none"
      style={{ stroke: c.warn, strokeWidth: 2 }}
    />
    <text
      x={x}
      y={y0 - 18}
      textAnchor="middle"
      style={{ fontSize: 11, fill: c.warn, fontWeight: 600 }}
    >
      Lg
    </text>
  </g>
);

/** Guía de dónde van los soportes sísmicos (NFPA 13 cap. 18): planta con riostras L/Lg y
 *  elevación del montante con la de cuatro vías y los acoples flexibles.
 *  Ej: <SismoSvg losaRestr /> — con losas que restringen, el montante NO lleva riostra intermedia. */
export function SismoSvg({ losaRestr }: { losaRestr: boolean }) {
  const c = COL_TEMA;
  const inter = !losaRestr;
  const y0 = 120;
  const mx = 600;
  const yt = 40;
  const yb = 220;
  return (
    <svg
      viewBox="0 0 760 256"
      role="img"
      aria-label="Ubicación de riostras laterales, longitudinales, de cuatro vías y acoples flexibles"
      style={SVG_CSS}
    >
      <g style={{ fill: c.ink, font: `12px ${c.font}` }}>
        <rect x={0} y={0} width={760} height={250} fill="none" />
        {/* planta: troncal con ramales, riostras laterales (L) y longitudinales (Lg) */}
        <text x={16} y={22} style={{ fontWeight: 600, fill: c.ink }}>
          Planta: tramo troncal con sus ramales
        </text>
        <line x1={30} y1={y0} x2={430} y2={y0} style={{ stroke: c.steel, strokeWidth: 5 }} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 60 + i * 70;
          return (
            <g key={i}>
              <line x1={x} y1={y0 - 70} x2={x} y2={y0} style={{ stroke: c.line, strokeWidth: 2 }} />
              <circle cx={x} cy={y0 - 70} r={4} fill="none" style={{ stroke: c.muted }} />
            </g>
          );
        })}
        {RiostraLat(48, y0, c)}
        {RiostraLat(240, y0, c)}
        {RiostraLat(412, y0, c)}
        {RiostraLon(150, y0, c)}
        {RiostraLon(350, y0, c)}
        <text x={48} y={y0 + 72} style={{ fontSize: 11, fill: c.muted }}>
          L: lateral cada ≤ 12,2 m (40 ft); la última a ≤ 1,8 m (6 ft) del extremo
        </text>
        <text x={48} y={y0 + 88} style={{ fontSize: 11, fill: c.muted }}>
          Lg: longitudinal cada ≤ 24,4 m (80 ft); la última a ≤ 12,2 m del extremo
        </text>
        <text x={48} y={y0 + 104} style={{ fontSize: 11, fill: c.muted }}>
          Separaciones menores según la tabla de NFPA 13 para el Cp y el diámetro
        </text>
        {/* elevación: montante con riostra de cuatro vías y acoples flexibles */}
        <text x={480} y={22} style={{ fontWeight: 600, fill: c.ink }}>
          Elevación: montante
        </text>
        <line x1={mx} y1={yt} x2={mx} y2={yb} style={{ stroke: c.steel, strokeWidth: 5 }} />
        {[90, 150].map((y) => (
          <g key={y}>
            <line
              x1={mx - 60}
              y1={y}
              x2={mx + 60}
              y2={y}
              style={{ stroke: c.line, strokeWidth: 3 }}
            />
            <rect x={mx - 7} y={y - 22} width={14} height={6} fill={c.warn} />
            <rect x={mx - 7} y={y + 10} width={14} height={6} fill={c.warn} />
          </g>
        ))}
        <rect x={mx - 7} y={yt + 8} width={14} height={6} fill={c.warn} />
        <rect x={mx - 7} y={yb - 16} width={14} height={6} fill={c.warn} />
        <g>
          <line
            x1={mx - 26}
            y1={yt + 2}
            x2={mx + 26}
            y2={yt + 2}
            style={{ stroke: c.fire, strokeWidth: 2.5 }}
          />
          <line
            x1={mx}
            y1={yt - 12}
            x2={mx}
            y2={yt + 16}
            style={{ stroke: c.fire, strokeWidth: 2.5 }}
          />
        </g>
        <text x={mx + 32} y={yt + 2} style={{ fontSize: 11, fill: c.fire, fontWeight: 600 }}>
          Riostra de cuatro vías
        </text>
        {inter ? (
          <g>
            <line
              x1={mx - 26}
              y1={120}
              x2={mx + 26}
              y2={120}
              style={{ stroke: c.fire, strokeWidth: 2.5 }}
            />
            <line x1={mx} y1={106} x2={mx} y2={134} style={{ stroke: c.fire, strokeWidth: 2.5 }} />
          </g>
        ) : null}
        {inter ? (
          <text x={mx + 32} y={124} style={{ fontSize: 11, fill: c.fire, fontWeight: 600 }}>
            Intermedia (≤ 7,6 m)
          </text>
        ) : (
          <text x={mx + 66} y={122} style={{ fontSize: 10.5, fill: c.muted }}>
            la losa hace de apoyo
          </text>
        )}
        <text x={mx + 14} y={yt + 30} style={{ fontSize: 11, fill: c.warn, fontWeight: 600 }}>
          Acople flexible
        </text>
        <text x={mx + 66} y={94} style={{ fontSize: 11, fill: c.muted }}>
          losa
        </text>
        <text x={mx + 66} y={154} style={{ fontSize: 11, fill: c.muted }}>
          losa
        </text>
        <text x={470} y={236} style={{ fontSize: 11, fill: c.muted }}>
          Acoples: ≤ 0,6 m arriba y abajo del montante;
        </text>
        <text x={470} y={249} style={{ fontSize: 11, fill: c.muted }}>
          en cada losa, ≤ 0,3 m encima y ≤ 0,6 m debajo
        </text>
      </g>
    </svg>
  );
}

/* ---------------- Esquema típico del cuarto de bombas (NFPA 20) ---------------- */

/** Etiqueta centrada del cuarto de bombas (la clase .ps-t del HTML). */
const Pt = ({ x, y, children }: { x: number; y: number; children: ReactNode }) => (
  <text x={x} y={y} style={{ fontSize: 11, fill: 'var(--txt2)' }} textAnchor="middle">
    {children}
  </text>
);

/** Válvula de compuerta (OS&Y): cuerpo de mariposa + vástago con volante, con su etiqueta. */
const Pgv = ({ cx, t, dy = 32, y }: { cx: number; t: string; dy?: number; y: number }) => (
  <g>
    <path
      d={`M${cx - 11} ${y - 8}L${cx + 11} ${y + 8}V${y - 8}L${cx - 11} ${y + 8}Z`}
      fill="var(--bg2)"
      style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }}
    />
    <line x1={cx} y1={y} x2={cx} y2={y - 18} style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }} />
    <line
      x1={cx - 7}
      y1={y - 18}
      x2={cx + 7}
      y2={y - 18}
      style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }}
    />
    <Pt x={cx} y={y + dy}>
      {t}
    </Pt>
  </g>
);

/** Válvula de retención (cheque): cuerpo de mariposa con el disco relleno a la izquierda. */
const Pck = ({ cx, t, dy = 32, y }: { cx: number; t: string; dy?: number; y: number }) => (
  <g>
    <path
      d={`M${cx - 11} ${y - 8}L${cx + 11} ${y + 8}V${y - 8}L${cx - 11} ${y + 8}Z`}
      fill="var(--bg2)"
      style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }}
    />
    <path d={`M${cx - 11} ${y - 8}L${cx} ${y}L${cx - 11} ${y + 8}Z`} fill="var(--txt)" />
    <Pt x={cx} y={y + dy}>
      {t}
    </Pt>
  </g>
);

/** Reducción (concéntrica o excéntrica "plana arriba") entre dos x del eje. */
const Prd = ({
  x1,
  x2,
  ecc,
  t,
  dy = 32,
  y,
}: {
  x1: number;
  x2: number;
  ecc: boolean;
  t: string;
  dy?: number;
  y: number;
}) => (
  <g>
    <path
      d={
        ecc
          ? `M${x1} ${y - 11}L${x2} ${y - 11}L${x2} ${y + 6}L${x1} ${y + 11}Z`
          : `M${x1} ${y - 11}L${x2} ${y - 6}L${x2} ${y + 6}L${x1} ${y + 11}Z`
      }
      fill="var(--bg2)"
      style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }}
    />
    <Pt x={(x1 + x2) / 2} y={y + dy}>
      {t}
    </Pt>
  </g>
);

/** Manómetro/manovacuómetro: tomador vertical + esfera con la "P". */
const Pga = ({ cx, t, y }: { cx: number; t: string; y: number }) => (
  <g>
    <line x1={cx} y1={y} x2={cx} y2={y - 22} style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }} />
    <circle
      cx={cx}
      cy={y - 31}
      r={9}
      fill="var(--bg2)"
      style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }}
    />
    <text
      x={cx}
      y={y - 28}
      textAnchor="middle"
      style={{ fontSize: 9, fontWeight: 700, fill: 'var(--txt)' }}
    >
      P
    </text>
    <Pt x={cx} y={y - 46}>
      {t}
    </Pt>
  </g>
);

/** Flecha de sentido de flujo sobre la tubería. */
const Par = ({ cx, y }: { cx: number; y: number }) => (
  <path
    d={`M${cx - 5} ${y - 5}L${cx + 5} ${y}L${cx - 5} ${y + 5}`}
    fill="none"
    style={{ stroke: 'var(--af, #2F5D7C)', strokeWidth: 2 }}
  />
);

/** Esquema típico del cuarto de bombas con succión positiva: tanque (fondo ≥ eje de la bomba,
 *  NFPA 20), succión, bomba horizontal y descarga hasta la base del montante.
 *  modo resalta la sección: 'suc' pinta la zona de succión, 'desc' la de descarga (los datos
 *  de esa tabla van al lado). Ej: <PumpSvg modo="desc" /> sobre la tabla del cuarto. */
export function PumpSvg({ modo }: { modo?: 'suc' | 'desc' }) {
  const y = 175;
  const hs = modo === 'suc';
  const hd = modo === 'desc';
  return (
    <>
      <svg
        viewBox="0 0 1000 262"
        role="img"
        aria-label="Esquema típico del cuarto de bombas con succión positiva: tanque con fondo sobre el eje de la bomba, succión, bomba y descarga hasta la base del montante"
        style={SVG_CSS}
      >
        <g style={{ fill: 'var(--txt)', font: `11px var(--body, sans-serif)` }}>
          <rect
            x={200}
            y={30}
            width={792}
            height={226}
            rx={10}
            fill="none"
            style={{ stroke: 'var(--txt)', strokeWidth: 1.5, strokeDasharray: '8 5' }}
          />
          <text
            x={214}
            y={48}
            textAnchor="start"
            style={{ fontSize: 13, fontWeight: 700, fill: 'var(--txt)' }}
          >
            Cuarto de bombas
          </text>
          {hs ? (
            <g>
              <rect
                x={214}
                y={92}
                width={290}
                height={140}
                rx={8}
                fill="var(--af, #2F5D7C)"
                fillOpacity={0.1}
                style={{ stroke: 'var(--af, #2F5D7C)', strokeDasharray: '4 3' }}
              />
              <text
                x={359}
                y={108}
                textAnchor="middle"
                style={{ fontSize: 12, fontWeight: 600, fill: 'var(--txt)' }}
              >
                Succión: datos de esta sección
              </text>
            </g>
          ) : null}
          {hd ? (
            <g>
              <rect
                x={558}
                y={92}
                width={330}
                height={140}
                rx={8}
                fill="var(--rci, #f87171)"
                fillOpacity={0.08}
                style={{ stroke: 'var(--rci, #f87171)', strokeDasharray: '4 3' }}
              />
              <text
                x={723}
                y={108}
                textAnchor="middle"
                style={{ fontSize: 12, fontWeight: 600, fill: 'var(--txt)' }}
              >
                Descarga: tabla de abajo
              </text>
            </g>
          ) : null}
          <rect
            x={20}
            y={20}
            width={150}
            height={110}
            rx={4}
            fill="var(--bg2)"
            style={{ stroke: 'var(--txt)', strokeWidth: 1.5 }}
          />
          <rect
            x={22}
            y={52}
            width={146}
            height={76}
            fill="var(--af, #2F5D7C)"
            fillOpacity={0.18}
          />
          <Pt x={95} y={40}>
            Tanque
          </Pt>
          <line
            x1={132}
            y1={122}
            x2={168}
            y2={122}
            style={{ stroke: 'var(--txt)', strokeWidth: 3 }}
          />
          <Pt x={88} y={118}>
            Placa antivórtice
          </Pt>
          <path
            d={`M150 130V${y}H530`}
            fill="none"
            style={{ stroke: 'var(--af, #2F5D7C)', strokeWidth: 4 }}
          />
          <Par cx={185} y={y} />
          <line
            x1={176}
            y1={130}
            x2={196}
            y2={130}
            style={{ stroke: 'var(--txt2)', strokeWidth: 1 }}
          />
          <line x1={176} y1={y} x2={196} y2={y} style={{ stroke: 'var(--txt2)', strokeWidth: 1 }} />
          <line
            x1={186}
            y1={133}
            x2={186}
            y2={y - 3}
            style={{ stroke: 'var(--txt2)', strokeWidth: 1 }}
          />
          <Pt x={95} y={150}>
            Fondo del tanque
          </Pt>
          <Pt x={95} y={163}>
            ≥ eje de la bomba
          </Pt>
          <Pt x={95} y={176}>
            (NFPA 20)
          </Pt>
          <Pgv cx={262} t="V. compuerta OS&Y" y={y} />
          <Prd x1={350} x2={392} ecc t="Red. excéntrica (plana arriba)" dy={46} y={y} />
          <Pga cx={440} t="Manovacuómetro" y={y} />
          <circle
            cx={530}
            cy={y}
            r={26}
            fill="var(--bg2)"
            style={{ stroke: 'var(--txt)', strokeWidth: 2 }}
          />
          <path d={`M520 ${y - 13}L545 ${y}L520 ${y + 13}Z`} fill="var(--txt)" />
          <text
            x={530}
            y={y + 46}
            textAnchor="middle"
            style={{ fontSize: 11, fontWeight: 700, fill: 'var(--txt2)' }}
          >
            Bomba horizontal
          </text>
          <line
            x1={556}
            y1={y}
            x2={910}
            y2={y}
            style={{ stroke: 'var(--af, #2F5D7C)', strokeWidth: 4 }}
          />
          <line
            x1={910}
            y1={y}
            x2={910}
            y2={12}
            style={{ stroke: 'var(--af, #2F5D7C)', strokeWidth: 4 }}
          />
          <line
            x1={566}
            y1={y - 16}
            x2={566}
            y2={y + 16}
            style={{ stroke: 'var(--txt)', strokeWidth: 3 }}
          />
          <text
            x={566}
            y={y - 22}
            textAnchor="middle"
            style={{ fontSize: 12, fontWeight: 700, fill: 'var(--txt)' }}
          >
            CB
          </text>
          <Prd x1={584} x2={618} ecc={false} t="Red. concéntrica" y={y} />
          <Pga cx={660} t="Manómetro" y={y} />
          <Pck cx={712} t="V. retención" dy={46} y={y} />
          <Pgv cx={778} t="V. compuerta OS&Y" y={y} />
          <line
            x1={846}
            y1={y}
            x2={846}
            y2={y + 42}
            style={{ stroke: 'var(--af, #2F5D7C)', strokeWidth: 4 }}
          />
          <circle cx={846} cy={y} r={3} fill="var(--txt)" />
          <Pt x={846} y={y + 56}>
            A v. de alivio y cabezal de pruebas
          </Pt>
          <Par cx={880} y={y} />
          <circle cx={910} cy={y} r={5} fill="var(--txt)" />
          <text
            x={920}
            y={y + 20}
            textAnchor="start"
            style={{ fontSize: 12, fontWeight: 700, fill: 'var(--txt)' }}
          >
            Base del
          </text>
          <text
            x={920}
            y={y + 34}
            textAnchor="start"
            style={{ fontSize: 12, fontWeight: 700, fill: 'var(--txt)' }}
          >
            montante
          </text>
          <path
            d="M904 22L910 12L916 22"
            fill="none"
            style={{ stroke: 'var(--af, #2F5D7C)', strokeWidth: 2 }}
          />
          <text x={920} y={22} textAnchor="start" style={{ fontSize: 11, fill: 'var(--txt2)' }}>
            Al montante
          </text>
        </g>
      </svg>
      <p style={NOTA_CSS}>
        Esquema típico de referencia: bomba horizontal con succión positiva (el fondo del tanque al
        nivel del eje o por encima, sin válvula de pie). El arreglo real lo define el diseñador
        según NFPA 20 y puede incluir by-pass, bomba jockey o medidor de caudal.
      </p>
    </>
  );
}

/* ---------------- Canvas: rectángulo de fuego y curva de la bomba ---------------- */

/** Rectángulo de fuego (NFPA 13) sobre canvas: ramales en gris, envolvente S×L, el rectángulo
 *  teórico 1,2√A en rojo discontinuo y los rociadores en operación rellenos.
 *  w/h son el tamaño CSS del canvas (la función asume que el contexto ya está escalado por DPR;
 *  NO usa var(--x): pase colores resueltos, p. ej. temaResuelto()).
 *  Ej: dibujaRectangulo(ctx, cv.clientWidth, 360, R.roc, temaResuelto()). */
export function dibujaRectangulo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  roc: Criterios,
  tema: TemaRci = COL_RCI,
): void {
  const g = ctx;
  const o = roc;
  g.clearRect(0, 0, w, h);
  g.font = `12px ${tema.font}`;
  if (!(o.S > 0 && o.L > 0 && o.Nramal > 0)) {
    g.fillStyle = tema.muted;
    g.fillText('Ingrese S y L en Entradas', 20, 30);
    return;
  }
  const nx = o.Nramal,
    ny = o.Nramales,
    W = nx * o.S,
    H = ny * o.L;
  const x0r = W / 2 - o.Llargo / 2,
    y0r = H / 2 - o.Acorto / 2;
  const minX = Math.min(-o.S, x0r) - 0.3,
    maxX = Math.max(W + o.S, x0r + o.Llargo) + 0.3;
  const minY = Math.min(-o.L, y0r) - 0.3,
    maxY = Math.max(H + o.L * 0.6, y0r + o.Acorto) + 0.3;
  const pad = { l: 46, r: 16, t: 34, b: 30 };
  const sc = Math.min((w - pad.l - pad.r) / (maxX - minX), (h - pad.t - pad.b) / (maxY - minY));
  const ox = pad.l + (w - pad.l - pad.r - sc * (maxX - minX)) / 2,
    oy = h - pad.b - (h - pad.t - pad.b - sc * (maxY - minY)) / 2;
  const X = (x: number) => ox + (x - minX) * sc,
    Y = (y: number) => oy - (y - minY) * sc;
  // ramales
  g.strokeStyle = tema.lineStrong;
  g.lineWidth = 1;
  for (let j = -1; j <= ny; j++) {
    const y = (j + 0.5) * o.L;
    if (y < minY || y > maxY) continue;
    g.beginPath();
    g.moveTo(X(minX + 0.2), Y(y));
    g.lineTo(X(maxX - 0.2), Y(y));
    g.stroke();
  }
  // envolvente
  g.strokeStyle = tema.muted;
  g.lineWidth = 1.2;
  g.setLineDash([]);
  g.strokeRect(X(0), Y(H), W * sc, H * sc);
  // rectángulo teórico
  g.strokeStyle = tema.fire;
  g.lineWidth = 2.2;
  g.setLineDash([8, 5]);
  g.strokeRect(X(x0r), Y(y0r + o.Acorto), o.Llargo * sc, o.Acorto * sc);
  g.setLineDash([]);
  // rociadores
  let k = 0;
  for (let j = -1; j <= ny; j++)
    for (let i = -1; i <= nx; i++) {
      const x = (i + 0.5) * o.S,
        y = (j + 0.5) * o.L;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const on = i >= 0 && i < nx && j >= 0 && j < ny && j * nx + i < o.Nreq;
      g.beginPath();
      g.arc(X(x), Y(y), on ? 5.5 : 4, 0, Math.PI * 2);
      if (on) {
        g.fillStyle = tema.fire;
        g.fill();
        k++;
      } else {
        g.strokeStyle = tema.lineStrong;
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
  // cotas
  g.fillStyle = tema.ink;
  g.textAlign = 'center';
  g.fillText(
    `Lado largo ${fmtNum(o.Llargo)} m (1,2√A)`,
    X(x0r + o.Llargo / 2),
    Y(y0r + o.Acorto) - 8,
  );
  g.save();
  g.translate(X(x0r) - 10, Y(y0r + o.Acorto / 2));
  g.rotate(-Math.PI / 2);
  g.fillText(`${fmtNum(o.Acorto)} m`, 0, 0);
  g.restore();
  g.fillStyle = tema.muted;
  g.textAlign = 'left';
  g.fillText(
    `Ramales →   S = ${fmtNum(o.S)} m   L = ${fmtNum(o.L)} m   ${k} rociadores en operación   Área ${fmtNum(o.Adis * 0.092903)} m²`,
    10,
    16,
  );
}

/** Curva de la bomba (NFPA 20) sobre canvas: rejilla con pasos "bonitos", líneas de 100 % y
 *  150 % del caudal, la curva P = a·Q² + b·Q + churn y los puntos de demanda D1/D2.
 *  Escalas siempre positivas: con demanda nula el gráfico queda vacío (aviso centrado).
 *  Ej: dibujaCurvaBomba(ctx, cv.clientWidth, 360, R.bomba, temaResuelto()). */
export function dibujaCurvaBomba(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bomba: Pick<BombaResult, 'Qnom' | 'Pnom' | 'Pchurn' | 'ca' | 'cb' | 'D1' | 'D2'>,
  tema: TemaRci = COL_RCI,
): void {
  const g = ctx;
  const b = bomba;
  const pad = { l: 50, r: 16, t: 14, b: 38 };
  const qMax = Math.max(1.6 * b.Qnom, b.D1.Q * 1.1, b.D2 ? b.D2.Q * 1.1 : 0, 10) || 10;
  const pMax = Math.max(b.Pchurn, b.D1.P, b.D2 ? b.D2.P : 0, b.Pnom * 1.05, 10) * 1.12 || 10;
  const X = (q: number) => pad.l + (q / qMax) * (w - pad.l - pad.r),
    Y = (p: number) => h - pad.b - (p / pMax) * (h - pad.t - pad.b);
  g.clearRect(0, 0, w, h);
  g.font = `12px ${tema.font}`;
  g.strokeStyle = tema.line;
  g.fillStyle = tema.muted;
  g.lineWidth = 1;
  g.textAlign = 'right';
  const stepP = niceStep(pMax / 5),
    stepQ = niceStep(qMax / 6);
  for (let p = 0; p <= pMax; p += stepP) {
    g.beginPath();
    g.moveTo(pad.l, Y(p));
    g.lineTo(w - pad.r, Y(p));
    g.stroke();
    g.fillText(fmtNum(p, 0), pad.l - 6, Y(p) + 4);
  }
  g.textAlign = 'center';
  for (let q = 0; q <= qMax; q += stepQ) {
    g.beginPath();
    g.moveTo(X(q), h - pad.b);
    g.lineTo(X(q), pad.t);
    g.stroke();
    g.fillText(fmtNum(q, 0), X(q), h - pad.b + 15);
  }
  g.fillText('Caudal (gpm)', (w + pad.l) / 2, h - 6);
  g.save();
  g.translate(14, (h - pad.b + pad.t) / 2);
  g.rotate(-Math.PI / 2);
  g.fillText('Presión neta (psi)', 0, 0);
  g.restore();
  (
    [
      [b.Qnom, '100 %'],
      [1.5 * b.Qnom, '150 %'],
    ] as [number, string][]
  ).forEach(([q, t]) => {
    g.setLineDash([4, 4]);
    g.strokeStyle = tema.lineStrong;
    g.beginPath();
    g.moveTo(X(q), Y(0));
    g.lineTo(X(q), pad.t);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = tema.muted;
    g.fillText(t, X(q), pad.t + 10);
  });
  g.strokeStyle = tema.ink;
  g.lineWidth = 2.2;
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const q = (1.5 * b.Qnom * i) / 60,
      p = b.ca * q * q + b.cb * q + b.Pchurn;
    if (i) g.lineTo(X(q), Y(p));
    else g.moveTo(X(q), Y(p));
  }
  g.stroke();
  const pt = (d: { Q: number; P: number } | null, col: string, lab: string) => {
    if (!d) return;
    g.fillStyle = col;
    g.beginPath();
    g.arc(X(d.Q), Y(d.P), 6, 0, Math.PI * 2);
    g.fill();
    g.textAlign = 'left';
    g.fillStyle = tema.ink;
    g.fillText(`${lab} ${fmtNum(d.Q, 0)} gpm @ ${fmtNum(d.P, 1)} psi`, X(d.Q) + 9, Y(d.P) - 8);
  };
  pt(b.D1, tema.fire, 'D1');
  pt(b.D2, tema.steel, 'D2');
  if (!(b.Pnom > 0)) {
    g.textAlign = 'center';
    g.fillStyle = tema.muted;
    g.fillText(
      'Sin demanda calculada: complete la red de rociadores y la ruta del cuarto de bombas',
      (w + pad.l) / 2,
      (h - pad.b + pad.t) / 2,
    );
  }
}
