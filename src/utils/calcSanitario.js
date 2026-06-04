// ============================================
// calcSanitario.js - Calculo Red sanitaria
// Basado en NTC 1500, RAS 2000, maning, Hunter
// Casa de Roca No. 97 - Floridablanca, Santander
// ============================================

export const GRAVEDAD = 9.80665;
export const maning_SAN = 0.009;
export const maning_SAN_VENT = 0.009;

// ─── Tabla de UD por aparato (NTC 1500) ───
export const APARATOS_UD = [
  { id: 'sif', nombre: 'Sifones/Drenajes', ud: 2, dimSifon: 2 },
  { id: 'lvm', nombre: 'Lavamanos', ud: 2, dimSifon: 1.25 },
  { id: 'san', nombre: 'Inodoro', ud: 4, dimSifon: 0 },
  { id: 'duc', nombre: 'Ducha', ud: 2, dimSifon: 1.5 },
  { id: 'lvra', nombre: 'Lavadora', ud: 4, dimSifon: 2 },
  { id: 'tin', nombre: 'Tina', ud: 2, dimSifon: 1.5 },
  { id: 'lvp', nombre: 'Lavaplatos', ud: 2, dimSifon: 1.5 },
  { id: 'lvro', nombre: 'Lavadero', ud: 2, dimSifon: 1.5 },
  { id: 'ori', nombre: 'Orinal', ud: 5, dimSifon: 0 },
  { id: 'flu', nombre: 'Sanitario fluxometro', ud: 6, dimSifon: 0 },
];

// ─── Tabla de tuberias sanitarias y ventilacion (del Excel) ───
export const TUBERIAS_SAN = [
  { nominal: '1½"', dExt: 48.26, dExtPulg: 1.90, dInt: 42.68, espesor: 2.79, espPulg: 0.11, peso: 0.64 },
  { nominal: '2"',   dExt: 60.32, dExtPulg: 2.37, dInt: 54.48, espesor: 2.92, espPulg: 0.11, peso: 0.84 },
  { nominal: '3"',   dExt: 82.56, dExtPulg: 3.25, dInt: 76.20, espesor: 3.18, espPulg: 0.12, peso: 1.27 },
  { nominal: '4"',   dExt: 114.30, dExtPulg: 4.50, dInt: 107.70, espesor: 3.30, espPulg: 0.13, peso: 1.84 },
  { nominal: '6"',   dExt: 168.28, dExtPulg: 6.62, dInt: 160.04, espesor: 4.12, espPulg: 0.16, peso: 3.41 },
];

export const TUBERIAS_VENT = [
  { nominal: '1½"', dExt: 48.26, dExtPulg: 1.90, dInt: 45.22, espesor: 1.52, espPulg: 0.06, peso: 0.36 },
  { nominal: '2"',   dExt: 60.32, dExtPulg: 2.37, dInt: 56.76, espesor: 1.78, espPulg: 0.07, peso: 0.53 },
  { nominal: '3"',   dExt: 82.56, dExtPulg: 3.25, dInt: 79.00, espesor: 1.78, espPulg: 0.07, peso: 0.73 },
  { nominal: '4"',   dExt: 114.30, dExtPulg: 4.50, dInt: 110.08, espesor: 2.11, espPulg: 0.08, peso: 1.20 },
];

// ─── Factor de simultaneidad (Hunter modificado) ───
export function factorSimultaneidad(numSalidas) {
  if (numSalidas <= 1) return 1;
  return 1 / Math.sqrt(numSalidas - 1);
}

// ─── Caudal de Hunter (Rodriguez Diaz) ───
export function caudalHunterLPS(UD, K) {
  let Q;
  if (UD < 240) {
    Q = K * 0.1163 * Math.pow(UD, 0.6875);
  } else {
    Q = K * 0.074 * Math.pow(UD, 0.7504);
  }
  return Q;
}

// ─── Diametros comerciales sanitarios ───
export const DIAMETROS_COMERCIALES = [
  { pulg: 1.5, mm: 42.68, nominal: '1½"' },
  { pulg: 2,   mm: 54.48, nominal: '2"' },
  { pulg: 3,   mm: 76.20, nominal: '3"' },
  { pulg: 4,   mm: 107.70, nominal: '4"' },
  { pulg: 6,   mm: 160.04, nominal: '6"' },
];

export function diametroPropuesto(Dcalc_mm) {
  if (Dcalc_mm <= 0) return DIAMETROS_COMERCIALES[0];
  for (const d of DIAMETROS_COMERCIALES) {
    if (d.mm >= Dcalc_mm) return d;
  }
  return DIAMETROS_COMERCIALES[DIAMETROS_COMERCIALES.length - 1];
}

