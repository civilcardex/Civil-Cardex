import { relacionesHidraulicas, caudalTuboLleno, velocidadTuboLleno, tipoRegimen, numeroFroude, fuerzaTractiva as fuerzaTractivaCore } from './calcSanitaryCore';

const YC_FACTOR = 0.296938082; // Derived from Manning n=0.009 for PVC

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
}

interface HydraulicParams {
  Q: number;
  S: number;
  n: number;
  DintMm: number;
  V_MIN: number;
  V_MAX: number;
  Y_D_MAX: number;
  FUERZA_TRACTIVA_MIN: number;
}

export function calcHydraulicCheck({ Q, S, n, DintMm, V_MIN, V_MAX, Y_D_MAX, FUERZA_TRACTIVA_MIN }: HydraulicParams): HydraulicResult {
  const Qo = Math.round(caudalTuboLleno(DintMm / 1000, n, S) * 1000 * 100) / 100;
  const Vo = Math.round(velocidadTuboLleno(DintMm / 1000, n, S) * 100) / 100;
  const qqo = Qo > 0 ? Math.round(Q / Qo * 100) / 100 : 0;
  const q = Qo > 0 ? Q / Qo : 0;
  const rel = relacionesHidraulicas(q);
  const Vreal = Math.round(rel.v_V0 * Vo * 100) / 100;
  const chequeoV = (Vreal < V_MIN || Vreal > V_MAX) ? 'NO CUMPLE' : 'O.K.';
  const Rh = rel.Rh_D * DintMm;
  const Yc = Math.round(YC_FACTOR * DintMm * 100) / 100;
  const Yn = Math.round(rel.h_D * DintMm * 100) / 100;
  const Ymax = Math.round(DintMm * Y_D_MAX * 100) / 100;
  const chequeoYn = Math.max(Yc, Yn) < Ymax ? 'O.K.' : 'NO CUMPLE';
  const Froude = Math.round(numeroFroude(Vreal, rel.Rh_D * DintMm / 1000) * 100) / 100;
  const tipoFlujo = tipoRegimen(Froude);
  const fuerzaTractiva = Math.round(fuerzaTractivaCore(Rh / 1000, S) * 100) / 100;
  const chequeoFT = fuerzaTractiva > FUERZA_TRACTIVA_MIN ? 'O.K.' : 'NO CUMPLE';
  return { Qo, Vo, qqo, Vreal, chequeoV, Yc, Yn, Froude, tipoFlujo, Ymax, chequeoYn, fuerzaTractiva, chequeoFT };
}
