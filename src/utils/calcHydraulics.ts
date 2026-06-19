

export const COEF_HAZEN: number = 150;

export interface DiametroComercialAF {
  nominal: string;
  pulg: number;
  dInt: number;
  dExt: number;
  rde?: number;
  sch?: number;
  V?: number;
}

// ─── Diametros comerciales agua fria PVC (RDE 11/21) ───
export const DIAMETROS_AF: DiametroComercialAF[] = [
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
export const DIAMETROS_AC: DiametroComercialAF[] = [
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
export const CONTADORES: { diaPulg: number; qn_lps: number }[] = [
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

interface AccesorioLe {
  id: string;
  nombre: string;
  le: number[];
}

// ─── Longitudes equivalentes de accesorios (PVC C=150) ───
// NOTE: See also LE_ACC_DEF in accesoriosUtils.ts for formula-based equivalent lengths
export const LE_ACCESORIOS: AccesorioLe[] = [
  { id: 'codo90', nombre: 'Codo 90°', le: [0.36, 0.49, 0.62, 0.87, 1.12, 1.62, 2.12] },
  { id: 'teeLat', nombre: 'Tee salida lateral', le: [0.20, 0.29, 0.38, 0.55, 0.73, 1.08, 1.43] },
  { id: 'teeBiLat', nombre: 'Tee salida bilateral', le: [0.76, 1.02, 1.28, 1.79, 2.31, 3.34, 4.37] },
  { id: 'teeDir', nombre: 'Tee paso directo', le: [0.76, 1.02, 1.28, 1.79, 2.31, 3.34, 4.37] },
  { id: 'valvComp', nombre: 'Valvula de compuerta', le: [0.08, 0.12, 0.13, 0.19, 0.24, 0.36, 0.47] },
  { id: 'valvGlobo', nombre: 'Valvula de globo', le: [3.03, 4.02, 5.06, 7.18, 9.27, 13.78, 18.29] },
  { id: 'valvCierre', nombre: 'Valvula de cierre rapido', le: [3.12, 4.52, 5.92, 8.71, 11.50, 17.09, 22.67] },
  { id: 'reduc', nombre: 'Reducciones (general)', le: [0.06, 0.08, 0.11, 0.16, 0.21, 0.30, 0.40] },
];

const DIAM_LE: number[] = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];

export function getLe(accesorioId: string, diaPulg: number): number {
  const acc = LE_ACCESORIOS.find(a => a.id === accesorioId);
  if (!acc) return 0;
  const idx = DIAM_LE.findIndex(d => d >= diaPulg);
  const i = idx >= 0 ? Math.min(idx, acc.le.length - 1) : acc.le.length - 1;
  return acc.le[i];
}

// ─── Velocidad real ───
export function realVelocity(Q_m3s: number, D_m: number): number {
  if (D_m <= 0 || Q_m3s <= 0) return 0;
  return (4 * Q_m3s) / (Math.PI * D_m * D_m);
}

// ─── Perdida por friccion Hazen-Williams ───
export function hazenWilliamsLoss(Q_m3s: number, L_m: number, D_m: number, C?: number): number {
  const coef = C || COEF_HAZEN;
  if (Q_m3s <= 0 || L_m <= 0 || D_m <= 0) return 0;
  return (10.67 * L_m * Math.pow(Q_m3s, 1.852)) / (Math.pow(coef, 1.852) * Math.pow(D_m, 4.87));
}

// ─── Presion en nudo ───
export function nodePressure(presionInicial_mca: number, deltaZ_m: number, hfTotal_m: number): number {
  return presionInicial_mca + deltaZ_m - hfTotal_m;
}

// ─── Verificaciones ───
export function checkVelocity(V: number): { cumple: boolean; mensaje: string; Vmin: number; Vmax: number } {
  const Vmin = 0.60;
  const Vmax = 3.00;
  return {
    cumple: V >= Vmin && V <= Vmax,
    mensaje: V < Vmin ? 'V baja - sedimentacion' : V > Vmax ? 'V alta - golpe de ariete' : 'OK',
    Vmin,
    Vmax,
  };
}

export function checkPressure(Pnudo: number, PminAparato?: number): { cumple: boolean; mensaje: string } {
  const Pmin = PminAparato || 0.51;
  return {
    cumple: Pnudo >= Pmin,
    mensaje: Pnudo >= Pmin ? `OK (>= ${Pmin} mca)` : `INSUFICIENTE (< ${Pmin} mca)`,
  };
}

