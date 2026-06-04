// ============================================
// calcHidraulica.js - Calculo Red Hidraulica
// Basado en NTC 1500, Hazen-Williams, Hunter
// Casa de Roca No. 97 - Floridablanca, Santander
// ============================================

export const GRAVEDAD = 9.80665;
export const COEF_HAZEN_PVC = 150;
export const COEF_HAZEN_CPVC = 150;
export const COEF_HAZEN_COBRE = 130;

// ─── Tabla de UC por aparato (NTC 1500) ───
export const APARATOS_UC = [
  { id: 'san', nombre: 'Inodoro (tanque)', uc_af: 2.2, uc_ac: 0, ud: 4, pmin: 0.71, pmax: 14.08, sigla: 'Ino' },
  { id: 'lvm', nombre: 'Lavamanos', uc_af: 0.5, uc_ac: 0.5, ud: 2, pmin: 0.51, pmax: 5.63, sigla: 'Lvm' },
  { id: 'duc', nombre: 'Ducha', uc_af: 1.0, uc_ac: 1.0, ud: 2, pmin: 1.02, pmax: 5.63, sigla: 'Duc' },
  { id: 'lvp', nombre: 'Lavaplatos Cocina', uc_af: 1.0, uc_ac: 1.0, ud: 2, pmin: 0.51, pmax: 5.63, sigla: 'Lvp' },
  { id: 'tin', nombre: 'Tina', uc_af: 1.0, uc_ac: 1.0, ud: 2, pmin: 0.51, pmax: 14.08, sigla: 'Tin' },
  { id: 'lvra', nombre: 'Lavadora', uc_af: 1.0, uc_ac: 1.0, ud: 2, pmin: 0.51, pmax: 5.63, sigla: 'Lvra' },
  { id: 'lvro', nombre: 'Lavadero', uc_af: 0.75, uc_ac: 0.75, ud: 2, pmin: 0.51, pmax: 5.63, sigla: 'Lvro' },
  { id: 'nev', nombre: 'Nevera', uc_af: 0.5, uc_ac: 0, ud: 0, pmin: 0.51, pmax: 5.63, sigla: 'Nev' },
];

// ─── Diametros comerciales agua fria PVC (RDE 11/21) ───
export const DIAMETROS_AF = [
  { nominal: '1/2" RDE 9',   pulg: 0.5,    dInt: 16.60, dExt: 12.70,  rde: 9 },
  { nominal: '1/2" RDE 13.5', pulg: 0.5,   dInt: 18.18, dExt: 12.70,  rde: 13.5 },
  { nominal: '3/4" RDE 11',  pulg: 0.75,   dInt: 21.81, dExt: 19.05,  rde: 11 },
  { nominal: '3/4" RDE 21',  pulg: 0.75,   dInt: 23.63, dExt: 19.05,  rde: 21 },
  { nominal: '1" RDE 13.5',  pulg: 1.0,    dInt: 28.48, dExt: 25.40,  rde: 13.5 },
  { nominal: '1" RDE 21',    pulg: 1.0,    dInt: 30.20, dExt: 25.40,  rde: 21 },
  { nominal: '1-1/4" RDE 21', pulg: 1.25,  dInt: 38.14, dExt: 31.75,  rde: 21 },
  { nominal: '1-1/2" RDE 21', pulg: 1.5,   dInt: 43.68, dExt: 38.10,  rde: 21 },
  { nominal: '2" RDE 21',    pulg: 2.0,    dInt: 54.58, dExt: 50.80,  rde: 21 },
  { nominal: '2-1/2" RDE 21', pulg: 2.5,   dInt: 66.07, dExt: 63.50,  rde: 21 },
  { nominal: '3" RDE 21',    pulg: 3.0,    dInt: 80.42, dExt: 76.20,  rde: 21 },
  { nominal: '4" RDE 21',    pulg: 4.0,    dInt: 103.42, dExt: 101.60, rde: 21 },
  { nominal: '6" RDE 21',    pulg: 6.0,    dInt: 152.22, dExt: 152.40, rde: 21 },
];

