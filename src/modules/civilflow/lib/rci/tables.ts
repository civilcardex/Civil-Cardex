/**
 * Catálogos del motor RCI (Red Contra Incendio): tablas de NFPA (National Fire Protection
 * Association) que el cálculo solo lee, nunca escribe. Ej: HZ["Riesgo leve"].d = 0.10 gpm/ft²
 * es la densidad de diseño del riesgo leve.
 */

/** Una clasificación de riesgo de NFPA 13: densidad (gpm/ft²), área (ft²), coberturas (ft²),
 *  separaciones máximas S/L (m), mangueras (gpm), duración mín/máx (min) y si admite QR. */
export interface HzEntry {
  d: number;
  a: number;
  cnc: number;
  cco: number;
  s: number;
  l: number;
  hose: number;
  dmin: number;
  dmax: number;
  qr: boolean;
}

/** Riesgos de NFPA 13 (Tabla 19.2.3.1.1 y cap. 10): la llave es la que llega en st.clas.riesgo. */
export const HZ: Record<string, HzEntry> = {
  'Riesgo leve': {
    d: 0.1,
    a: 1500,
    cnc: 225,
    cco: 168,
    s: 4.6,
    l: 4.6,
    hose: 100,
    dmin: 30,
    dmax: 30,
    qr: true,
  },
  'Riesgo ordinario G1': {
    d: 0.15,
    a: 1500,
    cnc: 130,
    cco: 130,
    s: 4.6,
    l: 4.6,
    hose: 250,
    dmin: 60,
    dmax: 90,
    qr: true,
  },
  'Riesgo ordinario G2': {
    d: 0.2,
    a: 1500,
    cnc: 130,
    cco: 130,
    s: 4.6,
    l: 4.6,
    hose: 250,
    dmin: 60,
    dmax: 90,
    qr: true,
  },
  'Riesgo extra G1': {
    d: 0.3,
    a: 2500,
    cnc: 100,
    cco: 100,
    s: 3.7,
    l: 3.7,
    hose: 500,
    dmin: 90,
    dmax: 120,
    qr: false,
  },
  'Riesgo extra G2': {
    d: 0.4,
    a: 2500,
    cnc: 100,
    cco: 100,
    s: 3.7,
    l: 3.7,
    hose: 500,
    dmin: 90,
    dmax: 120,
    qr: false,
  },
};

/** Diámetros nominales (pulgadas, como texto comercial: '2 1/2"') en orden creciente. */
export const NOM: string[] = [
  '1/2"',
  '3/4"',
  '1"',
  '1 1/4"',
  '1 1/2"',
  '2"',
  '2 1/2"',
  '3"',
  '3 1/2"',
  '4"',
  '5"',
  '6"',
  '8"',
  '10"',
  '12"',
];
/** Índice de cada nominal en NOM (NOM.indexOf del HTML, resuelto una vez). */
const NOM_IDX = new Map<string, number>(NOM.map((n, i) => [n, i]));
export const INCH: number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12];
/** Diámetro exterior en mm para cada nominal (acero). */
export const OD: number[] = [
  21.3, 26.7, 33.4, 42.2, 48.3, 60.3, 73.0, 88.9, 101.6, 114.3, 141.3, 168.3, 219.1, 273.0, 323.9,
];
/** Espesor de pared en mm, cédula (Schedule) 40. */
export const W40: number[] = [
  2.77, 2.87, 3.38, 3.56, 3.68, 3.91, 5.16, 5.49, 5.74, 6.02, 6.55, 7.11, 8.18, 9.27, 10.31,
];
/** Espesor de pared en mm, cédula 10. */
export const W10: number[] = [
  2.11, 2.11, 2.77, 2.77, 2.77, 2.77, 3.05, 3.05, 3.05, 3.05, 3.4, 3.4, 3.76, 4.19, 4.57,
];

/** Una tubería comercial: diámetro nominal (in), exterior y espesor (mm) e interior id (mm). */
export interface PipeSpec {
  inch: number;
  od: number;
  e: number;
  id: number;
}

