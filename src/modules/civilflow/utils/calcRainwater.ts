// ─── Chequeo bajante Aguas lluvias (UI inline formula) ───
/**
 * Chequeo hidráulico de bajante de aguas lluvias usando el método racional y Manning para
 * tuberías verticales.
 * @param params.areaAcumulada - Área aportante (m²).
 * @param params.intensidad - Intensidad de lluvia (mm/h).
 * @param params.coeficienteC - Coeficiente de escorrentía.
 * @param params.R - String de razón de pendiente ('1/4', '7/24' o vacío).
 * @param params.diamPropuesto - Diámetro interno propuesto (mm).
 * @returns Objeto con caudal de diseño Q (L/s), diámetro calculado dCalc (mm) y estado chequeo.
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

// Borde libre (freeboard) sumado sobre el tirante hidráulico para la sección de canal construida —
// siempre fijo, no editable por el usuario (requisito de canal recolectora).
/** Borde libre fijo sumado sobre el tirante hidráulico para la sección de canal construida (cm). */
export const BORDE_LIBRE_CANAL_CM = 10;

// ─── Chequeo canal cubierta Aguas lluvias (UI inline formula) ───
/**
 * Chequeo hidráulico de canal de cubierta de aguas lluvias usando el método racional y Manning
 * para canales abiertos.
 * @param params.areaAcumulada - Área aportante (m²).
 * @param params.intensidad - Intensidad de lluvia (mm/h).
 * @param params.coeficienteC - Coeficiente de escorrentía.
 * @param params.manning - Coeficiente de rugosidad de Manning (default 0.009).
 * @param params.pendiente - Pendiente del canal (%).
 * @param params.b - Ancho de base del canal (cm).
 * @param params.h - Alto del canal (cm).
 * @returns Objeto con caudal real Qreal (L/s), capacidad máxima Qmax (L/s), estado chequeo y
 * totalStr.
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