// ─── Diametros comerciales Agua caliente CPVC ───
export const DIAMETROS_AC = [
  { nominal: '1/2" CPVC RDE 11',   pulg: 0.5,  dInt: 12.40, dExt: 12.70,  rde: 11 },
  { nominal: '3/4" CPVC RDE 11',    pulg: 0.75, dInt: 18.20, dExt: 19.05,  rde: 11 },
  { nominal: '1" CPVC RDE 11',      pulg: 1.0,  dInt: 23.40, dExt: 25.40,  rde: 11 },
  { nominal: '1-1/4" CPVC RDE 11',  pulg: 1.25, dInt: 28.60, dExt: 31.75,  rde: 11 },
  { nominal: '1-1/2" CPVC RDE 11',  pulg: 1.5,  dInt: 33.70, dExt: 38.10,  rde: 11 },
  { nominal: '2" CPVC RDE 11',      pulg: 2.0,  dInt: 44.20, dExt: 50.80,  rde: 11 },
  { nominal: '2" CPVC SCH 80',      pulg: 2.0,  dInt: 49.25, dExt: 50.80,  sch: 80 },
  { nominal: '2-1/2" CPVC SCH 80',  pulg: 2.5,  dInt: 59.00, dExt: 63.50,  sch: 80 },
  { nominal: '3" CPVC SCH 80',      pulg: 3.0,  dInt: 73.66, dExt: 76.20,  sch: 80 },
];

// ─── Contadores ───
export const CONTADORES = [
  { diaPulg: 0.5, qn_lps: 0.84 },
  { diaPulg: 0.5, qn_lps: 0.92 },
  { diaPulg: 0.75, qn_lps: 1.40 },
  { diaPulg: 0.75, qn_lps: 1.58 },
  { diaPulg: 1.0, qn_lps: 1.96 },
  { diaPulg: 1.0, qn_lps: 2.70 },
  { diaPulg: 1.0, qn_lps: 2.80 },
  { diaPulg: 1.5, qn_lps: 5.60 },
  { diaPulg: 2.0, qn_lps: 8.40 },
];

// ─── Longitudes equivalentes de accesorios (PVC C=150) ───
export const LE_ACCESORIOS = [
  { id: 'codo90', nombre: 'Codo 90°', le: [0.36, 0.49, 0.62, 0.87, 1.12, 1.62, 2.12] },
  { id: 'teeLat', nombre: 'Tee salida lateral', le: [0.20, 0.29, 0.38, 0.55, 0.73, 1.08, 1.43] },
  { id: 'teeBiLat', nombre: 'Tee salida bilateral', le: [0.76, 1.02, 1.28, 1.79, 2.31, 3.34, 4.37] },
  { id: 'teeDir', nombre: 'Tee paso directo', le: [0.76, 1.02, 1.28, 1.79, 2.31, 3.34, 4.37] },
  { id: 'valvComp', nombre: 'Valvula de compuerta', le: [0.08, 0.12, 0.13, 0.19, 0.24, 0.36, 0.47] },
  { id: 'valvGlobo', nombre: 'Valvula de globo', le: [3.03, 4.02, 5.06, 7.18, 9.27, 13.78, 18.29] },
  { id: 'valvCierre', nombre: 'Valvula de cierre rapido', le: [3.12, 4.52, 5.92, 8.71, 11.50, 17.09, 22.67] },
  { id: 'reduc', nombre: 'Reducciones (general)', le: [0.06, 0.08, 0.11, 0.16, 0.21, 0.30, 0.40] },
];

const DIAM_LE = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];

export function getLe(accesorioId, diaPulg) {
  const acc = LE_ACCESORIOS.find(a => a.id === accesorioId);
  if (!acc) return 0;
  const idx = DIAM_LE.findIndex(d => d >= diaPulg);
  const i = idx >= 0 ? Math.min(idx, acc.le.length - 1) : acc.le.length - 1;
  return acc.le[i];
}

