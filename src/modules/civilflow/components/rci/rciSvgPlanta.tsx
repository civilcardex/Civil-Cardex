/**
 * Esquemas SVG de la red de rociadores del piso (RCI, Red Contra Incendio): el corte de la
 * derivación del montante (tee, VCP (Válvula de Control de Piso), detector de flujo y bajada),
 * la planta tipo con ramales/tramos/cotas y la instalación típica con VRP (Válvula Reductora
 * de Presión) y gabinete. Reciben los DATOS ya calculados (no llaman al motor).
 * Ej: <CorteSvg roc={R.roc} mont={estado.mont} zRam={5.3} zNudoRaiz={2.5} /> dibuja la bajada
 * 5,30 − 2,50 = 2,80 m hasta la cota de los ramales.
 *
 * Geometría portada LITERAL del HTML de referencia CIVILFLOW_RCI_v1.7.79 (mismos viewBox,
 * mismos px): corteSVG (~2384), planSVG (~2409), vrpSVG (~3415). Las marcas de cota
 * marker-start/marker-end url(#ga) se dibujan como flechitas path (helper Flecha/CotaH/CotaV).
 */
import type { Criterios, MontCfg } from '../../lib/rci/types';
import { num } from '../../lib/rci/hydraulics';
import { COL_TEMA, n2 } from './rciSvgEsquemas';
import type { CSSProperties } from 'react';

const SVG_CSS: CSSProperties = { width: '100%', height: 'auto', display: 'block' };

/* ---------------- Helpers de cota (reemplazan los markers url(#ga) del HTML) ---------------- */

/** Flechita de cota: el chevron del marcador "ga" del HTML como path, apuntando en `dir`. */
function Flecha({
  x,
  y,
  dir,
  col = COL_TEMA.muted,
}: {
  x: number;
  y: number;
  dir: 'l' | 'r' | 'u' | 'd';
  col?: string;
}) {
  const d =
    dir === 'r'
      ? `M${x - 4.2} ${y - 2.8}L${x} ${y}L${x - 4.2} ${y + 2.8}`
      : dir === 'l'
        ? `M${x + 4.2} ${y - 2.8}L${x} ${y}L${x + 4.2} ${y + 2.8}`
        : dir === 'd'
          ? `M${x - 2.8} ${y - 4.2}L${x} ${y}L${x + 2.8} ${y - 4.2}`
          : `M${x - 2.8} ${y + 4.2}L${x} ${y}L${x + 2.8} ${y + 4.2}`;
  return <path d={d} fill="none" style={{ stroke: col, strokeWidth: 1.5 }} />;
}

/** Cota horizontal con flechas hacia afuera en ambos extremos (marker-start/end del HTML). */
function CotaH({
  x1,
  x2,
  y,
  col = COL_TEMA.muted,
}: {
  x1: number;
  x2: number;
  y: number;
  col?: string;
}) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} style={{ stroke: col, strokeWidth: 1 }} />
      <Flecha x={x1} y={y} dir="l" col={col} />
      <Flecha x={x2} y={y} dir="r" col={col} />
    </g>
  );
}

/** Cota vertical con flechas hacia afuera (arriba y abajo). */
function CotaV({
  x,
  y1,
  y2,
  col = COL_TEMA.muted,
}: {
  x: number;
  y1: number;
  y2: number;
  col?: string;
}) {
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} style={{ stroke: col, strokeWidth: 1 }} />
      <Flecha x={x} y={y1} dir="u" col={col} />
      <Flecha x={x} y={y2} dir="d" col={col} />
    </g>
  );
}

/* ---------------- Corte de la derivación ---------------- */

/** Datos del corte: la configuración del montante (alturas hD/hS) y las cotas de la red del
 *  piso (zRam común, o la del nudo raíz si cada nudo lleva la suya). */
