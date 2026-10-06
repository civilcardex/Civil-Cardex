// AlzadoMuro: alzado del recinto a escala con las aberturas requeridas (superior/inferior).
import type { RejResultado } from '../../utils/rejillasCalc';

export function AlzadoMuro({ res }: { res: RejResultado }) {
  const e = res.entrada;
  const vis = res.aberturas.filter((a) => a.pos !== 'int');
  const anchos = vis.map((a) => (a.n || 1) * a.w + ((a.n || 1) - 1) * 8);
  const L = Math.max(150, ...anchos.map((w) => w + 60));
  const H = Math.max(e.altoM, 2) * 100;
  const W = 360;
  const Hs = 250;
  const mL = 46;
  const mR = 16;
  const mT = 16;
  const mB = 30;
  const sc = Math.min((W - mL - mR) / L, (Hs - mT - mB) / H);
  // Muro angosto: centrar el sobrante del viewBox en vez de dejarlo todo a la derecha.
  const offX = (W - mL - mR - L * sc) / 2;
  const X = (x: number) => mL + offX + x * sc;
  const Y = (y: number) => Hs - mB - y * sc;
  return (
    <svg
      viewBox={`0 0 ${W} ${Hs}`}
      role="img"
      aria-label="Alzado del muro con rejillas"
      style={{
        width: '100%',
        maxWidth: 520,
        display: 'block',
        margin: '0 auto',
      }}
    >
      <rect
        x={X(0)}
        y={Y(H)}
        width={L * sc}
        height={H * sc}
        fill="var(--bg)"
        stroke="var(--line)"
        strokeWidth={3}
      />
      <line x1={X(0) - 8} x2={X(L) + 8} y1={Y(0)} y2={Y(0)} stroke="var(--txt)" strokeWidth={2} />
      {[
        [0, '0,00'],
        [30, '0,30'],
        [180, '1,80'],
        [H, 'Techo'],
      ].map(([y, t]) => (
        <g key={t as string}>
          <line
            x1={X(0) - 6}
            x2={X(0)}
            y1={Y(y as number)}
            y2={Y(y as number)}
            stroke="var(--txt3)"
          />
          <text
            x={X(0) - 9}
            y={(Y(y as number) ?? 0) + 4}
            textAnchor="end"
            fontSize={10}
            fill="var(--txt3)"
          >
            {t as string}
          </text>
        </g>
      ))}
      {[30, 180].map((y) => (
        <line
          key={y}
          x1={X(0)}
          x2={X(L)}
          y1={Y(y)}
          y2={Y(y)}
          stroke="var(--acc2)"
          strokeDasharray="4 4"
          opacity={0.6}
        />
      ))}
      {vis.map((a, k) => {
        const nU = a.n || 1;
        const tw = anchos[k];
        const y0 = a.pos === 'sup' ? (a.alt ? H - 5 - a.h : 180) : 4;
        const x00 = (L - tw) / 2;
        return (
          <g key={k}>
            {Array.from({ length: nU }, (_, u) => {
              const x0 = x00 + u * (a.w + 8);
              const nl = Math.max(2, Math.floor((a.h * sc) / 4));
              return (
                <g key={u}>
                  <rect
                    x={X(x0)}
                    y={Y(y0 + a.h)}
                    width={a.w * sc}
                    height={a.h * sc}
                    fill="rgba(37,99,235,.12)"
                    stroke="var(--acc2)"
                    strokeWidth={1.5}
                  />
                  {Array.from({ length: nl - 1 }, (_, q) => (
                    <line
                      key={q}
                      x1={X(x0) + 2}
                      x2={X(x0 + a.w) - 2}
                      y1={Y(y0) - (q + 1) * ((a.h * sc) / nl)}
                      y2={Y(y0) - (q + 1) * ((a.h * sc) / nl)}
                      stroke="var(--acc2)"
                      strokeWidth={0.8}
                    />
                  ))}
                </g>
              );
            })}
            <text
              x={X(L / 2)}
              y={Y(y0 + a.h) - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--txt)"
            >
              {nU > 1 ? `${nU} × ` : ''}
              {a.ref ? `${a.ref.marca} ${a.ref.ext}` : `${a.w} × ${a.h} cm`}
            </text>
          </g>
        );
      })}
      {!vis.length && (
        <text x={X(L / 2)} y={Y(H / 2)} textAnchor="middle" fontSize={12} fill="var(--txt3)">
          {res.aberturas.length ? 'Abertura en puerta o piso' : 'Sin rejillas requeridas'}
        </text>
      )}
      <text x={X(L / 2)} y={Hs - 8} textAnchor="middle" fontSize={10} fill="var(--txt3)">
        Esquema · alturas y rejillas a escala
      </text>
    </svg>
  );
}
