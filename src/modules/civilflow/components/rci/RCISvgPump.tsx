/** Esquema típico del cuarto de bombas del módulo RCI (extraído de RCISvgSchemas por el guard
 *  de líneas): distribución NFPA 20 de succión/descarga con etiquetas y cotas.
 *  Geometría portada LITERAL del HTML de referencia (mismo viewBox, mismos px).
 *  Ej: <PumpSvg modo="suc" /> dibuja solo el lado de succión. */
import type { ReactNode } from 'react';
import { NOTA_CSS, SVG_CSS } from './RCISvgTheme.tsx';
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
