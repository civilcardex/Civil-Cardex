/**
 * Planta tipo de la red de rociadores en esquema SVG de RCI (Red Contra Incendio): ramales
 * horizontales que entregan en tramos verticales hasta la derivación del montante, con capas
 * conmutables (cotas, nodos, numeración, área). Extraído verbatim de RCISvgFloorplan.
 * Ej: <PlanSvg roc={R.roc} opts={{ area: true, number: true, nodes: true }} />.
 */
import type { Criterios } from '../../lib/rci/types';
import { COL_TEMA, n2 } from './RCISvgSchemas';
import type { CSSProperties } from 'react';
import { CotaH, CotaV, SVG_CSS } from './RCISvgCotas';

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
  const H = Math.max(266, 106 + rows * 62);
  const dx = Math.min(78, 470 / cols),
    dy = Math.min(66, (H - 110) / Math.max(rows - 1, 1));
  const x0 = 84,
    yb = H - 74,
    xf = x0 + (cols - 1) * dx + 58;
  /* W mínimo 680 (el HTML) pero CRECE si "Derivación del montante"/"fin del cálculo del piso"
   * no caben a la derecha del vbox (xf+22 + ~140 px de texto): sin recorte con Nramal alto. */
  const W = Math.max(680, xf + 190);
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
