// ─── Chequeo bajante Aguas lluvias (UI inline formula) ───
/**
 * Rainwater downspout hydraulic check using the rational method and Manning for vertical pipes.
 * @param params.areaAcumulada - Contributing area (m²).
 * @param params.intensidad - Rainfall intensity (mm/h).
 * @param params.coeficienteC - Runoff coefficient.
 * @param params.R - Slope ratio string ('1/4', '7/24', or empty).
 * @param params.diamPropuesto - Proposed internal diameter (mm).
 * @returns Object with design flow Q (L/s), calculated diameter dCalc (mm), and status chequeo.
 */
export function chequeoBajanteLluvia({
  areaAcumulada = 0,
  intensidad = 0,
  coeficienteC = 0,
  R = '',
  diamPropuesto = 0,
}: {
  areaAcumulada?: number;
  intensidad?: number;
  coeficienteC?: number;
  R?: string;
  diamPropuesto?: number;
}): { Q: number; dCalc: number; chequeo: string } {
  const Rv = R === '1/4' ? 0.25 : R === '7/24' ? 7 / 24 : 0;
  const Q =
    areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
      ? Math.round(((areaAcumulada * intensidad * coeficienteC) / 100) * 100) / 100
      : 0;
  const dCalc =
    Q > 0 && Rv > 0
      ? Math.round(Math.pow(Q / (1.754 * Math.pow(Rv, 5 / 3)), 3 / 8) * 100) / 100
      : 0;
  const chequeo =
    dCalc > 0 && diamPropuesto > 0
      ? dCalc < diamPropuesto
        ? 'Ok'
        : 'No cumple'
      : dCalc > 0
        ? 'Sin diseño'
        : '—';
  return { Q, dCalc, chequeo };
}

// Borde libre (freeboard) added on top of the hydraulic depth for the built cross-section —
// always fixed, not user-editable (canal recolectora requirement).
/** Fixed freeboard added above hydraulic depth for built channel cross-section (cm). */
export const BORDE_LIBRE_CANAL_CM = 10;

// ─── Chequeo canal cubierta Aguas lluvias (UI inline formula) ───
/**
 * Rainwater roof-channel hydraulic check using the rational method and Manning for open channels.
 * @param params.areaAcumulada - Contributing area (m²).
 * @param params.intensidad - Rainfall intensity (mm/h).
 * @param params.coeficienteC - Runoff coefficient.
 * @param params.manning - Manning roughness coefficient (defaults to 0.009).
 * @param params.pendiente - Channel slope (%).
 * @param params.b - Channel base width (cm).
 * @param params.h - Channel height (cm).
 * @returns Object with real flow Qreal (L/s), max capacity Qmax (L/s), chequeo status, and totalStr.
 */
export function chequeoCanalLluvia({
  areaAcumulada = 0,
  intensidad = 0,
  coeficienteC = 0,
  manning = 0,
  pendiente = 0,
  b = 0,
  h = 0,
}: {
  areaAcumulada?: number;
  intensidad?: number;
  coeficienteC?: number;
  manning?: number;
  pendiente?: number;
  b?: number;
  h?: number;
}): { Qreal: number; Qmax: number; chequeo: string; totalStr: string } {
  const Qreal =
    areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
      ? Math.round(((areaAcumulada * intensidad * coeficienteC) / 100) * 100) / 100
      : 0;
  const n = manning || 0.009;
  const S = (pendiente || 0) / 100;
  const b_m = b / 100;
  const h_m = h / 100;
  const Qmax =
    b_m > 0 && h_m > 0 && n > 0 && S > 0
      ? Math.round(
          ((1000 * b_m * h_m) / n) *
            Math.sqrt(S) *
            Math.pow((b_m * h_m) / (b_m + 2 * h_m), 2 / 3) *
            100,
        ) / 100
      : 0;
  const chequeo =
    Qmax > 0 && Qreal > 0 ? (Qmax > Qreal ? 'Ok' : 'No cumple') : Qreal > 0 ? 'Sin sección' : '—';
  const totalStr = b > 0 || h > 0 ? `${b} x ${h + BORDE_LIBRE_CANAL_CM}` : '—';
  return { Qreal, Qmax, chequeo, totalStr };
}