// ─── Factor de simultaneidad (Hunter modificado) ───
export function factorSimultaneidad(numSalidas) {
  if (numSalidas <= 1) return 1;
  return 1 / Math.sqrt(numSalidas - 1);
}

// ─── Caudal de Hunter (Rodriguez Diaz) ───
export function caudalHunterLPS(UC, K) {
  let Quc;
  if (UC < 240) {
    Quc = K * 0.1163 * Math.pow(UC, 0.6875);
  } else {
    Quc = K * 0.074 * Math.pow(UC, 0.7504);
  }
  return Quc;
}

// ─── Seleccion de diametro comercial ───
export function seleccionarDiametroAF(Q_m3s, C, Vmax) {
  C = C || COEF_HAZEN_PVC;
  Vmax = Vmax || 2.5;
  for (const d of DIAMETROS_AF) {
    const D_m = d.dInt / 1000;
    const V = (4 * Q_m3s) / (Math.PI * Math.pow(D_m, 2));
    if (V <= Vmax) {
      return { ...d, V: parseFloat(V.toFixed(4)) };
    }
  }
  return { ...DIAMETROS_AF[DIAMETROS_AF.length - 1], V: parseFloat((4 * Q_m3s / (Math.PI * Math.pow(DIAMETROS_AF[DIAMETROS_AF.length - 1].dInt / 1000, 2))).toFixed(4)) };
}

export function seleccionarDiametroAC(Q_m3s, C, Vmax) {
  C = C || COEF_HAZEN_CPVC;
  Vmax = Vmax || 2.5;
  for (const d of DIAMETROS_AC) {
    const D_m = d.dInt / 1000;
    const V = (4 * Q_m3s) / (Math.PI * Math.pow(D_m, 2));
    if (V <= Vmax) {
      return { ...d, V: parseFloat(V.toFixed(4)) };
    }
  }
  return { ...DIAMETROS_AC[DIAMETROS_AC.length - 1], V: parseFloat((4 * Q_m3s / (Math.PI * Math.pow(DIAMETROS_AC[DIAMETROS_AC.length - 1].dInt / 1000, 2))).toFixed(4)) };
}

// ─── Velocidad real ───
export function velocidadReal(Q_m3s, D_m) {
  if (D_m <= 0 || Q_m3s <= 0) return 0;
  return (4 * Q_m3s) / (Math.PI * D_m * D_m);
}

// ─── Perdida por friccion Hazen-Williams ───
export function perdidaHazenWilliams(Q_m3s, L_m, D_m, C) {
  const coef = C || COEF_HAZEN_PVC;
  if (Q_m3s <= 0 || L_m <= 0 || D_m <= 0) return 0;
  return (10.67 * L_m * Math.pow(Q_m3s, 1.852)) / (Math.pow(coef, 1.852) * Math.pow(D_m, 4.87));
}

// ─── Presion en nudo ───
export function presionNudo(presionInicial_mca, deltaZ_m, hfTotal_m) {
  return presionInicial_mca + deltaZ_m - hfTotal_m;
}

// ─── Verificaciones ───
export function verificarVelocidad(V) {
  const Vmin = 0.60;
  const Vmax = 3.00;
  return {
    cumple: V >= Vmin && V <= Vmax,
    mensaje: V < Vmin ? 'V baja - sedimentacion' : V > Vmax ? 'V alta - golpe de ariete' : 'OK',
    Vmin,
    Vmax,
  };
}

export function verificarPresion(Pnudo, PminAparato) {
  const Pmin = PminAparato || 0.51;
  return {
    cumple: Pnudo >= Pmin,
    mensaje: Pnudo >= Pmin ? `OK (>= ${Pmin} mca)` : `INSUFICIENTE (< ${Pmin} mca)`,
  };
}

