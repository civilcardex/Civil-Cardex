/**
 * Perfil de presiones del edificio (RCI, Red Contra Incendio): a la izquierda el esquema del
 * montante con VCP (Válvula de Control de Piso), VRP (Válvula Reductora de Presión) y
 * gabinetes por piso; al centro las columnas Q/holgura/estática y las curvas de presión
 * requerida, disponible y estática con la franja del jockey; a la derecha el estado de cada
 * piso. Recibe el Edificio ya calculado (no llama al motor). Ej:
 * <PerfilSvg edif={R.edif} bomba={R.bomba} tips={tips} /> en pantalla; con rep para la memoria.
 *
 * Geometría portada LITERAL del HTML de referencia CIVILFLOW_RCI_v1.7.79 (mismos viewBox,
 * mismos px): perfilSVG (~3300-3372). Las franjas de tooltip (.pfhit) quedan fuera: son
 * interacción, no geometría.
 */
import type { BombaResult, Edificio, PisoOut, Tips, Tipologia } from '../../lib/rci/types';
import type { CSSProperties } from 'react';
import { num } from '../../lib/rci/hydraulics';
import { colorTip, fmtNum, niceStep, temaRci, type TemaRci } from './RCISvgSchemas';

/** Perfil de presiones: montante + curvas + estado por piso (ver cabecera del archivo).
 *  `bomba` aporta el arranque/parada del jockey (franja gris de reposo); `tips` los colores de
 *  tipología; `sp` dibuja la línea de 100 psi de la válvula reguladora 1½" (pásese
 *  exigeSP && clase !== 'Clase I'); `rep` usa la paleta fija de la memoria impresa. */
