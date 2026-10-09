// ─── Chequeos aguas lluvias — port de las hojas "1. Bajantes" y "2. Canales" del Excel ───
// Chequeo_canales_cubierta ffff.xlsx. Fórmulas exactas de las celdas; los valores FIJOS de la
// hoja Parametros van escritos literalmente aquí (orig. usuario: no referenciar una tabla de
// parámetros): 0.0630902 L/s→gpm, Wyly-Eaton K=27.8 (gpm,pulg), n ref=0.009, r=7/24,
// fracción muro vertical=0.5, Cw vertedero=1.7, Cd orificio=0.6, g=9.81 m/s², 0.0254 m/pulg.

/** Conversión L/s → gpm (factor fijado en las fórmulas del Excel). */
const LPS_A_GPM = 0.0630902;
/** Coeficiente Wyly-Eaton K (gpm, pulg) — tubería lisa. */
const WYLY_K = 27.8;
/** n de referencia del coeficiente K (ajuste proporcional a 1/n como Manning). */
const WYLY_N_REF = 0.009;
/** Fracción de área de muro vertical que se suma a la cubierta. */
const FRACCION_MURO = 0.5;
/** Cw vertedero circular (m^0.5/s) — embocadura perimetral. */
const CW_VERTEDERO = 1.7;
/** Cd orificio (embocadura de arista viva). */
const CD_ORIFICIO = 0.6;
const G_M_S2 = 9.81;
const PULG_A_M = 0.0254;

export interface ChequeoBajanteResult {
  /** Q de diseño (L/s) = C·I·A/3600. */
  Q: number;
  /** Diámetro calculado Wyly-Eaton (pulg). */
  dCalc: number;
  /** Capacidad del D propuesto (L/s). */
  Qcap: number;
  /** Q / Qcap (fracción; la UI lo muestra como %). */
  cociente: number;
  chequeo: string;
}

/**
 * Chequeo de bajante de aguas lluvias (hoja "1. Bajantes"): método racional Q = C·I·A/3600 y
 * Wyly-Eaton Q[gpm] = 27.8·(0.009/n)·r^(5/3)·D[pulg]^(8/3).
 * @param params.areaAcumulada - Área aportante total (m²).
 * @param params.intensidad - Intensidad de lluvia (mm/h).
 * @param params.coeficienteC - Coeficiente de escorrentía (de la tabla del catálogo por material de cubierta).
 * @param params.R - String de razón de llenado ('1/4', '7/24' o vacío).
 * @param params.manning - Manning n del material de la bajante.
 * @param params.diamPropuesto - Diámetro propuesto (pulg).
 */
export function chequeoBajanteLluvia({
  areaAcumulada = 0,
  intensidad = 0,
  coeficienteC = 0,
  R = '',
  manning = 0,
  diamPropuesto = 0,
}: {
  areaAcumulada?: number;
  intensidad?: number;
  coeficienteC?: number;
  R?: string;
  manning?: number;
  diamPropuesto?: number;
}): ChequeoBajanteResult {
  const Rv = R === '1/4' ? 0.25 : R === '7/24' ? 7 / 24 : 0;
  const Q =
    areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
      ? Math.round(((areaAcumulada * intensidad * coeficienteC) / 3600) * 100) / 100
      : 0;
  const capacidad = (dPulg: number): number =>
    dPulg > 0 && Rv > 0 && manning > 0
      ? WYLY_K * (WYLY_N_REF / manning) * Math.pow(Rv, 5 / 3) * Math.pow(dPulg, 8 / 3) * LPS_A_GPM
      : 0;
  // D = [Qgpm / (K·(n_ref/n)·r^(5/3))]^(3/8)
  const dCalc =
    Q > 0 && Rv > 0 && manning > 0
      ? Math.round(
          Math.pow(Q / LPS_A_GPM / (WYLY_K * (WYLY_N_REF / manning) * Math.pow(Rv, 5 / 3)), 3 / 8) *
            100,
        ) / 100
      : 0;
  const Qcap = Math.round(capacidad(diamPropuesto) * 100) / 100;
  const cociente = Qcap > 0 ? Q / Qcap : 0;
  // Sin D propuesto NO se juzga (falso positivo: el usuario aún no eligió diámetro y la
  // fila/informes la marcaban roja estando todo bien). Incompleto CON D propuesto → 'No
  // cumple' (REQ vigente): faltan insumos de cálculo pero ya hay decisión que verificar.
  const chequeo = diamPropuesto > 0 ? (dCalc <= diamPropuesto ? 'Ok' : 'No cumple') : '';
  return { Q, dCalc, Qcap, cociente, chequeo };
}

// Borde libre (freeboard): en el Excel es columna de entrada editable por fila — default
// 10 cm (antes era fijo en todo el app; orig. usuario lo hizo editable tipo hoja 2).
/** Borde libre por defecto del canal de cubierta (cm). */
export const BORDE_LIBRE_CANAL_CM = 10;

export interface ChequeoCanalResult {
  /** Área efectiva (m²) = A acumulada + 0.5·muro vertical. */
  aEfectiva: number;
  /** Q real (L/s) = C·I·Aef/3600. */
  Qreal: number;
  /** Capacidad Manning de la sección útil (L/s). */
  Qmax: number;
  /** Tirante normal (m), iteración de punto fijo (5 pasadas, como el Excel AJ:AP). */
  yn: number;
  /** Velocidad del flujo (m/s) = Q/(b·yn). */
  velocidad: number;
  chequeo: string;
  /** Texto "b × (h+borde)" de la sección total. */
  totalStr: string;
}