/** PIPES[material][diámetro nominal] -> geometría real. Ej: PIPES["Acero SCH 10"]['4"'].id = 108.2 mm. */
export const PIPES: Record<string, Record<string, PipeSpec>> = {
  'Acero SCH 40': {},
  'Acero SCH 10': {},
  'CPVC SDR 13,5': {},
  'PVC C900 RDE 14': {},
  'PVC C900 RDE 18': {},
};
NOM.forEach((n, i) => {
  PIPES['Acero SCH 40'][n] = { inch: INCH[i], od: OD[i], e: W40[i], id: OD[i] - 2 * W40[i] };
  PIPES['Acero SCH 10'][n] = { inch: INCH[i], od: OD[i], e: W10[i], id: OD[i] - 2 * W10[i] };
});
const C900_ROWS: [string, number, number, number][] = [
  ['4"', 121.9, 8.71, 6.78],
  ['6"', 175.3, 12.52, 9.73],
  ['8"', 229.9, 16.41, 12.78],
  ['10"', 281.9, 20.14, 15.67],
  ['12"', 335.3, 23.95, 18.62],
];
C900_ROWS.forEach(([n, od, e14, e18]) => {
  const inch = INCH[NOM_IDX.get(n)!];
  PIPES['PVC C900 RDE 14'][n] = { inch, od, e: e14, id: od - 2 * e14 };
  PIPES['PVC C900 RDE 18'][n] = { inch, od, e: e18, id: od - 2 * e18 };
});
/* CPVC listado para rociadores (ASTM F442, SDR 13,5): Ø exterior y espesor en mm */
const CPVC_ROWS: [string, number, number][] = [
  ['3/4"', 26.67, 1.98],
  ['1"', 33.4, 2.46],
  ['1 1/4"', 42.16, 3.12],
  ['1 1/2"', 48.26, 3.58],
  ['2"', 60.33, 4.47],
  ['2 1/2"', 73.03, 5.41],
  ['3"', 88.9, 6.58],
];
CPVC_ROWS.forEach(([n, od, e]) => {
  PIPES['CPVC SDR 13,5'][n] = { inch: INCH[NOM_IDX.get(n)!], od, e, id: od - 2 * e };
});

/** Longitudes equivalentes NFPA 13 (m), acero SCH 40 con C=120: [45°, 90° estándar, 90° radio
 *  largo, tee con giro, mariposa, compuerta, retención]. Ej: LEQ['4"'][3] = 6.10 m por una tee. */
export const LEQ: Record<string, number[]> = {
  '1/2"': [0, 0.3, 0.15, 0.91, 0, 0, 0],
  '3/4"': [0.3, 0.61, 0.3, 1.22, 0, 0, 0],
  '1"': [0.3, 0.61, 0.61, 1.52, 0, 0, 1.52],
  '1 1/4"': [0.3, 0.91, 0.61, 1.83, 0, 0, 2.13],
  '1 1/2"': [0.61, 1.22, 0.61, 2.44, 0, 0, 2.74],
  '2"': [0.61, 1.52, 0.91, 3.05, 1.83, 0.3, 3.35],
  '2 1/2"': [0.91, 1.83, 1.22, 3.66, 2.13, 0.3, 4.27],
  '3"': [0.91, 2.13, 1.52, 4.57, 3.05, 0.3, 4.88],
  '3 1/2"': [0.91, 2.44, 1.52, 5.18, 0, 0.3, 5.79],
  '4"': [1.22, 3.05, 1.83, 6.1, 3.66, 0.61, 6.71],
  '5"': [1.52, 3.66, 2.44, 7.62, 2.74, 0.61, 8.23],
  '6"': [2.13, 4.27, 2.74, 9.14, 3.05, 0.91, 9.75],
  '8"': [2.74, 5.49, 3.96, 10.67, 3.66, 1.22, 13.72],
  '10"': [3.35, 6.71, 4.88, 15.24, 5.79, 1.52, 16.76],
  '12"': [3.96, 8.23, 5.49, 18.29, 6.4, 1.83, 19.81],
};
/** Columnas de accesorios estándar de una fila de tubería, en el orden de LEQ. */
export const FIT = ['c45', 'c90', 'clr', 'tee', 'mar', 'comp', 'ret'];

/** Factor de Hazen-Williams relativo a C=120. Ej: cfOf(100) = 0.713 (un tubo más rugoso pierde menos longitud equivalente). */
export const CF: Record<number, number> = { 100: 0.713, 120: 1.0, 130: 1.16, 140: 1.33, 150: 1.51 };