export interface CorteDatos {
  roc: Criterios;
  /** Alturas del montante: hD = derivación del piso sobre NPT (Nivel de Piso Terminado), hS = salida de manguera. */
  mont: Pick<MontCfg, 'hD' | 'hS'>;
  /** Cota (m) de los ramales: red.zRam ya resuelta con num(); null = sin dato. */
  zRam?: number | null;
  /** Cota del nudo raíz (red.nodos[raiz].z con num()); gana sobre mont.hD si existe. */
  zNudoRaiz?: number | null;
  /** Ramales a dibujar (1-6); por defecto roc.Nramales. */
  Nramales?: number;
}

/** Corte de la derivación: tee en el montante, VCP, detector de flujo, prueba y drenaje, y la
 *  bajada hasta la cota de los ramales (L del último tramo = planta + bajada).
 *  Ej: <CorteSvg roc={R.roc} mont={estado.mont} zRam={num(red.zRam)} zNudoRaiz={2.5} Nramales={3} />. */
export function CorteSvg({ roc, mont, zRam = null, zNudoRaiz = null, Nramales }: CorteDatos) {
  const c = COL_TEMA;
  const hD = zNudoRaiz !== null ? zNudoRaiz : (num(mont.hD) ?? 2.5);
  const hS = num(mont.hS) ?? 1.2;
  const ok = zRam !== null && zRam > hD;
  const baj = ok ? zRam - hD : null;
  const ny = Math.max(Math.min(Nramales ?? (roc.Nramales || 3), 6), 1);
  const lt = String.fromCharCode(65 + ny);
  const tn = 'Último tramo';
  const W = 600,
    H = 234,
    yN = 192;
  const zMax = Math.max(ok ? zRam : 5.3, hD + 1.5, 3) * 1.08;
  const k = 158 / zMax;
  const Yz = (z: number) => yN - z * k;
  const xM = 96,
    xU = 318,
    xE = 584;
  const yC = Yz(hD),
    yR = Yz(ok ? zRam : hD + 2.8),
    yG = Yz(hS);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Corte: tee de derivación en el montante, válvula de control, detector de flujo y bajada hasta la cota de los ramales"
      style={SVG_CSS}
    >
      <g style={{ fill: c.ink, font: `12px ${c.font}` }}>
        <rect
          x={10}
          y={10}
          width={140}
          height={218}
          rx={8}
          fill={c.zmF}
          style={{ stroke: c.ok, strokeWidth: 1, strokeDasharray: '5 4' }}
        />
        <rect
          x={156}
          y={10}
          width={434}
          height={218}
          rx={8}
          fill={c.zrF}
          style={{ stroke: c.fire, strokeWidth: 1, strokeDasharray: '5 4', strokeOpacity: 0.9 }}
        />
        <line x1={10} y1={yN} x2={590} y2={yN} style={{ stroke: c.muted, strokeWidth: 1 }} />
        <text x={582} y={yN - 6} textAnchor="end" style={{ fill: c.muted }}>
          NPT del piso
        </text>
        <text x={20} y={208} style={{ fill: c.ink, fontWeight: 600 }}>
          Análisis del
        </text>
        <text x={20} y={221} style={{ fill: c.ink, fontWeight: 600 }}>
          montante
        </text>
        <text x={373} y={214} textAnchor="middle" style={{ fill: c.ink, fontWeight: 600 }}>
          Red del piso: tablas Ramales y Tramos
        </text>
        <line x1={xM} y1={4} x2={xM} y2={230} style={{ stroke: c.steel, strokeWidth: 4 }} />
        <text x={20} y={28} style={{ fill: c.muted }}>
          Montante
        </text>
        <line x1={xM} y1={yG} x2={xM - 24} y2={yG} style={{ stroke: c.ink, strokeWidth: 2 }} />
        <text x={xM - 28} y={yG + 4} textAnchor="end" style={{ fill: c.muted }}>
          Gabinete
        </text>
        <path
          d={`M${xM} ${yC} H${xU} V${yR} H${xE}`}
          fill="none"
          style={{ stroke: c.fire, strokeWidth: 2 }}
        />
        <polygon
          points={`${xM + 26},${yC - 7} ${xM + 26},${yC + 7} ${xM + 42},${yC - 7} ${xM + 42},${yC + 7}`}
          fill={c.surf}
          style={{ stroke: c.ink, strokeWidth: 1.3 }}
        />
        <text x={xM + 34} y={yC - 12} textAnchor="middle" style={{ fill: c.muted }}>
          VCP
        </text>
        <rect
          x={xM + 66}
          y={yC - 6}
          width={16}
          height={12}
          fill={c.surf}
          style={{ stroke: c.ink, strokeWidth: 1.3 }}
        />
        <text x={xM + 74} y={yC - 12} textAnchor="middle" style={{ fill: c.muted }}>
          DF
        </text>
        <line
          x1={xM + 100}
          y1={yC}
          x2={xM + 100}
          y2={yN - 4}
          style={{ stroke: c.steel, strokeWidth: 2, strokeDasharray: '5 3' }}
        />
        <Flecha x={xM + 100} y={yN - 4} dir="d" />
        <circle
          cx={xM + 100}
          cy={yC + 18}
          r={4}
          fill={c.surf}
          style={{ stroke: c.ink, strokeWidth: 1.3 }}
        />
        <text x={xM + 108} y={yC + 22} style={{ fill: c.muted }}>
          prueba y drenaje
        </text>
        <text x={xM + 108} y={yN - 8} style={{ fill: c.muted }}>
          a la columna de desagüe
        </text>
        <circle cx={xM} cy={yC} r={6} fill={c.steel} />
        <text x={xM - 10} y={yC - 6} textAnchor="end" style={{ fill: c.ink, fontWeight: 600 }}>
          {lt}
        </text>
        <text x={xM - 10} y={yC + 10} textAnchor="end" style={{ fill: c.muted }}>
          {ok || zNudoRaiz !== null ? `+${n2(hD)}` : 'altura deriv.'}
        </text>
        <circle cx={xU} cy={yC} r={4} fill={c.surf} style={{ stroke: c.ink, strokeWidth: 1.3 }} />
        <text x={xU + 10} y={yC + 16} style={{ fill: c.muted }}>
          codo
        </text>
        <circle cx={xU} cy={yR} r={4} fill={c.surf} style={{ stroke: c.ink, strokeWidth: 1.3 }} />
        <text x={xU - 8} y={yR - 8} textAnchor="end" style={{ fill: c.muted }}>
          codo
        </text>
        <text x={xU - 8} y={yR + 16} textAnchor="end" style={{ fill: c.muted }}>
          {ok ? `+${n2(zRam)}` : 'cota ramales'}
        </text>
        <text x={xU + 12} y={(yC + yR) / 2} style={{ fill: c.ink, fontWeight: 600 }}>
          bajada{ok ? ` ${n2(baj)} m` : ''}
        </text>
        <text x={xU + 12} y={(yC + yR) / 2 + 15} style={{ fill: c.muted }}>
          {ok ? `(${n2(zRam)} − ${n2(hD)})` : 'cota ramales − altura deriv.'}
        </text>
        <text x={xU + 12} y={yR - 8} style={{ fill: c.ink, fontWeight: 600 }}>
          {tn}: L = planta + bajada
        </text>
        <text x={xE} y={yR + 16} textAnchor="end" style={{ fill: c.muted }}>
          hacia ramales y tramos →
        </text>
      </g>
    </svg>
  );
}

