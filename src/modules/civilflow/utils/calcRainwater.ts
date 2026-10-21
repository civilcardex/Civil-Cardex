// ─── Chequeos aguas lluvias — port de las hojas "1. Bajantes" y "2. Canales" del Excel ───
// Chequeo_canales_cubierta ffff.xlsx. Fórmulas exactas de las celdas; los valores FIJOS de la
// hoja Parametros van escritos literalmente aquí (orig. usuario: no referenciar una tabla de
// parámetros): 0.0630902 L/s→gpm, Wyly-Eaton K=27.8 (gpm,pulg), n ref=0.009, r=7/24,
// fracción muro vertical=0.5, Cw vertedero=1.7, Cd orificio=0.6, g=9.81 m/s², 0.0254 m/pulg.

/** Convierte L/s a gpm (galones por minuto, unidad con la que calcula el Excel de lluvias). */
const LPS_A_GPM = 0.0630902;
/** Coeficiente K de Wyly-Eaton (formula de ventilacion sanitaria): constante que dimensiona el bajante de lluvias según el llenado permitido. */
const WYLY_K = 27.8;
/** Rugosidad de referencia del K (ajuste a 1/n como Manning (formula de flujo en tuberia)): adapta la fórmula al material real del tubo. */
const WYLY_N_REF = 0.009;
/** Fracción del área del muro vertical que también llueve sobre la cubierta (0.5 = la mitad). */
const FRACCION_MURO = 0.5;
/** Cw del vertedero circular (m^0.5/s): cuánta agua salta del borde de la cubierta al canal. */
const CW_VERTEDERO = 1.7;
/** Cd de orificio de arista viva: cuánta agua pasa por el hueco canal→bajante. */
const CD_ORIFICIO = 0.6;
const G_M_S2 = 9.81;
const PULG_A_M = 0.0254;

export interface ChequeoBajanteResult {
  /** Q (Caudal) de diseño (L/s): C·I·A/3600 — agua que cae (C coeficiente de escorrentía, I intensidad de lluvia, A área). */
  Q: number;
  /** Diámetro calculado por Wyly-Eaton (formula de ventilacion sanitaria) (pulg): el que la lluvia exige. */
  dCalc: number;
  /** Capacidad del diámetro propuesto (L/s): cuánto puede llevar ese tubo. */
  Qcap: number;
  /** Q (Caudal)/Qcap (fracción; la UI lo muestra como %): 1.0 = el tubo va justo. */
  cociente: number;
  chequeo: string;
}

/** Chequeo de bajante ll (Lluvias): compara la lluvia que cae (método racional C·I·A) con lo que puede llevar el diámetro propuesto (Wyly-Eaton (formula de ventilacion sanitaria)).
 *  Ej: 100 m², 100 mm/h, C 0.8 -> 2.22 L/s -> exige ~2.4".
 *  @param params.areaAcumulada - Área aportante total (m²).
 *  @param params.intensidad - Intensidad de lluvia (mm/h).
 *  @param params.coeficienteC - Coeficiente de escorrentía (por material de cubierta).
 *  @param params.R - Razón de llenado ('1/4', '7/24' o vacío).
 *  @param params.manning - Manning (formula de flujo en tuberia) n del material (adimensional).
 *  @param params.diamPropuesto - Diámetro propuesto (pulg). */
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
  // Solo se juzga con D calculado disponible: sin insumos (material de cubierta sin elegir →
  // C=0 → Q=0 → dCalc=0) o sin D propuesto NO hay chequeo ('') — 'Ok' con dCalc=0 era falso
  // positivo (BALL1-C: material '—' y D 4" mostraba Ok sin calcular nada, ped. usuario).
  // Insumos completos CON D propuesto → 'Ok'/'No cumple'.
  const chequeo =
    dCalc > 0 && diamPropuesto > 0 ? (dCalc <= diamPropuesto ? 'Ok' : 'No cumple') : '';
  return { Q, dCalc, Qcap, cociente, chequeo };
}

// Borde libre (freeboard): en el Excel es columna de entrada editable por fila — default
// 10 cm (antes era fijo en todo el app; orig. usuario lo hizo editable tipo hoja 2).
/** Borde libre por defecto del canal de cubierta (cm): altura de seguridad que se deja sin agua antes de desbordar. */
export const BORDE_LIBRE_CANAL_CM = 10;

export interface ChequeoCanalResult {
  /** Área efectiva (m²): cubierta + la mitad del muro vertical que también le llueve encima. */
  aEfectiva: number;
  /** Q (Caudal) real que llega al canal (L/s) = C·I·Aef/3600. */
  Qreal: number;
  /** Capacidad Manning (formula de flujo en tuberia) de la sección útil (L/s): cuánto lleva el canal. */
  Qmax: number;
  /** Tirante normal (m): altura del agua dentro del canal, por iteración (5 pasadas, como el Excel AJ:AP). */
  yn: number;
  /** Velocidad del flujo dentro del canal (m/s) = Q/(b·yn). */
  velocidad: number;
  chequeo: string;
  /** Texto "b × (h+borde)" de la sección total. */
  totalStr: string;
}

/** Chequeo de canal de cubierta: ¿el canal de concreto lleva la lluvia (método racional + Manning (formula de flujo en tuberia)) sin desbordarse?
 *  Ej: 200 m², 100 mm/h, C 0.8, canal 20x15 cm a 1 % -> Qreal 4.44 L/s vs capacidad muy superior -> 'Ok'.
 *  @param params.muroVertical - Área de muro vertical que descarga al canal (m²).
 *  @param params.bordeLibreCm - Borde libre editable de la fila (cm). */
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
  /** Q (Caudal) que le toca a cada bajante (L/s) = Qreal / N bajantes. */
  QporBajante: number;
  /** Altura de lámina requerida encima del bajante (m) = max(H vertedero, H orificio). */
  Hreq: number;
  chequeo: string;
}

/** Chequeo de la embocadura (boca) canal→bajante: ¿el agua que salta del canal cabe por el bajante sin represarse atrás?
 *  Ej: 3 bajantes de 4" con Qreal 20 L/s -> 6.67 L/s por bajante.
 *  @param params.numBajantes - N° de bajantes asociados al canal.
 *  @param params.diamPulg - D propuesto menor de los asociados (pulg, conservador).
 *  @param params.hUtilM - Altura útil del canal (m) para el chequeo H ≤ h. */
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