/** Coeficiente C de Hazen-Williams por defecto: NFPA 13 cap. 28 (acero 120 húmedo / 100 seco;
 *  plástico listado 150), o el que adopte el diseñador en st.cmat. */
export const CDEF = (mat?: string, sistema?: string): number =>
  String(mat || '').startsWith('Acero') ? (sistema === 'Seco' ? 100 : 120) : 150;

/** Factor de corrección por rugosidad para longitudes equivalentes. Ej: cfOf(150) = 1.51. */
export const cfOf = (C: number): number => CF[C] || Math.pow(C / 120, 1.85);

/** Curvas de vapor/agua (PV): [temperatura °C, presión de vapor psi, densidad kg/m³] para interpolar. */
export const PV: number[][] = [
  [0, 0.06, 999.9],
  [4, 0.08, 1000.0],
  [10, 0.12, 999.7],
  [20, 0.24, 998.2],
  [30, 0.43, 995.7],
  [40, 0.75, 992.2],
  [50, 1.26, 988.1],
  [60, 2.03, 983.2],
  [80, 4.83, 971.8],
  [100, 10.33, 958.4],
];

/** NFPA 20 por caudal nominal (gpm): [Q, succión in, descarga in, válv. alivio in, desc. alivio in,
 *  medidor in, válvulas de manguera 2½" (unidades), alimentación cabezal in]. */
export const P20: number[][] = [
  [25, 1, 1, 0.75, 1, 1.25, 1, 1],
  [50, 1.5, 1.25, 1.25, 1.5, 2, 1, 1.5],
  [100, 2, 2, 1.5, 2, 2.5, 1, 2.5],
  [150, 2.5, 2.5, 2, 2.5, 3, 1, 2.5],
  [200, 3, 3, 2, 2.5, 3, 1, 2.5],
  [250, 3.5, 3, 2, 2.5, 3.5, 1, 3],
  [300, 4, 4, 2.5, 3.5, 3.5, 1, 3],
  [400, 4, 4, 3, 5, 4, 2, 4],
  [450, 5, 5, 3, 5, 4, 2, 4],
  [500, 5, 5, 3, 5, 5, 2, 4],
  [750, 6, 6, 4, 6, 5, 3, 6],
  [1000, 8, 6, 4, 8, 6, 4, 6],
  [1250, 8, 8, 6, 8, 6, 6, 8],
  [1500, 8, 8, 6, 8, 8, 6, 8],
  [2000, 10, 10, 6, 10, 8, 6, 8],
  [2500, 10, 10, 6, 10, 8, 8, 10],
];

/** Motores comerciales disponibles (HP). Ej: 66.8 HP requeridos -> MOT.find(m => m >= 66.8) = 75. */
export const MOT: number[] = [
  1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 350, 400,
];

/** psi (libras por pulgada cuadrada) por metro de columna de agua: 0.433 psi/ft × 3.28084 ft/m. */
export const PSI_M = 0.433 * 3.28084;
/** Un gpm (galón por minuto) en m³/s. */
export const GPM_M3S = 0.0000630902;

/** Un accesorio especial del catálogo del proyecto. Modos: "LD" (longitud equivalente = L/D ×
 *  diámetro interior), "Leq" (metros de tubería equivalente) o "dp" (pérdida en psi a un caudal
 *  de referencia, escalada con Q^1,85). */
export interface EspAcc {
  cod: string;
  nombre: string;
  modo: string;
  valor: number | string;
  qref: number | string;
}

/** Catálogo de accesorios especiales por defecto (válvula de alarma, detector de flujo…). */
export const ESP_DEF = (): EspAcc[] => [
  { cod: 'VA', nombre: 'Válvula de alarma (húmeda)', modo: 'LD', valor: 50, qref: '' },
  { cod: 'DF', nombre: 'Detector de flujo tipo paleta', modo: 'LD', valor: 10, qref: '' },
  { cod: 'CW', nombre: 'Cheque tipo wafer / doble placa', modo: 'LD', valor: 100, qref: '' },
  { cod: 'VG', nombre: 'Válvula de globo', modo: 'LD', valor: 340, qref: '' },
  { cod: 'VAN', nombre: 'Válvula angular (gabinete)', modo: 'LD', valor: 150, qref: '' },
  { cod: 'FY', nombre: 'Filtro en Y', modo: 'LD', valor: 150, qref: '' },
];
