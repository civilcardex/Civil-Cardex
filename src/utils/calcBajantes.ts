import { DIAM_BAN, DIAM_VENT } from '../constants';
import { manning_SAN, caudalHunterLPS } from './calcSanitaryCore';


// ─── Capacidad de bajante (Manning con factor r = 7/24) ───
export function capacidadBajante(D_pulg: number, r?: number): number {
  const rFactor = r || 7 / 24;
  return 1.754 * Math.pow(rFactor, 5 / 3) * Math.pow(D_pulg, 8 / 3);
}

// ─── Velocidad terminal en bajante ───
export function velocidadTerminal(d_pulg: number): number {
  return 2.76 * Math.pow(d_pulg, 0.4);
}

// ─── Longitud terminal ───
export function longitudTerminal(Vt: number): number {
  return 0.17 * Vt * Vt;
}

export interface BajanteVentilacionParams {
  bajante?: string;
  pisos?: string;
  UD_propias?: number;
  UD_otros?: number;
  UD_acum?: number;
  r?: number;
  n?: number;
  bajDprop?: number;
  bajLong?: number;
  bajFDarcy?: number;
  ventDprop?: number;
}

export interface BajanteVentilacionResult {
  bajante: string;
  pisos: string;
  UD_propias: number;
  UD_otros: number;
  UD_acum: number;
  r: number;
  Q_Ls: number;
  n: number;
  Dcalc_pulg: number;
  Dprop_pulg: number;
  Dprop_nominal: string;
  Dprop_mm: number;
  chequeoDiam: string;
  QmaxBajante: number;
  Vt: number;
  Lt_calc: number;
  Lt_min: number;
  V_aire: number;
  Q_aire_Ls: number;
  fDarcy: number;
  longBajante_m: number;
  D_vent_calc_pulg: number;
  D_vent_prop_pulg: number;
  D_vent_nominal: string;
  cumple: boolean;
}

// ─── Calculo de bajante y ventilacion ───
export function calculateVentStack(params: BajanteVentilacionParams): BajanteVentilacionResult {
  const {
    bajante = '',
    pisos = '2-1',
    UD_propias = 0,
    UD_otros = 0,
    UD_acum = 0,
    r = 7 / 24,
    n = manning_SAN,
    bajDprop = 0,
    bajLong = 3,
    bajFDarcy = 0.025,
    ventDprop = 0,
  } = params;

  const Q = caudalHunterLPS(UD_acum, 1);

  const DcalcPulg = Q > 0 ? Math.pow(Q / (1.754 * Math.pow(r, 5 / 3)), 3 / 8) : 0;
  const DcalcMm = DcalcPulg * 25.4;

  const Dprop = bajDprop > 0 ? DIAM_BAN.find(d => Number(d.pulg) === Number(bajDprop)) : (DcalcMm > 0 ? DIAM_BAN.find(d => d.mm > DcalcMm) || DIAM_BAN[DIAM_BAN.length - 1] : null);
  const DpropPulg = Dprop ? Dprop.pulg : 0;
  const DpropMm = Dprop ? Dprop.mm : 0;

  const chequeoDiam = DcalcPulg > 0 && DpropPulg > 0 ? (DcalcPulg <= DpropPulg ? 'Ok' : 'No cumple') : '—';

  const QmaxBajante = DpropPulg > 0 ? 1.754 * Math.pow(r, 5 / 3) * Math.pow(DpropPulg, 8 / 3) : 0;
  const Vt = DpropPulg > 0 && Q > 0 ? Math.round(2.76 * Math.pow(Q / DpropPulg, 0.4) * 100) / 100 : 0;
  const Lt_calc = Vt > 0 ? 0.17 * Vt * Vt : 0;
  const Lt_min = DpropPulg > 0 ? Math.max(Lt_calc, 10 * DpropPulg * 2.54 / 100) : 0;

  const V_aire = Vt;
  const Q_aire = DpropPulg > 0 ? 1000 * V_aire * (17 / 24) * (Math.PI / 4) * Math.pow(DpropPulg * 2.54 / 100, 2) : 0;
  const fDarcy = bajFDarcy;
  const Lbajante = bajLong;

  const D_vent_calc_pulg = Lbajante > 0 && Q_aire > 0 ? Math.pow((Lbajante * fDarcy * Q_aire * Q_aire) / 3.25, 1 / 5) : 0;
  const D_vent_calc_mm = D_vent_calc_pulg * 25.4;

  const DventProp = ventDprop > 0 ? DIAM_VENT.find(d => Number(d.pulg) === Number(ventDprop)) : (D_vent_calc_mm > 0 ? DIAM_VENT.find(d => d.mm > D_vent_calc_mm) || DIAM_VENT[DIAM_VENT.length - 1] : null);
  const DventPropPulg = DventProp ? DventProp.pulg : 0;

  return {
    bajante,
    pisos,
    UD_propias,
    UD_otros,
    UD_acum,
    r: parseFloat(r.toFixed(4)),
    Q_Ls: parseFloat(Q.toFixed(4)),
    n,
    Dcalc_pulg: parseFloat(DcalcPulg.toFixed(2)),
    Dprop_pulg: DpropPulg,
    Dprop_nominal: Dprop ? DpropPulg + '"' : '—',
    Dprop_mm: DpropMm,
    chequeoDiam,
    QmaxBajante: parseFloat(QmaxBajante.toFixed(2)),
    Vt: parseFloat(Vt.toFixed(2)),
    Lt_calc: parseFloat(Lt_calc.toFixed(2)),
    Lt_min: parseFloat(Lt_min.toFixed(2)),
    V_aire: parseFloat(V_aire.toFixed(2)),
    Q_aire_Ls: parseFloat(Q_aire.toFixed(2)),
    fDarcy: fDarcy,
    longBajante_m: parseFloat(Lbajante.toFixed(1)),
    D_vent_calc_pulg: parseFloat(D_vent_calc_pulg.toFixed(2)),
    D_vent_prop_pulg: DventPropPulg,
    D_vent_nominal: DventProp ? DventPropPulg + '"' : '—',
    cumple: chequeoDiam === 'Ok',
  };
}