// ─── Caudal a tubo lleno (maning) ───
export function caudalTuboLleno(D_m, n, S) {
  if (D_m <= 0 || S <= 0) return 0;
  const A = Math.PI * D_m * D_m / 4;
  const Rh = D_m / 4;
  return (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Velocidad a tubo lleno ───
export function velocidadTuboLleno(D_m, n, S) {
  if (D_m <= 0 || S <= 0) return 0;
  const Rh = D_m / 4;
  return (1 / n) * Math.pow(Rh, 2 / 3) * Math.pow(S, 0.5);
}

// ─── Propiedades geometricas seccion circular parcialmente llena ───
export function calcPropiedadesGeometricas(h_D) {
  const hD = Math.min(Math.max(h_D, 0.001), 0.999);
  const alpha = 2 * Math.acos(1 - 2 * hD);
  const A_D2 = (alpha - Math.sin(alpha)) / 8;
  const Rh_D = (1 / 4) * (1 - Math.sin(alpha) / alpha);
  const T_D = Math.sin(alpha / 2);
  return {
    hD,
    alpha,
    A_D2,
    Rh_D,
    T_D,
    A: (alpha) => (D_m) => A_D2 * D_m * D_m,
    Rh: Rh_D,
  };
}

// ─── Relacion Q/Qo y V/Vo (tablas de Leon/Estopin) ───
export function relacionesHidraulicas(q_Qo) {
  let v_V0, h_D;
  const r = Math.min(Math.max(q_Qo, 0.01), 0.999);

  if (r <= 0.06) {
    v_V0 = Math.pow(10, 0.029806 + 0.29095 * Math.log10(r));
  } else if (r <= 0.26) {
    v_V0 = Math.pow(10, 0.013778 + 0.28597 * Math.log10(r));
  } else {
    v_V0 = Math.pow(10, 0.021763 + 0.289951 * Math.log10(r));
  }

  if (r < 0.11) {
    h_D = 0.3827 + 0.0645 * Math.log(r);
  } else if (r < 0.21) {
    h_D = 0.60025 + 0.15471 * Math.log(r);
  } else {
    h_D = 0.225 + 0.667 * r;
  }

  h_D = Math.min(Math.max(h_D, 0.01), 0.98);

  const alpha = 2 * Math.acos(1 - 2 * h_D);
  const Rh_D = (1 / 4) * (1 - Math.sin(alpha) / alpha);

  return { q_Qo: r, v_V0, h_D, alpha, Rh_D };
}

// ─── Tirante critico Yc (condicion Fr = 1 en seccion circular) ───
export function tiranteCritico(D_m, Q_m3s) {
  if (Q_m3s <= 0 || D_m <= 0) return 0;

  let hD_lo = 0.01, hD_hi = 0.99;

  for (let i = 0; i < 100; i++) {
    const hD_mid = (hD_lo + hD_hi) / 2;
    const alpha = 2 * Math.acos(1 - 2 * hD_mid);
    const A = (D_m * D_m / 4) * (alpha - Math.sin(alpha)) / 2;
    const T = D_m * Math.sin(alpha / 2);
    const Fr2 = (Q_m3s * Q_m3s * T) / (GRAVEDAD * Math.pow(A, 3));

    if (Fr2 < 1) {
      hD_lo = hD_mid;
    } else {
      hD_hi = hD_mid;
    }
  }

  const hD = (hD_lo + hD_hi) / 2;
  return hD * D_m;
}

// ─── Tirante normal Yn (maning iterativo) ───
export function tiranteNormal(D_m, Q_m3s, n, S) {
  if (Q_m3s <= 0 || D_m <= 0 || S <= 0 || n <= 0) return 0;

  const Qo = caudalTuboLleno(D_m, n, S);
  const q_Qo = Q_m3s / Qo;

  if (q_Qo <= 0.01) return 0.01 * D_m;
  if (q_Qo >= 1.0) return 0.95 * D_m;

  const rel = relacionesHidraulicas(q_Qo);
  return rel.h_D * D_m;
}

// ─── Numero de Froude ───
export function numeroFroude(V, DH) {
  if (DH <= 0) return Infinity;
  return V / Math.sqrt(GRAVEDAD * DH);
}

// ─── Fuerza tractiva ───
export function fuerzaTractiva(Rh, S) {
  if (Rh <= 0 || S <= 0) return 0;
  return 1000 * Rh * S;
}

// ─── Tipo de regimen ───
export function tipoRegimen(Fr) {
  if (Fr < 0.9) return 'Subcritico';
  if (Fr <= 1.1) return 'Critico';
  return 'Supercritico';
}

// ─── Diametro calculado por maning ───
export function diametromaning(Q_m3s, n, S) {
  if (S <= 0 || Q_m3s <= 0 || n <= 0) return 0;
  return Math.pow((Q_m3s * n) / (0.312 * Math.sqrt(S)), 3 / 8);
}

// ─── Calculo completo de un tramo sanitario ───
export function calcularTramoSanitario(params) {
  const {
    tramo = '',
    piso = 1,
    UD_propias = 0,
    UD_otros = 0,
    numSalidas = 1,
    pendiente = 0.02,
    n = maning_SAN,
  } = params;

  const UD_acumulado = parseFloat(UD_propias) + parseFloat(UD_otros);
  const K = factorSimultaneidad(parseInt(numSalidas) || 1);
  const Q_Ls = caudalHunterLPS(UD_acumulado, K);
  const Q_m3s = Q_Ls / 1000;

  const Dcalc_m = diametromaning(Q_m3s, n, pendiente || 0.02);
  const Dcalc_mm = Dcalc_m * 1000;
  const Dcalc_pulg = Dcalc_mm / 25.4;

  const Dprop = diametroPropuesto(Dcalc_mm);
  const Dprop_m = Dprop.mm / 1000;

  const Qo = caudalTuboLleno(Dprop_m, n, pendiente || 0.02);
  const Qo_Ls = Qo * 1000;
  const Vo = velocidadTuboLleno(Dprop_m, n, pendiente || 0.02);

  const q_Qo = Q_m3s / (Qo || 0.001);

  const rel = relacionesHidraulicas(q_Qo);
  const V_real = rel.v_V0 * Vo;
  const Yn_mm = rel.h_D * Dprop.mm;
  const Rh_real = rel.Rh_D * Dprop.mm;

  const Yc_mm = tiranteCritico(Dprop_m, Q_m3s) * 1000;

  const Fr = numeroFroude(V_real, (rel.Rh_D * Dprop_m));
  const tau = fuerzaTractiva(rel.Rh_D * Dprop_m, pendiente || 0.02);

  const Ymax_mm = 0.75 * Dprop.mm;

  const verifVel = V_real >= 0.45 && V_real <= 4.0;
  const verifYn = Yn_mm < Ymax_mm;
  const verifTau = tau >= 0.15;
  const cumple = verifVel && verifYn && verifTau;

  return {
    tramo: tramo || `T-${Date.now()}`,
    piso,
    UD_propias: parseFloat(UD_propias) || 0,
    UD_otros: parseFloat(UD_otros) || 0,
    UD_acumulado,
    numSalidas: parseInt(numSalidas) || 1,
    K: parseFloat(K.toFixed(4)),
    Q_Ls: parseFloat(Q_Ls.toFixed(4)),
    Q_m3s: parseFloat(Q_m3s.toFixed(6)),
    n,
    S: pendiente || 0.02,
    Dcalc_mm: parseFloat(Dcalc_mm.toFixed(2)),
    Dcalc_pulg: parseFloat(Dcalc_pulg.toFixed(2)),
    Dprop_nominal: Dprop.nominal,
    Dprop_pulg: Dprop.pulg,
    Dprop_mm: Dprop.mm,
    Dint_mm: Dprop.mm,
    Qo_Ls: parseFloat(Qo_Ls.toFixed(4)),
    Vo: parseFloat(Vo.toFixed(4)),
    q_Qo: parseFloat(q_Qo.toFixed(4)),
    V_real: parseFloat(V_real.toFixed(4)),
    Yn_mm: parseFloat(Yn_mm.toFixed(2)),
    Yc_mm: parseFloat(Yc_mm.toFixed(2)),
    Fr: parseFloat(Fr.toFixed(4)),
    regime: tipoRegimen(Fr),
    Rh_real: parseFloat(Rh_real.toFixed(4)),
    fuerzaTractiva: parseFloat((1000 * (rel.Rh_D * Dprop_m) * (pendiente || 0.02)).toFixed(4)),
    Ymax_mm: parseFloat(Ymax_mm.toFixed(2)),
    alpha: parseFloat(rel.alpha.toFixed(4)),
    V_Vo: parseFloat(rel.v_V0.toFixed(4)),
    Y_D: parseFloat(rel.h_D.toFixed(4)),
    Rh_D: parseFloat(rel.Rh_D.toFixed(4)),
    Rh_mm: parseFloat((rel.Rh_D * Dprop.mm).toFixed(4)),
    verifVel,
    verifYn,
    verifTau,
    cumple,
  };
}

// ─── Capacidad de bajante (maning con factor r = 7/24) ───
export function capacidadBajante(D_pulg, r) {
  const rFactor = r || 7 / 24;
  return 1.754 * Math.pow(rFactor, 5 / 3) * Math.pow(D_pulg, 8 / 3);
}

// ─── Velocidad terminal en bajante ───
export function velocidadTerminal(d_pulg) {
  return 2.76 * Math.pow(d_pulg, 0.4);
}

// ─── Longitud terminal ───
export function longitudTerminal(Vt) {
  return 0.17 * Vt * Vt;
}

// ─── Calculo de bajante y ventilacion ───
export function calcularBajanteVentilacion(params) {
  const {
    bajante = '',
    pisos = '2-1',
    UD_propias = 0,
    UD_otros = 0,
    UD_acum = 0,
    r = 7 / 24,
    n = maning_SAN,
    bajDprop = 0,
    bajLong = 3,
    bajFDarcy = 0.025,
    ventDprop = 0,
  } = params;

  const Q = caudalHunterLPS(UD_acum, 1);

  const DcalcPulg = Q > 0 ? Math.pow(Q / (1.754 * Math.pow(r, 5 / 3)), 3 / 8) : 0;
  const DcalcMm = DcalcPulg * 25.4;

  const DIAM_BAN = [
    { pulg: 1.5, mm: 42.68 },
    { pulg: 2, mm: 54.48 },
    { pulg: 3, mm: 76.20 },
    { pulg: 4, mm: 107.70 },
    { pulg: 6, mm: 160.04 },
    { pulg: 8, mm: 213.20 },
  ];
  const Dprop = bajDprop > 0 ? DIAM_BAN.find(d => Number(d.pulg) === Number(bajDprop)) : (DcalcMm > 0 ? DIAM_BAN.find(d => d.mm > DcalcMm) || DIAM_BAN[DIAM_BAN.length - 1] : null);
  const DpropPulg = Dprop ? Dprop.pulg : 0;
  const DpropMm = Dprop ? Dprop.mm : 0;

  const chequeoDiam = DcalcPulg > 0 && DpropPulg > 0 ? (DcalcPulg <= DpropPulg ? 'O.K.' : 'NO CUMPLE') : '—';

  const QmaxBajante = DpropPulg > 0 ? 1.754 * Math.pow(r, 5 / 3) * Math.pow(DpropPulg, 8 / 3) : 0;
  const Vt = DpropPulg > 0 && Q > 0 ? Math.round(2.76 * Math.pow(Q / DpropPulg, 0.4) * 100) / 100 : 0;
  const Lt_calc = Vt > 0 ? 0.17 * Vt * Vt : 0;
  const Lt_min = DpropPulg > 0 ? Math.max(Lt_calc, 10 * DpropPulg * 2.54 / 100) : 0;

  const V_aire = Vt;
  const Q_aire = DpropPulg > 0 ? 1000 * V_aire * (17 / 24) * (Math.PI / 4) * Math.pow(DpropPulg * 2.54 / 100, 2) : 0;
  const fDarcy = bajFDarcy;
  const Lbajante = bajLong;

  const D_vent_calc_pulg_raw = Lbajante > 0 && Q_aire > 0 ? Math.pow((Lbajante * fDarcy * Q_aire * Q_aire) / 3.25, 1 / 5) : 0;
  const D_vent_calc_mm = D_vent_calc_pulg_raw * 25.4;
  const D_vent_calc_pulg = D_vent_calc_mm / 25.4;

  const DIAM_VENT = [
    { pulg: 1.5, mm: 42.68 },
    { pulg: 2, mm: 54.48 },
    { pulg: 3, mm: 76.20 },
    { pulg: 4, mm: 107.70 },
    { pulg: 6, mm: 160.04 },
  ];
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
    cumple: chequeoDiam === 'O.K.',
  };
}

// ─── Metodo Racional para Aguas lluvias ───
export function caudalRacional(C, I, A) {
  return (C * I * A) / 360;
}

// ─── Chequeo bajante Aguas lluvias ───
export function calcularBajanteALL(params) {
  const {
    bajante = '',
    area_parcial = 0,
    area_acum = 0,
    intensidad = 100,
    C = 0.0278,
    r = 7 / 24,
    n = maning_SAN,
    pendiente = 0.02,
  } = params;

  const Q_Ls = caudalRacional(C, intensidad, area_parcial);
  const Q_m3s = Q_Ls / 1000;

  const Dcalc_m = diametromaning(Q_m3s, n, pendiente);
  const Dcalc_pulg = Dcalc_m * 1000 / 25.4;
  const Dprop = diametroPropuesto(Dcalc_m * 1000);

  return {
    bajante,
    area_parcial: parseFloat(area_parcial.toFixed(2)),
    area_acum: parseFloat(area_acum.toFixed(2)),
    intensidad,
    C,
    Q_Ls: parseFloat(Q_Ls.toFixed(2)),
    Dcalc_pulg: parseFloat(Dcalc_pulg.toFixed(2)),
    Dprop_nominal: Dprop.nominal,
    Dprop_pulg: Dprop.pulg,
    Dprop_mm: Dprop.mm,
    chequeo: Dcalc_pulg <= Dprop.pulg ? 'O.K.' : 'No Cumple',
  };
}

// ─── Chequeo bajante Aguas lluvias (UI inline formula) ───
export function chequeoBajanteLluvia({ areaAcumulada = 0, intensidad = 0, coeficienteC = 0, R = '', diamPropuesto = 0 }) {
  const Rv = R === '1/4' ? 0.25 : (R === '7/24' ? 7 / 24 : 0);
  const Q = areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
    ? Math.round(areaAcumulada * intensidad * coeficienteC / 100 * 100) / 100
    : 0;
  const dCalc = Q > 0 && Rv > 0
    ? Math.round(Math.pow(Q / (1.754 * Math.pow(Rv, 5 / 3)), 3 / 8) * 100) / 100
    : 0;
  const chequeo = dCalc > 0 && diamPropuesto > 0
    ? (dCalc < diamPropuesto ? 'O.K.' : 'No Cumple')
    : (dCalc > 0 ? 'Sin diseño' : '—');
  return { Q, dCalc, chequeo };
}

// ─── Chequeo canal cubierta Aguas lluvias (UI inline formula) ───
export function chequeoCanalLluvia({ areaAcumulada = 0, intensidad = 0, coeficienteC = 0, manning = 0, pendiente = 0, b = 0, h = 0 }) {
  const Qreal = areaAcumulada > 0 && intensidad > 0 && coeficienteC > 0
    ? Math.round(areaAcumulada * intensidad * coeficienteC / 100 * 100) / 100
    : 0;
  const n = manning || 0.009;
  const S = (pendiente || 0) / 100;
  const b_m = b / 100;
  const h_m = h / 100;
  const Qmax = b_m > 0 && h_m > 0 && n > 0 && S > 0
    ? Math.round(1000 * b_m * h_m / n * Math.sqrt(S) * Math.pow(b_m * h_m / (b_m + 2 * h_m), 2 / 3) * 100) / 100
    : 0;
  const chequeo = Qmax > 0 && Qreal > 0
    ? (Qmax > Qreal ? 'O.K.' : 'No Cumple')
    : (Qreal > 0 ? 'Sin sección' : '—');
  const totalStr = b > 0 || h > 0 ? `${b} x ${h}` : '—';
  return { Qreal, Qmax, chequeo, totalStr };
}

// ─── Chequeo canal cubierta ALL ───
export function calcularCanalALL(params) {
  const {
    sector = '',
    area_parcial = 0,
    area_acum = 0,
    intensidad = 100,
    C = 0.0278,
    n = 0.01,
    pendiente = 0.02,
    b_m = 0.30,
    h_m = 0.40,
    bordeLibre_m = 0.10,
  } = params;

  const Q_real = caudalRacional(C, intensidad, area_acum);
  const Q_real_Ls = Q_real * 1000;

  const h_util = h_m - bordeLibre_m;
  const A = b_m * h_util;
  const P = b_m + 2 * h_util;
  const Rh = A / P;

  const Q_max = (1 / n) * A * Math.pow(Rh, 2 / 3) * Math.pow(pendiente, 0.5);
  const Q_max_Ls = Q_max * 1000;

  return {
    sector,
    area_parcial: parseFloat(area_parcial.toFixed(2)),
    area_acum: parseFloat(area_acum.toFixed(2)),
    intensidad,
    C,
    Q_real_Ls: parseFloat(Q_real_Ls.toFixed(2)),
    n,
    pendiente,
    b_m,
    h_m,
    bordeLibre_m,
    seccion: `${(b_m * 100).toFixed(0)} x ${(h_m * 100).toFixed(0)}`,
    Q_max_Ls: parseFloat(Q_max_Ls.toFixed(2)),
    chequeo: Q_real_Ls <= Q_max_Ls ? 'O.K.' : 'No Cumple',
  };
}