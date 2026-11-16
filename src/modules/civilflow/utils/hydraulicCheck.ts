import {
  relacionesHidraulicas,
  caudalTuboLleno,
  velocidadTuboLleno,
  tipoRegimen,
  numeroFroude,
  fuerzaTractiva as fuerzaTractivaCore,
} from './calcSanitaryCore.ts';
import { V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN } from '../constants';
import type { perfilDe } from '../constants/countryStandards';

/** Límites de chequeo por país (perfil de normasPais); sin él, Colombia. */
export type LimitesSan = ReturnType<typeof perfilDe>['san'];

const YC_FACTOR = 0.296938082; // Derivado de Manning n=0.009 para PVC

interface HydraulicResult {
  Qo: number;
  Vo: number;
  qqo: number;
  Vreal: number;
  chequeoV: string;
  Yc: number;
  Yn: number;
  Froude: number;
  tipoFlujo: string;
  Ymax: number;
  chequeoYn: string;
  fuerzaTractiva: number;
  chequeoFT: string;
  /** Nivel FT: 'O.K.' (≥ recomendado), 'RECOMENDADO' (entre mínimo y recomendado) o 'NO CUMPLE' (< mínimo). */
  nivelFT: string;
  /** Pendiente mínima exigida (%) para el diámetro del tramo, o null si no hay tabla para el país. */
  pendMinima: number | null;
  chequeoS: string;
}

interface HydraulicParams {
  Q: number;
  S: number;
  n: number;
  DintMm: number;
}

/** Chequeo san (Sanitaria) completo del tramo (Qo/Vo, Yc/Yn, Froude (numero adimensional de regimen), tractiva + banderas).
 *  @param params.Q - Q (Caudal) de diseño (L/s).
 *  @param params.S - pendiente (m/m).
 *  @param params.n - rugosidad Manning (formula de flujo en tuberia).
 *  @param params.DintMm - diámetro interno (mm).
 *  @returns resultado con valores y chequeos pasa/falla. */
export function calcHydraulicCheck({
  Q,
  S,
  n,
  DintMm,
  lim,
  pendMin,
}: HydraulicParams & {
  lim?: Partial<LimitesSan>;
  pendMin?: Record<string, number>;
}): HydraulicResult {
  const V_MINp = lim?.vMin ?? V_MIN;
  const V_MAXp = lim?.vMax ?? V_MAX;
  const Y_Dp = lim?.ydMax ?? Y_D_MAX;
  const FTp = lim?.ftMin ?? FUERZA_TRACTIVA_MIN;
  const FTr = lim?.ftRec ?? FUERZA_TRACTIVA_MIN;
  const Qo = Math.round(caudalTuboLleno(DintMm / 1000, n, S) * 1000 * 100) / 100;
  const Vo = Math.round(velocidadTuboLleno(DintMm / 1000, n, S) * 100) / 100;
  const qqo = Qo > 0 ? Math.round((Q / Qo) * 100) / 100 : 0;
  const q = Qo > 0 ? Q / Qo : 0;
  const rel = relacionesHidraulicas(q);
  const Vreal = Math.round(rel.v_V0 * Vo * 100) / 100;
  const chequeoV = Vreal < V_MINp || Vreal > V_MAXp ? 'NO CUMPLE' : 'O.K.';
  const Rh = rel.Rh_D * DintMm;
  const Yc = Math.round(YC_FACTOR * DintMm * 100) / 100;
  const Yn = Math.round(rel.h_D * DintMm * 100) / 100;
  const Ymax = Math.round(DintMm * Y_Dp * 100) / 100;
  const chequeoYn = Math.max(Yc, Yn) < Ymax ? 'O.K.' : 'NO CUMPLE';
  const Froude = Math.round(numeroFroude(Vreal, (rel.Rh_D * DintMm) / 1000) * 100) / 100;
  const tipoFlujo = tipoRegimen(Froude);
  const fuerzaTractiva = Math.round(fuerzaTractivaCore(Rh / 1000, S) * 100) / 100;
  // FT en DOS niveles (doctrina 2026-11-16): bajo el mínimo normativo = NO CUMPLE; entre el
  // mínimo y el recomendado = RECOMENDADO (funciona, pero el diseño ideal está sobre ftRec).
  const chequeoFT =
    fuerzaTractiva > FTr ? 'O.K.' : fuerzaTractiva > FTp ? 'RECOMENDADO' : 'NO CUMPLE';
  const nivelFT = chequeoFT;
  // Pendiente mínima por diámetro (tabla del país en sanPendMin, pulg → %): la pendiente es
  // input del diseñador y la norma fija un piso por diámetro (NTC 1500 §8.3). Solo evalúa si
  // el país trae tabla; si no, null = sin chequeo.
  const pendMinima = pendMin ? buscaPendMin(pendMin, DintMm) : null;
  const sPct = S * 100;
  const chequeoS =
    pendMinima == null || sPct >= pendMinima
      ? 'O.K.'
      : `NO CUMPLE (pendiente mínima ${String(pendMinima).replace('.', ',')} %)`;
  return {
    Qo,
    Vo,
    qqo,
    Vreal,
    chequeoV,
    Yc,
    Yn,
    Froude,
    tipoFlujo,
    Ymax,
    chequeoYn,
    fuerzaTractiva,
    chequeoFT,
    nivelFT,
    pendMinima,
    chequeoS,
  };
}

/** Busca la pendiente mínima (%) para el diámetro del tramo: elige el diámetro nominal en
 *  pulgadas registrado en la tabla más cercano por debajo (el último que aplique). Ej: Ø 89 mm
 *  (3") con tabla {'2':2.0,'3':1.0,'4':1.0,'6':0.5,'8':0.3} → 1.0. */
function buscaPendMin(tabla: Record<string, number>, DintMm: number): number | null {
  const pulg = DintMm / 25.4;
  const orden = Object.entries(tabla)
    .map(([d, pct]) => ({ d: parseFloat(d), pct }))
    .sort((a, b) => a.d - b.d);
  let hit: number | null = null;
  for (const { d, pct } of orden) {
    if (pulg >= d - 0.25) hit = pct;
  }
  return hit;
}
