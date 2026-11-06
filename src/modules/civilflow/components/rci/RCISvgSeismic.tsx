/** Esquema de soportes sísmicos del módulo RCI (extraído de RCISvgSchemas por el guard de
 *  líneas): guía de ubicación de riostras laterales/longitudinales en planta (NFPA 13 cap. 18).
 *  Geometría portada LITERAL del HTML de referencia (mismo viewBox, mismos px).
 *  Ej: <SismoSvg losaRestr /> dibuja "la losa hace de apoyo" en lugar de la riostra intermedia. */
import { COL_TEMA, SVG_CSS, type TemaRci } from './RCISvgTheme.tsx';
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