/**
 * Chequeo de canal de cubierta (hoja "2. Canales", sin las columnas rojas): Q = C·I·Aef/3600 y
 * Qmáx = 1000/n·A·R^(2/3)·√S con A = b·h y R = b·h/(b+2h) internos (columnas rojas Q/R/S del
 * Excel). El tirante normal itera yn_{k+1} = (Qn/√S)^0.6·(b+2·yn_k)^0.4/b (5 pasadas).
 * @param params.muroVertical - Área de muro vertical que descarga sobre el canal (m²).
 * @param params.bordeLibreCm - Borde libre editable de la fila (cm).
 */
export function chequeoCanalLluvia({
  areaAcumulada = 0,
  muroVertical = 0,
  intensidad = 0,
  coeficienteC = 0,
  manning = 0,
  pendiente = 0,
  b = 0,
  h = 0,
  bordeLibreCm = BORDE_LIBRE_CANAL_CM,
}: {
  areaAcumulada?: number;
  muroVertical?: number;
  intensidad?: number;
  coeficienteC?: number;
  manning?: number;
  pendiente?: number;
  b?: number;
  h?: number;
  bordeLibreCm?: number;
}): ChequeoCanalResult {
  const aEfectiva = areaAcumulada + FRACCION_MURO * muroVertical;
  const Qreal =
    areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
      ? Math.round(((aEfectiva * intensidad * coeficienteC) / 3600) * 100) / 100
      : 0;
  // REQ usuario: sin manning (material de canal sin asignar) NO hay fallback (antes 0.009):
  // Qmax/yn/velocidad quedan 0 por sus guards y el chequeo no se emite (chequeo vacío).
  const n = manning;
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
  // Tirante normal: semilla yn0 = (Qn/√S / b)^0.6; 5 iteraciones (Excel AK→AP).
  let yn = 0;
  if (Qreal > 0 && b_m > 0 && n > 0 && S > 0) {
    const qn = (Qreal / 1000) * (n / Math.sqrt(S));
    yn = Math.pow(qn / b_m, 0.6);
    for (let i = 0; i < 5; i++) yn = (Math.pow(qn, 0.6) * Math.pow(b_m + 2 * yn, 0.4)) / b_m;
    yn = Math.round(yn * 1e6) / 1e6;
  }
  const velocidad =
    Qreal > 0 && b_m > 0 && yn > 0 ? Math.round((Qreal / 1000 / (b_m * yn)) * 100) / 100 : 0;
  // REQ (chequeo incompleto = No cumple): sin Qreal (p. ej. falta material → C=0) o sin
  // sección (b/h/pendiente) la fila queda 'No cumple' — fuera '—'/'Sin sección'.
  // Excepción REQ usuario: sin manning el chequeo NO se emite (vacío = sin chequeo).
  const chequeo =
    n <= 0 ? '' : Qmax > 0 && Qreal > 0 ? (Qreal <= Qmax ? 'Ok' : 'No cumple') : 'No cumple';
  const totalStr = b > 0 || h > 0 ? `${b}x${h + (bordeLibreCm || 0)}` : '—';
  return {
    aEfectiva: Math.round(aEfectiva * 100) / 100,
    Qreal,
    Qmax,
    yn,
    velocidad,
    chequeo,
    totalStr,
  };
}

export interface EmbocaduraResult {
  /** Q que llega a cada bajante (L/s) = Qreal / N bajantes. */
  QporBajante: number;
  /** Altura de lámina requerida (m) = max(H vertedero, H orificio). */
  Hreq: number;
  chequeo: string;
}

/**
 * Embocadura canal → bajante (hoja "2. Canales" AE/AG; las rojas Z/AB/AC/AD quedan internas).
 * H vertedero = [Q(m³/s)/(1.7·π·D_m)]^(2/3); H orificio = [Q/(0.6·π·D_m²/4)]²/(2g); H = mayor.
 * El N° de bajantes sale de los asociados del canal y D del menor propuesto (conservador).
 * @param params.numBajantes - N° de bajantes asociados al canal.
 * @param params.diamPulg - D propuesto de la bajante (pulg) — el menor de los asociados.
 * @param params.hUtilM - Altura útil del canal (m) para el chequeo H ≤ h.
 */
export function chequeoEmbocaduraLluvia({
  Qreal = 0,
  numBajantes = 0,
  diamPulg = 0,
  hUtilM = 0,
}: {
  Qreal?: number;
  numBajantes?: number;
  diamPulg?: number;
  hUtilM?: number;
}): EmbocaduraResult {
  // REQ (chequeo incompleto = No cumple): faltan insumos → 'No cumple'; se CONSERVA
  // 'Revisar bajante' solo para el caso específico Q>0 sin bajantes/D asociados.
  if (Qreal <= 0 || numBajantes <= 0 || diamPulg <= 0) {
    return { QporBajante: 0, Hreq: 0, chequeo: Qreal > 0 ? 'Revisar bajante' : 'No cumple' };
  }
  const Qb = Qreal / numBajantes;
  const D_m = diamPulg * PULG_A_M;
  const Qm3 = Qb / 1000;
  const Hvert = Math.pow(Qm3 / (CW_VERTEDERO * Math.PI * D_m), 2 / 3);
  const Horif = Math.pow(Qm3 / (CD_ORIFICIO * Math.PI * ((D_m * D_m) / 4)), 2) / (2 * G_M_S2);
  const Hreq = Math.max(Hvert, Horif);
  const chequeo = hUtilM > 0 ? (Hreq <= hUtilM ? 'Ok' : 'No cumple') : 'No cumple';
  return {
    QporBajante: Math.round(Qb * 100) / 100,
    Hreq: Math.round(Hreq * 1e6) / 1e6,
    chequeo,
  };
}