/* ---------------- Planta tipo ---------------- */

/** Opciones del esquema en planta (las de planSVG del HTML): qué capas se dibujan. */
export interface PlanOpts {
  /** Cotas S, L y distancias a muro. */
  dims?: boolean;
  /** Montante de alimentación a la derecha (false lo apaga, como en la guía de separaciones). */
  feed?: boolean;
  /** Etiquetas "Ramal" y "Tramos hacia la derivación". */
  labels?: boolean;
  /** Nudos A/B/C… en cada ramal y la derivación del montante. */
  nodes?: boolean;
  /** Con nodes: cambia el pie por "tee en el montante · ver corte". */
  verCorte?: boolean;
  /** Rectángulo del área de diseño con su lado largo 1,2·√A. */
  area?: boolean;
  /** Numera los rociadores 1..Nreq (respeta el ramal parcial). */
  number?: boolean;
  /** Cota del brazo: L ramal − (n − 1)·S. */
  brazo?: boolean;
  /** Círculos con el orden de trazado en el módulo de dibujo. */
  order?: boolean;
  /** Fila extra de tubería (p. ej. para el contexto del montante). */
  ctxRow?: boolean;
  /** aria-label del svg. */
  label?: string;
}

/** Planta tipo: ramales horizontales que entregan en tramos verticales a la derecha, hasta la
 *  derivación del montante. Respeta el ramal parcial (Nultimo < Nramal) cuando el área no llena
 *  el último ramal. Ej: <PlanSvg roc={R.roc} opts={{ area: true, number: true, nodes: true }} />. */
