/**
 * Instalación típica con VRP (Válvula Reductora de Presión) en esquema SVG de RCI (Red Contra
 * Incendio): VCP con supervisión, VRP, detector de flujo, prueba y drenaje a la columna de
 * desagüe, bajada con dos codos y gabinete. Extraído verbatim de RCISvgFloorplan.
 * Ej: <VrpSvg /> dentro del panel de ayuda del perfil.
 */
import { COL_TEMA } from './RCISvgSchemas';
import type { CSSProperties } from 'react';
import { SVG_CSS } from './RCISvgCotas';

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