export function PerfilSvg({
  edif,
  bomba,
  tips,
  rep = false,
  sp = false,
}: {
  edif: Edificio;
  bomba?: Pick<BombaResult, 'JkStart' | 'JkStop'>;
  tips?: Tips | Tipologia[];
  rep?: boolean;
  sp?: boolean;
}) {
  const E = edif;
  if (!E) return null;
  const c: TemaRci = temaRci(rep);
  const pf = E.pf
    .filter((o): o is PisoOut & { zT: number } => o.zT !== null)
    .sort((a, b) => a.zT - b.zT);
  if (!pf.length)
    return (
      <div style={{ padding: 26, textAlign: 'center', color: c.muted, border: 0, fontSize: 12.5 }}>
        Ingrese los NPT de los pisos.
      </div>
    );
  const zb = E.zB;
  const Pc = E.Pc || 175;
  const gov = E.gov;
  const W = 1000,
    mx = 82,
    dx0 = 205,
    x0 = 470,
    x1 = 860,
    sx = 868;
  const zmax = Math.max(...pf.map((o) => Math.max(o.zT, o.zS ?? -1e9))) + 2;
  const zmin = Math.min(0, E.zBase ?? 0) - 2.5;
  const H = Math.max(320, Math.min(580, 96 + (zmax - zmin) * 16));
  const y1 = 64,
    y0 = H - 40;
  const Y = (z: number) => y0 - ((y0 - y1) * (z - zmin)) / (zmax - zmin);
  const vals = pf
    .flatMap((o) => [o.Pst, o.disp, o.Preq])
    .filter((v): v is number => v !== undefined && v !== null && isFinite(v));
  const pmax = Math.max(Pc * 1.12, ...vals) * 1.04;
  const X = (p: number) => x0 + ((x1 - x0) * p) / pmax;
  const n1 = (v: number | null | undefined) => fmtNum(v, 1);
  const PSIM = 0.433 * 3.28084;
  const js = bomba?.JkStart,
    jp = bomba?.JkStop;
  const hasJ = typeof js === 'number' && isFinite(js) && typeof jp === 'number' && isFinite(jp);
  const grupos = Array.isArray(tips) ? tips : (tips?.groups ?? []);
  const tipMap = new Map(grupos.map((g) => [g.id, g]));
  const vv = (x: number, y: number, col: string, fill?: string) => (
    <path
      d={`M${x - 7} ${y - 5}L${x + 7} ${y + 5}V${y - 5}L${x - 7} ${y + 5}Z`}
      fill={fill || c.surf}
      style={{ stroke: col, strokeWidth: 1.3 }}
    />
  );
  // Sin ninguna red calculada (todo «Sin red») la presión nominal es 0: la estática sale
  // negativa y las curvas se aplastan en el eje — no se dibuja nada de curvas.
  const hayRed = pf.some((o) => o.res && o.res.valid);
  const hi = pf.filter((o) => (o.Pst ?? 0) > Pc);
  const zh = hi.length ? Math.max(...hi.map((o) => o.zT)) : null;
  const paso = niceStep(pmax / 5);
  const ticks: number[] = [];
  for (let p = 0; p <= pmax; p += paso) ticks.push(p);
  const leyenda = (
    [
      ['Requerida', c.fire],
      ['Holgura', c.ok],
      ['Disponible', c.steel],
      ['Estática', c.warn],
      ['Reposo (jockey)', c.muted],
      [`> ${Pc} psi`, c.fire],
    ] as [string, string][]
  )
    .filter(([t]) => hasJ || t !== 'Reposo (jockey)')
    .map(([t, col], i, todos) => {
      const w = t.length * 6.1 + 18;
      const lxPrev = todos.slice(0, i).reduce((a, [t2]) => a + t2.length * 6.1 + 18 + 5, 0);
      const lx = x0 + lxPrev;
      return (
        <g key={`lg${t}`}>
          <rect
            x={lx}
            y={36}
            width={w}
            height={18}
            rx={9}
            fill={
              t === 'Holgura'
                ? c.okS
                : t.startsWith('>')
                  ? c.fireS
                  : t.startsWith('Reposo')
                    ? c.line
                    : c.surf
            }
            style={{ stroke: col }}
          />
          <text
            x={lx + w / 2}
            y={49}
            textAnchor="middle"
            style={{ fontSize: 10, fontWeight: 600, fill: col }}
          >
            {t}
          </text>
        </g>
      );
    });
  const T = (x: number, y: number, t: string, st: CSSProperties = {}) => (
    <text x={x} y={y} style={{ fontSize: 11, fill: c.muted, ...st }}>
      {t}
    </text>
  );
  const box = (x: number, w: number, t: string, col: string) => (
    <g>
      <rect x={x} y={6} width={w} height={22} rx={4} fill={c.surf} style={{ stroke: col }} />
      <text
        x={x + w / 2}
        y={21}
        textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 600, fill: col }}
      >
        {t}
      </text>
    </g>
  );
  const linea = (campo: 'Pst' | 'disp' | 'Preq', col: string, dash?: boolean) => {
    const pts = pf
      .filter((o) => Number.isFinite(o[campo] ?? NaN))
      .map((o) => ({ z: o.zT, v: o[campo] as number }));
    if (!pts.length) return null;
    return (
      <g key={`ln${campo}`}>
        <polyline
          fill="none"
          style={{ stroke: col, strokeWidth: 2.5, ...(dash ? { strokeDasharray: '6 4' } : {}) }}
          points={pts.map((p) => `${X(p.v)},${Y(p.z)}`).join(' ')}
        />
        {pts.map((p, i) => (
          <circle key={i} cx={X(p.v)} cy={Y(p.z)} r={4} fill={col} />
        ))}
      </g>
    );
  };
  const srt = pf.slice().sort((a, b) => a.zT - b.zT);
  const jockeyPts = hasJ
    ? {
        a: srt.map((o) => `${X((js ?? 0) - PSIM * o.zT)},${Y(o.zT)}`),
        b: srt
          .slice()
          .reverse()
          .map((o) => `${X((jp ?? 0) - PSIM * o.zT)},${Y(o.zT)}`),
      }
    : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Perfil de presiones: esquema del montante, datos por piso y presión en la derivación de cada piso"
      style={
        rep
          ? {
              maxWidth: 760,
              width: '100%',
              height: 'auto',
              display: 'block',
              margin: '0 auto',
              border: '1px solid #ccd3d9',
            }
          : // Sin tope de altura: con maxHeight el SVG se letterboxea (dibujo encogido y centrado
            // dentro del elemento ancho) y el gráfico "sale" de su sección. width:100% manda.
            { width: '100%', height: 'auto', display: 'block' }
      }
    >
      <g style={{ fill: c.ink, font: `11px ${c.font}` }}>
        {/* títulos de bloques */}
        {box(4, 190, 'Montante y derivaciones', c.ink)}
        {box(dx0, 252, 'Datos por piso (en la derivación)', c.ink)}
        {box(x0, x1 - x0, 'Presión en la derivación de cada piso (psi)', c.ink)}
        {box(sx, 124, 'Estado', c.ink)}
        {leyenda}
        {/* zonas y ejes */}
        <rect x={X(Pc)} y={y1} width={x1 - X(Pc)} height={y0 - y1} fill={c.fireS} />
        {ticks.map((p, i) => (
          <g key={`tk${i}`}>
            <line x1={X(p)} y1={y1} x2={X(p)} y2={y0} style={{ stroke: c.line }} />
            {T(X(p), y0 + 14, String(Math.round(p)), { textAnchor: 'middle' })}
          </g>
        ))}
        <line x1={X(Pc)} y1={y1} x2={X(Pc)} y2={y0} style={{ stroke: c.fire, strokeWidth: 1.5 }} />
        {T(X(Pc) + 4, y0 - 6, `${Pc} psi componentes`, { fill: c.fire, fontWeight: 600 })}
        {sp ? (
          <>
            <line
              x1={X(100)}
              y1={y1}
              x2={X(100)}
              y2={y0}
              style={{ stroke: c.warn, strokeDasharray: '5 4' }}
            />
            {T(X(100) - 4, y0 - 6, '100 psi: válvula reguladora 1½"', {
              textAnchor: 'end',
              fill: c.warn,
            })}
          </>
        ) : null}
        {/* montante (esquema vertical) */}
        {(() => {
          const zTop = Math.max(...pf.map((o) => Math.max(o.zT, o.zS ?? -1e9)));
          return (
            <line
              x1={mx}
              y1={Y(zTop)}
              x2={mx}
              y2={Y(0)}
              style={{ stroke: c.steel, strokeWidth: 4 }}
            />
          );
        })()}
        {zh !== null ? (
          <line
            x1={mx}
            y1={Y(zh)}
            x2={mx}
            y2={Y(0)}
            style={{ stroke: c.fire, strokeWidth: 6, strokeOpacity: 0.55 }}
          />
        ) : null}
        <circle
          cx={mx}
          cy={Y(0)}
          r={10}
          fill={c.surf}
          style={{ stroke: c.ink, strokeWidth: 1.5 }}
        />
        <path d={`M${mx - 4} ${Y(0) - 5}L${mx + 5} ${Y(0)}L${mx - 4} ${Y(0) + 5}Z`} fill={c.ink} />
        {T(mx, Y(0) + 24, 'Bomba (eje)', { textAnchor: 'middle', fontWeight: 600, fill: c.ink })}
        {/* un piso: línea de NPT, chip de tipología, derivación con VCP, VRP y gabinete */}
        {pf.map((o) => {
          const yN = Y((num(o.f.npt) ?? 0) - zb);
          const y = Y(o.zT);
          const tg = o.tId ? tipMap.get(o.tId) : undefined;
          const tc = tg ? colorTip(tg.id) : rep ? '#5A6875' : c.muted;
          const zS = o.zS;
          return (
            <g key={`pf${o.f.i}${o.f.nombre}`}>
              <line x1={4} y1={yN} x2={196} y2={yN} style={{ stroke: c.ink, strokeWidth: 2 }} />
              {o.tId ? (
                <>
                  <rect x={mx + 8} y={yN + 3} width={22} height={13} rx={3} fill={tc} />
                  <text
                    x={mx + 19}
                    y={yN + 13}
                    textAnchor="middle"
                    style={{ fontSize: 9, fontWeight: 700, fill: '#fff' }}
                  >
                    {o.tId}
                  </text>
                </>
              ) : null}
              <text
                x={mx + (o.tId ? 34 : 8)}
                y={yN + 13}
                style={{ fontSize: 12, fontWeight: 600, fill: c.ink }}
              >
                {`${o.f.nombre} · NPT ${fmtNum(o.f.npt, 2)}`}
              </text>
              <line x1={mx} y1={y} x2={196} y2={y} style={{ stroke: c.steel, strokeWidth: 2 }} />
              <circle cx={mx} cy={y} r={3} fill={c.steel} />
              {vv(mx + 26, y, c.ink)}
              <text
                x={mx + 26}
                y={y - 9}
                textAnchor="middle"
                style={{ fontSize: 9.5, fill: c.muted }}
              >
                VCP
              </text>
              {o.vrp ? (
                <>
                  <rect
                    x={mx + 48}
                    y={y - 8}
                    width={30}
                    height={16}
                    rx={3}
                    fill={c.fireS}
                    style={{ stroke: c.fire }}
                  />
                  <text
                    x={mx + 63}
                    y={y + 4}
                    textAnchor="middle"
                    style={{ fontSize: 9.5, fontWeight: 700, fill: c.fire }}
                  >
                    VRP
                  </text>
                </>
              ) : null}
              <path
                d={`M190 ${y - 4}L196 ${y}L190 ${y + 4}`}
                fill="none"
                style={{ stroke: c.steel }}
              />
              {zS !== null && o.f.salida && o.f.salida !== 'Ninguna' ? (
                <>
                  <line
                    x1={mx}
                    y1={Y(zS)}
                    x2={mx - 22}
                    y2={Y(zS)}
                    style={{ stroke: c.steel, strokeWidth: 2 }}
                  />
                  <rect
                    x={mx - 50}
                    y={Y(zS) - 9}
                    width={26}
                    height={18}
                    rx={2}
                    fill={o.reg ? c.warnS : c.surf}
                    style={{ stroke: o.reg ? c.warn : c.ink }}
                  />
                  <text
                    x={mx - 37}
                    y={Y(zS) + 4}
                    textAnchor="middle"
                    style={{ fontSize: 9.5, fontWeight: 700, fill: o.reg ? c.warn : c.ink }}
                  >
                    {o.reg ? 'G·VR' : 'G'}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
        {/* datos por piso (Q, requerida, disponible, holgura, estática) */}
        {(() => {
          const cols = [
            ['Q', 'gpm', 'Q'],
            ['Req.', 'psi', 'Preq'],
            ['Disp.', 'psi', 'disp'],
            ['Holg.', 'psi', 'holg'],
            ['Est.', 'psi', 'Pst'],
          ] as [string, string, 'Q' | 'Preq' | 'disp' | 'holg' | 'Pst'][];
          const cw = 50;
          return (
            <>
              {cols.map(([h], i) => (
                <text
                  key={`ch${h}`}
                  x={dx0 + 4 + i * cw + cw / 2}
                  y={y1 - 2}
                  textAnchor="middle"
                  style={{ fontSize: 11, fontWeight: 600, fill: c.ink }}
                >
                  {h}
                </text>
              ))}
              {pf.map((o) => {
                const y = Y(o.zT);
                return (
                  <g key={`dp${o.f.i}${o.f.nombre}`}>
                    <rect
                      x={dx0}
                      y={y - 9}
                      width={cw * 5 + 8}
                      height={18}
                      rx={3}
                      fill={o === gov ? c.okS : c.surf}
                      style={{ stroke: c.line }}
                    />
                    {cols.map(([, , k2], i) => {
                      const v = o[k2];
                      const col =
                        k2 === 'holg' && v !== undefined
                          ? o.okH
                            ? c.ok
                            : c.fire
                          : k2 === 'Pst' && v !== undefined && v > Pc
                            ? c.fire
                            : c.ink;
                      return (
                        <text
                          key={k2}
                          x={dx0 + 4 + i * cw + cw / 2}
                          y={y + 4}
                          textAnchor="middle"
                          style={{ fontSize: 11, fill: col }}
                        >
                          {k2 === 'holg' && v !== undefined && v >= 0 ? `+${n1(v)}` : n1(v)}
                        </text>
                      );
                    })}
                  </g>
                );
              })}
            </>
          );
        })()}
        {/* curvas */}
        {pf.map((o) => (
          <line
            key={`cg${o.f.i}${o.f.nombre}`}
            x1={x0}
            y1={Y(o.zT)}
            x2={x1}
            y2={Y(o.zT)}
            style={{ stroke: c.line, strokeDasharray: '2 3' }}
          />
        ))}
        {hayRed && jockeyPts ? (
          <polygon
            points={jockeyPts.a.concat(jockeyPts.b).join(' ')}
            fill={c.line}
            fillOpacity={0.75}
            style={{ stroke: c.muted, strokeDasharray: '2 3' }}
          />
        ) : null}
        {pf
          .filter((o) => o.res && o.disp !== undefined)
          .map((o) => {
            const y = Y(o.zT);
            const xa = X(o.Preq ?? 0),
              xb = X(o.disp ?? 0);
            return (
              <rect
                key={`hg${o.f.i}${o.f.nombre}`}
                x={Math.min(xa, xb)}
                y={y - 5}
                width={Math.abs(xb - xa)}
                height={10}
                rx={3}
                fill={o.okH ? c.okS : c.fireS}
                style={{ stroke: o.okH ? c.ok : c.fire }}
              />
            );
          })}
        {hayRed ? linea('Pst', c.warn, true) : null}
        {hayRed ? linea('disp', c.steel) : null}
        {hayRed ? linea('Preq', c.fire) : null}
        {pf
          .filter((o) => o.vrp)
          .map((o) => {
            const y = Y(o.zT) + 13;
            const xa = X(o.Pst ?? 0);
            const xb = o.vrpSet ? X(o.vrpSet) : X(Pc) - 40;
            return (
              <g key={`vrp${o.f.i}${o.f.nombre}`}>
                <line
                  x1={xa}
                  y1={y}
                  x2={xb + 6}
                  y2={y}
                  style={{ stroke: c.fire, strokeWidth: 1.5 }}
                />
                <path
                  d={`M${xb + 8} ${y - 4}L${xb} ${y}L${xb + 8} ${y + 4}`}
                  fill="none"
                  style={{ stroke: c.fire, strokeWidth: 1.5 }}
                />
                <text
                  x={xb - 2}
                  y={y + 4}
                  textAnchor="end"
                  style={{ fontSize: 10, fontWeight: 600, fill: c.fire }}
                >
                  {o.vrpSet ? `VRP: piso a ≈ ${o.vrpSet} psi` : 'VRP (ajuste: falta la red)'}
                </text>
              </g>
            );
          })}
        {/* estado por piso */}
        {pf.map((o) => {
          const y = Y(o.zT);
          const L: [string, string, number][] = [];
          if (o.res && !o.okH) L.push(['✗ Falta holgura', c.fire, 1]);
          if (o.vrpFalta)
            L.push(['✗ Falta VRP', c.fire, 1], ['marcada «No» en Tipologías', c.fire, 0]);
          else if (o.vrp) L.push(['⚠ Requiere VRP', c.fire, 1], ['en la derivación', c.fire, 0]);
          if (o.regFalta)
            L.push(
              ['✗ Falta válv. reguladora', c.fire, 1],
              ['marcada «No» en Tipologías', c.fire, 0],
            );
          else if (o.reg) L.push(['⚠ Válvula reguladora', c.warn, 1], ['en gabinete', c.warn, 0]);
          if (!o.res)
            L.push([
              o.f.sinRoc ? 'Sin rociadores' : o.vrp ? 'ajuste: falta la red' : 'Sin red',
              c.muted,
              0,
            ]);
          if (!L.length) L.push(['✓ OK', c.ok, 1]);
          if (o === gov) L.push(['gobierna la bomba', c.muted, 0]);
          const yy = y + 4 - (L.length - 1) * 6;
          return (
            <g key={`est${o.f.i}${o.f.nombre}`}>
              {L.map(([t, col, bo], k2) => (
                <text
                  key={k2}
                  x={sx}
                  y={yy + k2 * 12}
                  style={{
                    fontSize: 11,
                    fill: col,
                    ...(bo ? { fontWeight: 600 } : { fontSize: 10 }),
                  }}
                >
                  {t}
                </text>
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