export function PlanSvg({ roc, opts = {} }: { roc: Criterios; opts?: PlanOpts }) {
  const c = COL_TEMA;
  const ro = roc;
  const nx = Math.max(ro.Nramal || 3, 1),
    ny = Math.max(Math.min(ro.Nramales || 3, 6), 1);
  const nl = ro.Nultimo || nx,
    parcial = ny > 1 && nl < nx;
  const extra = 2;
  const cols = nx + extra;
  const rows = ny + (opts.ctxRow ? 1 : 0);
  const W = 680,
    H = Math.max(266, 106 + rows * 62);
  const dx = Math.min(78, 470 / cols),
    dy = Math.min(66, (H - 110) / Math.max(rows - 1, 1));
  const x0 = 84,
    yb = H - 74,
    xf = x0 + (cols - 1) * dx + 58;
  const Y = (j: number) => yb - j * dy,
    X = (i: number) => x0 + i * dx;
  const pipeSt: CSSProperties = { stroke: c.fire, strokeWidth: 2, strokeOpacity: 0.75 };
  // Numeración de rociadores: mismo orden del HTML (ramal por ramal, desde el más remoto).
  const lab: Record<string, number> = {};
  let k = 0;
  if (opts.number)
    for (let j = 0; j < ny; j++) {
      const last = j === ny - 1 && parcial;
      const to = last ? nl : nx;
      for (let i = 0; i < to; i++) lab[`${j}_${i}`] = ++k;
    }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={opts.label || 'Esquema en planta de la red'}
      style={SVG_CSS}
    >
      <g style={{ fill: c.ink, font: `12px ${c.font}` }}>
        <line
          x1={x0 - 46}
          y1={Y(rows - 1) - 34}
          x2={x0 - 46}
          y2={yb + 46}
          style={{ stroke: c.ink, strokeWidth: 4 }}
        />
        <line
          x1={x0 - 46}
          y1={yb + 46}
          x2={xf + 30}
          y2={yb + 46}
          style={{ stroke: c.ink, strokeWidth: 4 }}
        />
        <text x={x0 - 52} y={yb + 62} style={{ fill: c.muted }}>
          Muro
        </text>
        {Array.from({ length: rows }, (_, j) => (
          <line key={`p${j}`} x1={X(0) - 10} y1={Y(j)} x2={xf} y2={Y(j)} style={pipeSt} />
        ))}
        {opts.feed !== false ? (
          <line
            x1={xf}
            y1={yb}
            x2={xf}
            y2={Y(rows - 1) - 26}
            style={{ stroke: c.steel, strokeWidth: 4 }}
          />
        ) : null}
        {Array.from({ length: rows }, (_, j) =>
          Array.from({ length: cols }, (_, i) => {
            const inArea =
              !!opts.area && j < ny && i < nx && (!(j === ny - 1 && parcial) || i < nl);
            const id = lab[`${j}_${i}`];
            return (
              <g key={`s${j}_${i}`}>
                <circle
                  cx={X(i)}
                  cy={Y(j)}
                  r={id ? 10 : 6}
                  fill={inArea || id ? c.fire : c.calc}
                  style={inArea || id ? undefined : { stroke: c.lineStrong, strokeWidth: 1.5 }}
                />
                {id ? (
                  <text
                    x={X(i)}
                    y={Y(j) + 4}
                    textAnchor="middle"
                    style={{ fill: '#fff', fontWeight: 600, fontSize: 11 }}
                  >
                    {id}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
        {opts.area ? (
          <g>
            {(() => {
              const xa = Math.max(X(0) - dx / 2, x0 - 40),
                xb2 = X(nx - 1) + dx / 2,
                ya = Y(ny - 1) - dy / 2,
                yb2 = yb + Math.min(dy / 2, 40);
              return (
                <>
                  <rect
                    x={xa}
                    y={ya}
                    width={xb2 - xa}
                    height={yb2 - ya}
                    fill="none"
                    style={{ stroke: c.fire, strokeWidth: 1.5, strokeDasharray: '7 5' }}
                  />
                  <text
                    x={(xa + xb2) / 2}
                    y={ya - 8}
                    textAnchor="middle"
                    style={{ fill: c.ink, fontWeight: 600 }}
                  >
                    Lado largo 1,2·√A = {n2(ro.Llargo)} m
                  </text>
                </>
              );
            })()}
          </g>
        ) : null}
        {opts.nodes ? (
          <g>
            {Array.from({ length: ny }, (_, j) => (
              <g key={`n${j}`}>
                <rect x={xf + 8} y={Y(j) - 10} width={32} height={20} rx={3} fill={c.steel} />
                <text
                  x={xf + 24}
                  y={Y(j) + 4}
                  textAnchor="middle"
                  style={{ fill: c.surf, fontWeight: 600, fontSize: 11 }}
                >
                  {String.fromCharCode(65 + j)}
                </text>
              </g>
            ))}
            <rect x={xf - 15} y={Y(rows - 1) - 50} width={30} height={22} rx={3} fill={c.ink} />
            <text
              x={xf}
              y={Y(rows - 1) - 35}
              textAnchor="middle"
              style={{ fill: c.surf, fontWeight: 600, fontSize: 11 }}
            >
              {String.fromCharCode(65 + ny)}
            </text>
            <text x={xf + 22} y={Y(rows - 1) - 40} style={{ fill: c.ink, fontWeight: 600 }}>
              Derivación del montante
            </text>
            <text x={xf + 22} y={Y(rows - 1) - 26} style={{ fill: c.muted }}>
              {opts.verCorte ? 'tee en el montante · ver corte' : 'fin del cálculo del piso'}
            </text>
          </g>
        ) : null}
        {opts.dims ? (
          <g>
            {(() => {
              const yd = yb + 16;
              return (
                <>
                  <CotaH x1={X(0)} x2={X(1)} y={yd} />
                  <text
                    x={(X(0) + X(1)) / 2}
                    y={yd + 15}
                    textAnchor="middle"
                    style={{ fill: c.ink, fontWeight: 600 }}
                  >
                    S = {n2(ro.S)} m
                  </text>
                  <CotaH x1={X(0) - 46} x2={X(0)} y={yd} />
                  <text
                    x={X(0) - 23}
                    y={yd + 15}
                    textAnchor="middle"
                    style={{ fill: c.ink, fontWeight: 600 }}
                  >
                    ≤ {n2(ro.hz.s / 2)}
                  </text>
                  {(() => {
                    const xw = X(Math.min(cols - 1, 3)) + 14;
                    return (
                      <>
                        <CotaV x={xw} y1={yb} y2={yb + 46} />
                        <text x={xw + 6} y={yb + 30} style={{ fill: c.ink, fontWeight: 600 }}>
                          ≤ {n2(ro.hz.s / 2)}
                        </text>
                      </>
                    );
                  })()}
                  {rows > 1 ? (
                    <>
                      <CotaV x={X(2) + 14} y1={Y(0)} y2={Y(1)} />
                      <text
                        x={X(2) + 20}
                        y={(Y(0) + Y(1)) / 2 + 4}
                        style={{ fill: c.ink, fontWeight: 600 }}
                      >
                        L = {n2(ro.L)} m
                      </text>
                    </>
                  ) : null}
                </>
              );
            })()}
          </g>
        ) : null}
        {opts.brazo ? (
          <g>
            {(() => {
              const yd = yb + 16;
              return (
                <>
                  <CotaH x1={X(nx - 1)} x2={xf} y={yd} />
                  <text
                    x={xf}
                    y={yd + 15}
                    textAnchor="end"
                    style={{ fill: c.ink, fontWeight: 600 }}
                  >
                    brazo = L ramal − (n − 1)·S
                  </text>
                </>
              );
            })()}
          </g>
        ) : null}
        {opts.labels ? (
          <g>
            <text x={X(0)} y={Y(rows - 1) - 20} style={{ fill: c.muted }}>
              Ramal (rociadores sobre la misma línea)
            </text>
            {(() => {
              const ym = rows > 1 ? (Y(0) + Y(1)) / 2 : Y(0) - 20;
              return (
                <>
                  <text x={xf - 10} y={ym} textAnchor="end" style={{ fill: c.muted }}>
                    Tramos hacia la derivación
                  </text>
                  <line
                    x1={xf - 8}
                    y1={ym - 4}
                    x2={xf - 2}
                    y2={ym - 4}
                    style={{ stroke: c.muted, strokeWidth: 1 }}
                  />
                </>
              );
            })()}
          </g>
        ) : null}
        {opts.order ? (
          <g>
            {(() => {
              const mk = (n: number, x: number, y: number) => (
                <g key={`o${n}`}>
                  <circle cx={x} cy={y} r={11} fill={c.warn} />
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    style={{ fill: '#fff', fontWeight: 700, fontSize: 12 }}
                  >
                    {n}
                  </text>
                </g>
              );
              return (
                <>
                  <line
                    x1={x0 - 40}
                    y1={Y(rows - 1) - 46}
                    x2={x0 + 40}
                    y2={Y(rows - 1) - 46}
                    style={{ stroke: c.muted, strokeWidth: 1 }}
                  />
                  {mk(1, x0 - 52, Y(rows - 1) - 46)}
                  <text x={x0 + 46} y={Y(rows - 1) - 42} style={{ fill: c.muted }}>
                    escala
                  </text>
                  {mk(2, X(0), Y(0) - 22)}
                  {mk(3, xf + 16, (Y(0) + Y(Math.min(1, rows - 1))) / 2)}
                  {mk(4, xf - 30, Y(rows - 1) - 39)}
                  {mk(5, X(1) + dx / 2, Y(Math.min(1, rows - 1)) - 16)}
                  {mk(6, X(nx) + dx / 2, Y(0) - 16)}
                </>
              );
            })()}
          </g>
        ) : null}
      </g>
    </svg>
  );
}

/* ---------------- Instalación típica con VRP ---------------- */

/** Instalación típica de la derivación del piso: VCP con supervisión, VRP (solo si la estática
 *  en la derivación supera la presión de los componentes), detector de flujo, prueba y drenaje
 *  a la columna de desagüe, bajada con dos codos y gabinete con válvula reguladora 1½".
 *  Estático: no depende de datos. Ej: <VrpSvg /> dentro del panel de ayuda del perfil. */
export function VrpSvg() {
  const y = 160,
    yR = 56,
    xU = 760,
    yD = 268,
    xD = 880;
  const c = COL_TEMA;
  const T = (x: number, yy: number, t: string, st: CSSProperties = {}) => (
    <text x={x} y={yy} textAnchor="middle" style={{ fontSize: 11, fill: c.muted, ...st }}>
      {t}
    </text>
  );
  const bow = (cx: number, col = c.ink) => (
    <path
      d={`M${cx - 11} ${y - 8}L${cx + 11} ${y + 8}V${y - 8}L${cx - 11} ${y + 8}Z`}
      fill={c.surf}
      style={{ stroke: col, strokeWidth: 1.5 }}
    />
  );
  const bowV = (cx: number, cy: number) => (
    <path
      d={`M${cx - 8} ${cy - 11}L${cx + 8} ${cy + 11}H${cx - 8}L${cx + 8} ${cy - 11}Z`}
      fill={c.surf}
      style={{ stroke: c.ink, strokeWidth: 1.5 }}
    />
  );
  const ga = (cx: number) => (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y - 22} style={{ stroke: c.ink }} />
      <circle cx={cx} cy={y - 31} r={9} fill={c.surf} style={{ stroke: c.ink }} />
      <text
        x={cx}
        y={y - 28}
        textAnchor="middle"
        style={{ fontSize: 9, fontWeight: 700, fill: c.ink }}
      >
        P
      </text>
    </g>
  );
  const codo = (cx: number, cy: number) => (
    <circle cx={cx} cy={cy} r={4} fill={c.surf} style={{ stroke: c.steel, strokeWidth: 2 }} />
  );
  return (
    <>
      <svg
        viewBox="0 0 1000 350"
        role="img"
        aria-label="Instalación típica de la derivación del piso: válvula de control, VRP si se requiere, detector de flujo, prueba y drenaje a la columna de desagüe, bajada con dos codos y gabinete con válvula reguladora"
        style={SVG_CSS}
      >
        <g style={{ fill: c.ink, font: `11px ${c.font}` }}>
          <line x1={60} y1={20} x2={60} y2={340} style={{ stroke: c.steel, strokeWidth: 6 }} />
          {T(60, 14, 'Montante', { fontWeight: 700, fill: c.ink })}
          <path
            d={`M60 ${y}H${xU}V${yR}H950`}
            fill="none"
            style={{ stroke: c.steel, strokeWidth: 4 }}
          />
          <circle cx={60} cy={y} r={5} fill={c.ink} />
          {T(60, y + 22, 'Tee')}
          {codo(xU, y)}
          {codo(xU, yR)}
          {T(xU + 12, y + 4, 'codo', { textAnchor: 'start' })}
          {T(xU - 10, yR - 8, 'codo', { textAnchor: 'end' })}
          {T(xU + 12, (y + yR) / 2, 'Bajada a la cota de los ramales', {
            textAnchor: 'start',
            fontWeight: 600,
            fill: c.ink,
          })}
          {T(xU + 12, (y + yR) / 2 + 15, 'L del tramo = planta + bajada', { textAnchor: 'start' })}
          <path
            d={`M940 ${yR - 6}L952 ${yR}L940 ${yR + 6}`}
            fill="none"
            style={{ stroke: c.steel, strokeWidth: 2 }}
          />
          {T(950, yR - 14, 'Red de rociadores del piso', {
            textAnchor: 'end',
            fontWeight: 600,
            fill: c.ink,
          })}
          {bow(140)}
          <rect x={132} y={y - 30} width={16} height={12} fill={c.surf} style={{ stroke: c.ink }} />
          <text
            x={140}
            y={y - 21}
            textAnchor="middle"
            style={{ fontSize: 8, fontWeight: 700, fill: c.ink }}
          >
            S
          </text>
          {T(140, y + 32, 'VCP con supervisión')}
          {ga(210)}
          {T(210, y - 46, 'Manómetro (antes)')}
          <rect
            x={262}
            y={y - 16}
            width={56}
            height={32}
            rx={4}
            fill={c.fireS}
            style={{ stroke: c.fire, strokeWidth: 2 }}
          />
          <text
            x={290}
            y={y + 5}
            textAnchor="middle"
            style={{ fontSize: 12, fontWeight: 700, fill: c.fire }}
          >
            VRP
          </text>
          {T(290, y + 32, 'Válvula reductora listada', { fill: c.fire, fontWeight: 600 })}
          {ga(370)}
          {T(370, y - 46, 'Manómetro (después)')}
          <rect
            x={100}
            y={y - 58}
            width={300}
            height={100}
            rx={8}
            fill="none"
            style={{ stroke: c.fire, strokeDasharray: '6 4' }}
          />
          {T(250, y - 64, 'Solo si la estática en la derivación > componentes', {
            fill: c.fire,
            fontWeight: 600,
          })}
          <line x1={430} y1={y} x2={430} y2={yD} style={{ stroke: c.steel, strokeWidth: 2 }} />
          <path
            d={`M422 ${y + 30}L438 ${y + 30}L430 ${y + 42}Z`}
            fill={c.surf}
            style={{ stroke: c.ink }}
          />
          {T(440, y + 40, 'Válvula de alivio (con VRP)', { textAnchor: 'start' })}
          <rect
            x={490}
            y={y - 12}
            width={40}
            height={24}
            rx={3}
            fill={c.surf}
            style={{ stroke: c.ink }}
          />
          <text
            x={510}
            y={y + 4}
            textAnchor="middle"
            style={{ fontSize: 10, fontWeight: 700, fill: c.ink }}
          >
            DF
          </text>
          {T(510, y - 20, 'Detector de flujo')}
          <line x1={620} y1={y} x2={620} y2={yD} style={{ stroke: c.steel, strokeWidth: 2 }} />
          {bowV(620, y + 44)}
          {T(632, y + 48, 'Prueba y drenaje', { textAnchor: 'start' })}
          <line
            x1={430}
            y1={yD}
            x2={xD}
            y2={yD}
            style={{ stroke: c.steel, strokeWidth: 2, strokeDasharray: '6 3' }}
          />
          <line
            x1={xD}
            y1={yD - 40}
            x2={xD}
            y2={340}
            style={{ stroke: c.steel, strokeWidth: 3, strokeDasharray: '6 3' }}
          />
          {T(xD - 10, yD - 28, 'Columna de desagüe', {
            textAnchor: 'end',
            fontWeight: 600,
            fill: c.ink,
          })}
          {T(xD - 10, yD - 14, '(paralela al montante)', { textAnchor: 'end' })}
          <line x1={60} y1={290} x2={150} y2={290} style={{ stroke: c.steel, strokeWidth: 3 }} />
          <circle cx={60} cy={290} r={4} fill={c.ink} />
          <path d="M150 282L166 298V282L150 298Z" fill={c.surf} style={{ stroke: c.ink }} />
          {T(158, 318, 'Válvula de manguera 1½"', { textAnchor: 'start' })}
          <rect
            x={178}
            y={280}
            width={34}
            height={20}
            rx={3}
            fill={c.warnS}
            style={{ stroke: c.warn, strokeWidth: 2 }}
          />
          <text
            x={195}
            y={294}
            textAnchor="middle"
            style={{ fontSize: 10, fontWeight: 700, fill: c.warn }}
          >
            VR
          </text>
          {T(250, 340, 'Válvula reguladora 1½" (si la residual > 100 psi)', {
            fill: c.warn,
            fontWeight: 600,
          })}
          <rect
            x={230}
            y={272}
            width={90}
            height={36}
            rx={4}
            fill="none"
            style={{ stroke: c.ink }}
          />
          {T(275, 294, 'Gabinete')}
        </g>
      </svg>
      <p style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.45, color: c.muted }}>
        Esquema típico de referencia. Desde la tee, la VCP, el detector de flujo y la conexión de
        prueba y drenaje quedan a altura accesible; luego la tubería sube a la cota de los ramales
        con dos codos (la bajada se suma a la L del tramo que llega a la derivación). La prueba y
        drenaje, y la válvula de alivio cuando hay VRP, descargan a la columna de desagüe. La VRP
        protege la red del piso; el montante sigue con la presión completa. La válvula reguladora va
        en la salida de 1½" del gabinete y es independiente de la VRP: un restrictor solo limita con
        flujo; el regulador controla también la estática. Con VRP, NFPA 13 pide manómetros antes y
        después, válvula de alivio y prueba de la válvula.
      </p>
    </>
  );
}
