/**
 * Corte de la derivación del montante en el esquema SVG de RCI (Red Contra Incendio): tee, VCP
 * (Válvula de Control de Piso), detector de flujo y bajada hasta la cota de los ramales.
 * Recibe los DATOS ya calculados (no llama al motor). Extraído verbatim de RCISvgFloorplan.
 * Ej: <CorteSvg roc={R.roc} mont={estado.mont} zRam={5.3} zNudoRaiz={2.5} /> dibuja la bajada
 * 5,30 − 2,50 = 2,80 m hasta la cota de los ramales.
 */
import type { Criterios, MontCfg } from '../../lib/rci/types';
import { num } from '../../lib/rci/hydraulics';
import { COL_TEMA, n2 } from './RCISvgSchemas';
import { Flecha, SVG_CSS } from './RCISvgCotas';

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