// ─── Calculo completo de un tramo hidraulico (AF o AC) ───
export function calcularTramoHidraulico(params) {
  const {
    ramal = '',
    nudoIni = '',
    nudoFin = '',
    piso = 1,
    UC_propias = 0,
    UC_otros = 0,
    numSalidas = 1,
    Lh_m = 5.0,
    Lv_m = 0,
    nudoIniAlt = '',
    nudoFinAlt = '',
    presionRed_mca = 20.0,
    material = 'PVC',
    tipo = 'AF',
  } = params;

  const C = material === 'CPVC' ? COEF_HAZEN_CPVC : COEF_HAZEN_PVC;
  const diametros = tipo === 'AC' ? DIAMETROS_AC : DIAMETROS_AF;
  const selDiam = tipo === 'AC'
    ? seleccionarDiametroAC
    : seleccionarDiametroAF;

  const UC_acumulado = parseFloat(UC_propias) + parseFloat(UC_otros);
  const K = factorSimultaneidad(parseInt(numSalidas) || 1);
  const Q_Ls = caudalHunterLPS(UC_acumulado, K);
  const Q_m3s = Q_Ls / 1000;

  const diam = selDiam(Q_m3s, C);
  const D_int_mm = diam.dInt;
  const D_int_m = D_int_mm / 1000;

  const V_ms = velocidadReal(Q_m3s, D_int_m);
  const V_mms = V_ms * 1000;

  let Le_m = 0;

  const L_total = (Lh_m || 0) + (Lv_m || 0) + Le_m;

  const hf = perdidaHazenWilliams(Q_m3s, L_total || 0.1, D_int_m, C);

  const deltaZ = parseFloat(Lv_m) || 0;
  const P_ini = presionRed_mca;
  const P_fin = presionNudo(P_ini, deltaZ, hf);

  const verifV = verificarVelocidad(V_ms);
  const verifP = verificarPresion(P_fin);

  const desc_otros = params.desc_otros || "";

  return {
    ramal,
    nudoIni,
    nudoFin,
    piso,
    desc_otros,
    UC_propias: parseFloat(UC_propias) || 0,
    UC_otros: parseFloat(UC_otros) || 0,
    UC_acumulado,
    numSalidas: parseInt(numSalidas) || 1,
    K: parseFloat(K.toFixed(4)),
    Q_Ls: parseFloat(Q_Ls.toFixed(4)),
    diamNominal: diam.nominal,
    D_int_mm,
    D_ext_mm: diam.dExt,
    pulg: diam.pulg,
    material,
    C,
    V_ms: parseFloat(V_ms.toFixed(4)),
    V_mms: parseFloat(V_mms.toFixed(1)),
    Lh_m: parseFloat(Lh_m) || 0,
    Lv_m: parseFloat(Lv_m) || 0,
    Le_m: parseFloat(Le_m.toFixed(2)),
    L_total: parseFloat(L_total.toFixed(2)),
    hf_m: parseFloat(hf.toFixed(4)),
    deltaZ_m: parseFloat(deltaZ.toFixed(2)),
    P_ini_mca: parseFloat(P_ini.toFixed(2)),
    P_fin_mca: parseFloat(P_fin.toFixed(2)),
    verifV,
    verifP,
    cumple: verifV.cumple && verifP.cumple,
  };
}

// ─── Caudal total de consumo (Calculo TR) ───
export function calcularConsumoTR(habitantes, dotacion, areaPiscina, areaVerdes, areaOtros) {
  const q_fijos = habitantes * dotacion;
  const q_flotantes = 0;
  const q_piscina = (areaPiscina || 0) * 10;
  const q_verdes = (areaVerdes || 0) * 2;
  const q_otros = areaOtros || 100;
  const total_diario = q_fijos + q_flotantes + q_piscina + q_verdes + q_otros;
  const Q_lps = total_diario / 86400;

  return {
    habitantes,
    dotacion,
    q_fijos,
    q_flotantes,
    q_piscina,
    q_verdes,
    q_otros,
    total_diario,
    Q_lps: parseFloat(Q_lps.toFixed(6)),
  };
}