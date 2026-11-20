/** MOTOR EPC (ped. 2026-11-19): port EXACTO de calcular() del HTML de referencia
 *  (CIVILFLOW_EPC_Modulo) a TypeScript puro — sin React, sin DOM. La UI (ep/) solo lo
 *  pinta. Paridad verificada contra la prueba de aceptación de la HU (docs del 10/11/2026):
 *  caso red → P mín 53,23 · arranque/objetivo/parada 56,0/58,5/61,0 · Hf_otros 1,43 ·
 *  HMT 49,93 · hcero 51,0 · NPSH 19,82 · 8,11 HP · tanque 449 L · PSV 67,1 · DN 150/100 ·
 *  0 alertas; variante cisterna → HMT 61,85 · NPSH 7,90 · 12,5 HP · 2×3,80×1,90 m · H 5,25 ·
 *  75,7 m³. Las diferencias vs el motor viejo (epCalcs.ts): control con variador real
 *  (arranque redondeado, setpoint, banda, Boyle CON precarga), Hf del cuarto método K,
 *  NPSH de red con Patm por altitud y Pv Antoine, 6 materiales con presión admisible y PSV,
 *  aparato crítico con tabla de 3 niveles, cisterna EPC completa (usos, compartimentos,
 *  sumergencia ANSI/HI 9.8, reposición). TODO en m.c.a. — la unidad del proyecto es solo
 *  presentación (regla de la HU). */
import { apLim } from './epAparatos.ts';

// ── Materiales del cuarto de bombas: dInt por DN (12, hasta 300) + presión admisible ──
const PSI = 0.70307; // psi → m.c.a.
const S40: Array<[number, number]> = [
  [20, 20.93],
  [25, 26.64],
  [32, 35.05],
  [40, 40.89],
  [50, 52.5],
  [65, 62.71],
  [80, 77.93],
  [100, 102.26],
  [150, 154.05],
  [200, 202.72],
  [250, 254.51],
  [300, 303.23],
];
const PA_PVC40 = [480, 450, 370, 330, 280, 300, 260, 220, 180, 160, 140, 130];

/** Material de tubería del cuarto de bombas: velocidades máximas (vs suction/vi impulsión, m/s), referencia normativa y diámetros comerciales con su presión admisible. Ej: EP_MATS.pvc40.d trae los DN Sch 40. */
export interface MatEpc {
  clave: string;
  corto: string;
  nombre: string;
  vs: number;
  vi: number;
  ref: string;
  /** [dn, dInt, presión admisible m.c.a. (null = según la unión)] */
  d: Array<[number, number, number | null]>;
}

export const EP_MATS: Record<string, MatEpc> = {
  pvc40: {
    clave: 'pvc40',
    corto: 'PVC Sch 40',
    nombre: 'PVC Sch 40 (ASTM D1785)',
    vs: 1.2,
    vi: 2.0,
    ref: 'ASTM D1785, 23 °C',
    d: S40.map((x, i) => [x[0], x[1], PA_PVC40[i] * PSI] as [number, number, number]),
  },
  pvc80: {
    clave: 'pvc80',
    corto: 'PVC Sch 80',
    nombre: 'PVC Sch 80 (ASTM D1785)',
    vs: 1.2,
    vi: 2.0,
    ref: 'ASTM D1785, 23 °C',
    d: [
      [20, 18.85],
      [25, 24.31],
      [32, 32.46],
      [40, 38.1],
      [50, 49.25],
      [65, 59.0],
      [80, 73.66],
      [100, 97.18],
      [150, 146.33],
      [200, 193.68],
      [250, 242.93],
      [300, 288.95],
    ].map(
      (x, i) =>
        [x[0], x[1], [690, 630, 520, 470, 400, 420, 370, 320, 280, 250, 230, 230][i] * PSI] as [
          number,
          number,
          number,
        ],
    ),
  },
  ac40: {
    clave: 'ac40',
    corto: 'Acero Sch 40',
    nombre: 'Acero al carbono Sch 40 (ASTM A53/A106)',
    vs: 1.2,
    vi: 2.5,
    ref: 'limitada por bridas y accesorios clase 150 (≈ 19,6 bar)',
    d: S40.map((x) => [x[0], x[1], 200] as [number, number, number]),
  },
  inox: {
    clave: 'inox',
    corto: 'Inox 10S',
    nombre: 'Acero inoxidable Sch 10S (ASTM A312)',
    vs: 1.2,
    vi: 2.5,
    ref: 'limitada por bridas y accesorios clase 150 (≈ 19,6 bar)',
    d: [
      [20, 22.45],
      [25, 27.86],
      [32, 36.63],
      [40, 42.72],
      [50, 54.79],
      [65, 66.93],
      [80, 82.8],
      [100, 108.2],
      [150, 161.47],
      [200, 211.56],
      [250, 264.67],
      [300, 314.71],
    ].map((x) => [x[0], x[1], 200] as [number, number, number]),
  },
  cuL: {
    clave: 'cuL',
    corto: 'Cobre L',
    nombre: 'Cobre tipo L (ASTM B88)',
    vs: 1.2,
    vi: 2.0,
    ref: 'según el tipo de unión (soldadura blanda o fuerte)',
    d: [
      [20, 19.94],
      [25, 26.04],
      [32, 32.13],
      [40, 38.23],
      [50, 50.42],
      [65, 62.61],
      [80, 74.8],
      [100, 99.19],
      [150, 148.46],
      [200, 196.22],
      [250, 244.48],
      [300, 293.75],
    ].map((x) => [x[0], x[1], null] as [number, number, number | null]),
  },
  pe11: {
    clave: 'pe11',
    corto: 'PEAD SDR 11',
    nombre: 'PEAD PE100 SDR 11 · PN 16 (ISO 4427, DN = diámetro exterior)',
    vs: 1.2,
    vi: 2.0,
    ref: 'PN 16 a 20 °C',
    d: [25, 32, 40, 50, 63, 75, 90, 110, 160, 200, 250, 315].map(
      (de) => [de, +((de * 9) / 11).toFixed(2), 163] as [number, number, number | null],
    ),
  },
};

/** Potencias comerciales IEC/NEMA en HP con kW (port de POT_COM_HP/HP2KW del HTML — serie
 *  más completa que NEMA_HP del motor viejo: 0,25…150; NEMA_HP de calcs.ts solo vive para
 *  utils/equipmentRows.ts). */
export const EP_POT_COM_HP = [
  0.25, 0.33, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 5.5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50,
  60, 75, 100, 125, 150,
];
/** Conversión HP (potencia comercial NEMA) → kW eléctricos aproximados. Ej: EP_HP2KW[7.5] → 5.5 kW. */
export const EP_HP2KW: Record<number, number> = {
  0.25: 0.18,
  0.33: 0.25,
  0.5: 0.37,
  0.75: 0.55,
  1: 0.75,
  1.5: 1.1,
  2: 1.5,
  3: 2.2,
  4: 3,
  5: 3.7,
  5.5: 4,
  7.5: 5.5,
  10: 7.5,
  12.5: 9.2,
  15: 11,
  20: 15,
  25: 18.5,
  30: 22,
  40: 30,
  50: 37,
  60: 45,
  75: 55,
  100: 75,
  125: 90,
  150: 110,
};

/** Categorías de uso de la cisterna: [nombre, unidad, dotación referencial L/unidad·d]. */
export const EP_USO_CAT: Array<[string, string, number]> = [
  ['Vivienda', 'hab', 150],
  ['Oficinas', 'm²', 6],
  ['Comercio / locales', 'm²', 6],
  ['Restaurante / cafetería', 'm²', 40],
  ['Hotel / hospedaje', 'huésped', 300],
  ['Educación', 'alumno', 50],
  ['Salud / consultorio', 'consult.', 500],
  ['Gimnasio / club', 'usuario', 60],
  ['Piscina (reposición)', 'm²', 10],
  ['Riego zonas verdes', 'm²', 2],
  ['Parqueadero cubierto', 'm²', 2],
  ['Otro consumo fijo', 'L/d', 1],
];

/** Una fila de la tabla de usos de la cisterna: k = índice en EP_USO_CAT, c = cantidad y
 *  d = dotación editable (L/unidad·d). Ej: {k:0, c:192, d:150} = 192 hab × 150 L/d. */
export interface EpcUso {
  k: number;
  c: number;
  d: number;
}

/** Inputs del motor — todo en m.c.a./m/L/s SIEMPRE (la unidad del proyecto convierte en la UI). */
export interface EpcIn {
  modo: 'red' | 'cis';
  qac: number;
  hfac: number;
  pred: number;
  pmin: number;
  apcrit: string;
  apsel: number; // -1 = otro
  pmax: number;
  zbomba: number;
  ztop: number;
  poffmax: number | null;
  altitud: number;
  temp: number;
  margen: number;
  dif: number;
  qminp: number;
  ciclos: number;
  etab: number;
  etam: number;
  fs: number;
  vsuc: number;
  vimp: number;
  nt: number;
  nr: number;
  mat: string;
  hfauto: boolean;
  hfotros: number;
  // cisterna
  zcis: number;
  hfcis: number;
  diasauto: number;
  vincendio: number;
  usos: EpcUso[];
  cisHu: number;
  cisHs: number;
  cisBl: number;
  cisQa: number | null;
  cisHsum: number;
  cisDc: boolean;
  // potencia comercial elegida (0 = auto)
  potSel: number;
}

/** Alerta del cálculo en 3 niveles: 'er' bloquea la emisión, 'wa' advierte y 'in' es una
 *  recomendación PARA LA RED (el equipo cumple). h = cómo resolverlo (lista numerada);
 *  go = campo a enfocar («Ir al dato»); fix = arreglo directo con un clic. */
export interface EpcAlerta {
  tipo: 'er' | 'wa' | 'in';
  msg: string;
  h: string[];
  /** Campo al que saltar ('Ir al dato'). */
  go?: string;
  /** Arreglo directo: valor sugerido para el campo. */
  fix?: { go: string; val: number; t: string };
}

/** Diámetro nominal elegido para un ramal: dn comercial, di interior (mm), pa presión
 *  admisible del material (null = según la unión), vreal velocidad resultante (m/s);
 *  fuera = true si el caudal supera la tabla completa. Ej: {dn:150, di:154.05, pa:98.4, vreal:0.69}. */
export interface EpcDn {
  dn: number;
  di: number;
  pa: number | null;
  vreal: number;
  fuera?: boolean;
}

/** Geometría y operación de la cisterna calculadas: alturas por banda (hs/hrci/subS/hu/hbl),
 *  dimensiones internas (nC compartimentos de lC×bC), sumergencia ANSI/HI 9.8 (dS/vS/frS/subS),
 *  volúmenes (vuR útil, vmuerto muerto, vgeo construido), cotas (zFondo/zToma/zNAV/zLosa) y
 *  reposición (qrep necesario vs qa acometida; repOk veredicto; tLlen horas de llenado). */
export interface EpcCis {
  hu: number;
  hs: number;
  hbl: number;
  hsum: number;
  qa: number | null;
  nC: number;
  bC: number;
  lC: number;
  An: number;
  A: number;
  vuR: number;
  hrci: number;
  dS: number;
  vS: number;
  frS: number;
  subS: number;
  hTot: number;
  vgeo: number;
  vmuerto: number;
  zToma: number;
  zFondo: number;
  zNAV: number;
  zLosa: number;
  qrep: number;
  repOk: boolean | null;
  tLlen: number | null;
}

/** RESULTADO COMPLETO del motor EPC (todo en m.c.a. — la unidad del proyecto convierte en
 *  la UI). Incluye entradas ecoadas (qac/pmin/…), cadena de alturas (hg/pdesc/hsuc/hmt/hcero),
 *  potencias (phid/pb/pbhp/pins/pinkw), control variador (ponMca/pset/poffMca/pn2Mca/vu/vtk/alfa),
 *  diámetros (dnSuc/dnImp/dnB/dnBs), NPSH (npshd/patm/pvMca), presión admisible y PSV (paMin/psv),
 *  potencia comercial (potComHp/potComKw), cisterna (cis), alertas y datos faltantes (incompleto). */
export interface EpcR {
  qac: number;
  hfac: number;
  hfotros: number;
  pred: number;
  pmin: number;
  pmax: number;
  zbomba: number;
  ztop: number;
  zcis: number;
  hfcis: number;
  poffmax: number | null;
  altitud: number;
  temp: number;
  margen: number;
  dif: number;
  qminp: number;
  ciclos: number;
  etab: number;
  etam: number;
  fs: number;
  nt: number;
  nr: number;
  ntot: number;
  vsuc: number;
  vimp: number;
  apcrit: string;
  apIdx: number;
  mat: string;
  hfauto: boolean;
  cdia: number;
  usos: EpcUso[];
  vcisCons: number;
  vcisTot: number;
  vincendio: number;
  diasauto: number;
  qd: number;
  qb: number;
  hg: number;
  pdesc: number;
  hsuc: number;
  hmt: number;
  hcero: number;
  hmtDesc: string;
  phid: number;
  pb: number;
  pbhp: number;
  pins: number;
  pinkw: number;
  pset: number;
  ponMca: number;
  poffMca: number;
  ponBar: number;
  poffBar: number;
  pn2Mca: number;
  pn2Bar: number;
  vu: number;
  vtk: number;
  alfa: number;
  qmin: number;
  tc: number;
  patm: number;
  pvMca: number;
  dnSuc: EpcDn;
  dnImp: EpcDn;
  dnB: EpcDn;
  dnBs: EpcDn;
  npshd: number;
  hfsc: number;
  HC: { tot: number; suc: number; p: Array<[string, number]> };
  paMin: number | null;
  psv: number;
  matNombre: string;
  potComHp: number;
  potComKw: number;
  cis: EpcCis | null;
  alertas: EpcAlerta[];
  incompleto: string[] | null;
}

// ── Fórmulas base (port exacto) ──
/** Presión de vapor del agua (Antoine, 1–100 °C) en m.c.a. */
export const pvAgua = (t: number): number =>
  (Math.pow(10, 8.07131 - 1730.63 / (233.426 + t)) * 0.133322) / 9.80665;
/** Presión atmosférica por altitud. Ej: 0 m → 10,33 m.c.a. */
export const patmAlt = (h: number): number => 10.33 * Math.pow(1 - 2.2557e-5 * h, 5.2559);
const vQ = (q: number, d: number): number => q / 1000 / ((Math.PI / 4) * Math.pow(d / 1000, 2));

/** selectDN: sobre el MATERIAL activo (12 DN hasta 300), primero con vreal ≤ v·1,15;
 *  si ninguno, el mayor con fuera=true. */
export function selectDn(mat: MatEpc, qLps: number, vMs: number): EpcDn {
  const qm3s = qLps / 1000;
  for (const [dn, di, pa] of mat.d) {
    const a = (Math.PI / 4) * Math.pow(di / 1000, 2);
    const vreal = qm3s / a;
    if (vreal <= vMs * 1.15) return { dn, di, pa, vreal };
  }
  const [dn, di, pa] = mat.d[mat.d.length - 1];
  return { dn, di, pa, vreal: qm3s / ((Math.PI / 4) * Math.pow(di / 1000, 2)), fuera: true };
}

/** Hf del cuarto de bombas con los accesorios del esquema sugerido (método K, +10% tramos).
 *  K: VC 0,2 · cheque 2,5 · tee paso 1,0 · codo 0,75 · tee tanque 0,4 · filtro Y 3,0. */
const KACC = { vc: 0.2, ch: 2.5, teeR: 1.0, codo: 0.75, teeD: 0.4, y: 3.0 };
const hK = (K: number, v: number): number => (K * v * v) / 19.62;
function hfCuarto(
  qd: number,
  qb: number,
  dnS: EpcDn,
  dnI: EpcDn,
  dnB: EpcDn,
  dnBs: EpcDn,
  red: boolean,
): { tot: number; suc: number; p: Array<[string, number]> } {
  const vb = vQ(qb, dnB.di),
    vbs = vQ(qb, dnBs.di),
    vs = vQ(qd, dnS.di),
    vi = vQ(qd, dnI.di);
  const p: Array<[string, number]> = [
    ['Ramal de succión: VC + tee + codo', hK(KACC.vc + KACC.teeR + KACC.codo, vbs)],
    [
      'Ramal de impulsión: cheque + VC + codo + tee',
      hK(KACC.ch + KACC.vc + KACC.codo + KACC.teeR, vb),
    ],
    ['Colector de impulsión: tee del tanque + VC de salida', hK(KACC.teeD + KACC.vc, vi)],
  ];
  if (red) p.push(['Colector de succión: filtro Y', hK(KACC.y, vs)]);
  const tot = p.reduce((a, x) => a + x[1], 0) * 1.1;
  const suc = (p[0][1] + (red ? p[3][1] : 0)) * 1.1;
  return { tot, suc, p };
}

const c05 = (x: number): number => Math.ceil(x / 0.05 - 1e-9) * 0.05;

/** MOTOR COMPLETO. Ej: calcularEpc({...HU caso red...}) → R con pdesc 53,23 y 0 alertas. */
export function calcularEpc(ep: EpcIn): EpcR {
  const red = ep.modo === 'red';
  const mat = EP_MATS[ep.mat] || EP_MATS.pvc40;
  const qd = Math.max(0, ep.qac);
  const nt = Math.max(1, Math.round(ep.nt) || 1);
  const nr = Math.max(0, Math.round(ep.nr) || 0);
  const ntot = nt + nr;
  const qb = qd / nt;
  const ciclos = Math.max(1, ep.ciclos);

  const dnSuc = selectDn(mat, qd, ep.vsuc);
  const dnImp = selectDn(mat, qd, ep.vimp);
  const dnB = selectDn(mat, qb, ep.vimp);
  const dnBs = selectDn(mat, qb, ep.vsuc);
  const HC = hfCuarto(qd, qb, dnSuc, dnImp, dnB, dnBs, red);
  const hfotros = ep.hfauto ? HC.tot : ep.hfotros;

  // Control con variador: el arranque garantiza la P mínima; setpoint al centro de la banda.
  const hg = ep.ztop - ep.zbomba;
  const pdesc = hg + ep.hfac + ep.pmin;
  const ponMca = Math.ceil(pdesc + ep.margen - 1e-9); // STEP 1 en m.c.a. (motor SIEMPRE mca)
  const poffMca = ponMca + ep.dif;
  const pset = ponMca + ep.dif / 2;
  const pn2Mca = ponMca * 0.9;
  const ponBar = ponMca * 0.0980665;
  const poffBar = poffMca * 0.0980665;
  const pn2Bar = pn2Mca * 0.0980665;

  const hsuc = red ? -ep.pred : ep.zbomba - ep.zcis + ep.hfcis;
  const hmt = pset + hfotros + hsuc;
  const hcero = poffMca + (red ? -ep.pred : ep.zbomba - ep.zcis);
  const hmtDesc = red
    ? 'HMT = P objetivo + Hf_otros − Pred'
    : 'HMT = P objetivo + Hf_otros + (z_bomba − z_cis) + Hf_suc';

  const phid = 1000 * 9.81 * (qb / 1000) * Math.max(hmt, 0);
  const pb = phid / (ep.etab * ep.etam);
  const pbhp = pb / 745.7;
  const pins = pbhp * ep.fs;
  const pinkw = (pb * ep.fs) / 1000;

  const patm = patmAlt(ep.altitud);
  const pvMca = pvAgua(ep.temp);
  const qmin = (qb * ep.qminp) / 100;
  const alfa =
    ep.dif > 0 ? (pn2Mca + patm) / (ponMca + patm) - (pn2Mca + patm) / (poffMca + patm) : 0;
  const tc = 3600 / ciclos;
  const vu = (qmin * tc) / 4;
  const vtk = alfa > 0 ? vu / alfa : Infinity;
  const hfsc = HC.suc;
  const npshd = red
    ? patm + ep.pred - hfsc - pvMca
    : patm + (ep.zcis - ep.zbomba) - ep.hfcis - hfsc - pvMca;

  // Potencia comercial: sugerida = primera que cubre; la del usuario no baja de la calculada.
  const iSug = EP_POT_COM_HP.findIndex((p) => p >= pins);
  const sug = EP_POT_COM_HP[iSug < 0 ? EP_POT_COM_HP.length - 1 : iSug];
  const potComHp = ep.potSel && ep.potSel >= pins ? ep.potSel : sug;
  const potComKw = EP_HP2KW[potComHp] || potComHp * 0.7457;

  // ── Cisterna (geometría, sumergencia ANSI/HI 9.8, reposición) ──
  const cdia = ep.usos.reduce((a, u) => a + (u.c || 0) * (u.d || 0), 0);
  const vcisCons = cdia * ep.diasauto;
  const vcisTot = vcisCons + ep.vincendio;
  let cis: EpcCis | null = null;
  if (!red) {
    const hu = Math.max(0.3, ep.cisHu);
    const hs = Math.max(0, ep.cisHs);
    const hbl = Math.max(0, ep.cisBl);
    const hsum = Math.min(24, Math.max(1, ep.cisHsum));
    const nC = ep.cisDc ? 2 : 1;
    const cAreaN = vcisCons / 1000 / hu;
    const Ac = cAreaN / nC;
    const bC = Ac > 0 ? c05(Math.sqrt(Ac / 2)) : 0;
    const lC = bC > 0 ? c05(Ac / bC) : 0;
    const A = nC * bC * lC;
    const hrci = A > 0 ? ep.vincendio / 1000 / A : 0;
    const dS = dnSuc.di / 1000;
    const vS = qd / 1000 / ((Math.PI * dS * dS) / 4);
    const frS = vS / Math.sqrt(9.81 * dS);
    const subS = dS * (1 + 2.3 * frS);
    const hTot = hs + hrci + subS + hu + hbl;
    const vgeo = A * hTot;
    const vmuerto = A * (hs + subS);
    const zToma = ep.zcis - subS;
    const zFondo = zToma - hrci - hs;
    const zNAV = ep.zcis + hu;
    const zLosa = zNAV + hbl;
    const qrep = cdia / (hsum * 3600);
    const repOk = ep.cisQa == null ? null : ep.cisQa >= qrep - 1e-9;
    const tLlen = ep.cisQa != null && ep.cisQa > 0 ? vcisCons / ep.cisQa / 3600 : null;
    cis = {
      hu,
      hs,
      hbl,
      hsum,
      qa: ep.cisQa,
      nC,
      bC,
      lC,
      An: cAreaN,
      A,
      vuR: A * hu,
      hrci,
      dS,
      vS,
      frS,
      subS,
      hTot,
      vgeo,
      vmuerto,
      zToma,
      zFondo,
      zNAV,
      zLosa,
      qrep,
      repOk,
      tLlen,
    };
  }

  // ── Alertas [er/wa/in, qué pasa, cómo resolverlo[], campo, fix] — port de las 19 del HTML ──
  const A: EpcAlerta[] = [];
  const ad =
    (k: EpcAlerta['tipo']) =>
    (t: string, h: string[], go?: string, fix?: EpcAlerta['fix']): void => {
      void A.push({
        tipo: k,
        msg: t.replace(/\.\.$/, '.').replace(/\.\.\s/g, '. '),
        h: (h || []).map((x) => x.replace(/\.$/, '')),
        go,
        fix,
      });
    };
  const er = ad('er'),
    wa = ad('wa'),
    inf = ad('in');
  const uS = 'm.c.a.';
  const PU = (x: number): string =>
    `${x.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${uS}`;
  const F2 = (x: number, d = 2): string => x.toLocaleString('es-CO', { maximumFractionDigits: d });
  const setP = (go: string, val: number, t: string): EpcAlerta['fix'] => ({ go, val, t });

  // Datos obligatorios: sin ellos el EPC no calcula.
  const FAL: string[] = [],
    FALid: string[] = [];
  const vac = (v: number): boolean => !isFinite(v) || v === 0;
  const oblig: Array<[number, string, boolean, string]> = [
    [ep.qac, 'Caudal de diseño Qac', true, 'qac'],
    [ep.hfac, 'Pérdidas red AC Hf_ac', true, 'hfac'],
    [ep.pmin, 'Presión mínima Pmin', true, 'pmin'],
    [ep.pmax, 'Presión máxima Pmáx', true, 'pmax'],
    [ep.zbomba, 'Cota de la descarga z_bomba', false, 'zbomba'],
    [ep.ztop, 'Cota del punto crítico z_top', false, 'ztop'],
  ];
  for (const [v, l, pos, id] of oblig) {
    if (vac(v) || (pos && !(v > 0))) {
      FAL.push(l + (vac(v) ? '' : ' (mayor que 0)'));
      FALid.push(id);
    }
  }
  if (!vac(ep.ztop) && !vac(ep.zbomba) && ep.ztop <= ep.zbomba) {
    FAL.push('z_top debe estar por encima de z_bomba');
    FALid.push('ztop');
  }
  if (red) {
    if (!(ep.pred > 0)) {
      FAL.push('Presión en la succión Pred (mayor que 0)');
      FALid.push('pred');
    }
  } else {
    if (vac(ep.zcis)) {
      FAL.push('Nivel mínimo de la cisterna z_cis');
      FALid.push('zcis');
    }
    if (vac(ep.hfcis)) {
      FAL.push('Pérdidas de succión Hf_suc');
      FALid.push('hfcis');
    }
    if (!(cdia > 0)) {
      FAL.push('Consumo diario (tabla de usos)');
      FALid.push('cis-hu');
    }
    if (!(ep.diasauto > 0)) {
      FAL.push('Días de autonomía');
      FALid.push('diasauto');
    }
  }
  if (FAL.length)
    er(
      'Faltan datos para calcular: ' + FAL.join(' · ') + '.',
      [
        'Complete los datos indicados, o impórtelos del Perfil de presiones con «Importar datos del Perfil de presiones».',
      ],
      FALid[0],
    );
  if (!(Math.round(ep.nt) >= 1))
    er(
      'Bombas en trabajo debe ser ≥ 1 (se calcula con 1).',
      ['Típico: 2 bombas en trabajo para caudales medianos; 1 en edificaciones pequeñas.'],
      'nt',
      setP('nt', 1, 'Usar 1'),
    );
  const L = apLim(ep.apsel);
  if (L && ep.pmin < L.confort - 0.05)
    wa(
      `Pmin (${F2(ep.pmin)} ${uS}) por debajo del confort de «${L.nombre}» (${F2(L.confort)} ${uS}).`,
      [
        'Confirme en la ficha del fabricante que la grifería del punto crítico es de baja presión.',
        'Si no lo es, use la presión de confort del aparato.',
      ],
      'pmin',
      setP('pmin', L.confort, 'Usar confort'),
    );
  if (!(Math.round(ep.nr) >= 1))
    wa(
      'Sin bomba de reserva: los parámetros a garantizar exigen al menos 1.',
      ['Agregue al menos 1 bomba de reserva con alternancia y arranque automático por falla.'],
      'nr',
      setP('nr', 1, 'Poner 1 de reserva'),
    );
  if (!(ep.ciclos >= 1))
    er(
      'Arranques por hora debe ser ≥ 1 (se calcula con 1).',
      [
        'Use el máximo que admite el motor según el fabricante; típico 10–20 arranques/h con variador.',
      ],
      'ciclos',
      setP('ciclos', 20, 'Usar 20'),
    );
  if (!(ep.etab > 0 && ep.etab <= 1 && ep.etam > 0 && ep.etam <= 1))
    er(
      'Las eficiencias de bomba y motor deben estar entre 0 y 1.',
      [
        'Típico: bomba η_b 0,60–0,80 · motor + variador η_m 0,85–0,92. Tome el valor de la curva del fabricante.',
      ],
      !(ep.etab > 0 && ep.etab <= 1) ? 'etab' : 'etam',
    );
  if (ep.fs < 1)
    wa(
      'Factor de seguridad de potencia menor que 1.',
      ['Típico 1,15–1,30 para cubrir desgaste y desviaciones del punto de operación.'],
      'fs',
      setP('fs', 1.25, 'Usar 1,25'),
    );
  if (!(ep.dif > 0))
    er(
      'La banda de control debe ser mayor que 0: el tanque no se puede calcular.',
      ['Típico 3–10 m.c.a. (0,3–1,0 bar) entre arranque y parada.'],
      'dif',
      setP('dif', 5, 'Usar 5 m.c.a.'),
    );
  if (ep.margen < 0)
    wa(
      'Margen sobre P mín. negativo: el arranque quedaría por debajo de la presión mínima.',
      ['Use un margen de 0 a 3 m.c.a. sobre la P mínima en la descarga.'],
      'margen',
      setP('margen', 2, 'Usar 2 m.c.a.'),
    );
  if (qd > 0 && hmt <= 0)
    inf(
      'La presión disponible en la succión basta para el punto crítico (HMT ≤ 0).',
      [
        `Verifique que Pred (${PU(ep.pred)}) sea la presión mínima garantizada por la empresa de servicios en la hora de mayor consumo.`,
        'Si es así, la red puede alimentar sin equipo de presión; si no, use la Pred mínima real.',
      ],
      'pred',
    );
  // Parada sobre la máxima admisible: el equipo está bien; la red necesita bajar presión.
  if (ep.poffmax != null && poffMca > ep.poffmax + 1e-6) {
    const dl = poffMca - ep.poffmax;
    const zl = ep.zbomba + poffMca - ep.pmax;
    const pFit = ep.poffmax - (hg + ep.hfac) - Math.max(ep.margen, 0) - ep.dif;
    const h = [
      `<b>VRP en las derivaciones de los pisos con aparatos por debajo de la cota ${F2(zl, 1)} m</b>, calibradas para no superar ${PU(ep.pmax)} en el aparato más bajo de cada piso, sin bajar de la presión de confort más las pérdidas del piso.`,
      'Si son varios pisos: zona baja alimentada por una columna con estación reductora (dos VRP en paralelo, una de respaldo).',
      'Alternativa: zonificar con dos equipos de presión (zona alta y zona baja).',
    ];
    if (pFit > 0)
      h.push(
        `O usar en el punto crítico una grifería que funcione con ≤ ${PU(pFit)} (hoy Pmin = ${PU(ep.pmin)}).`,
      );
    h.push(
      `O bajar Hf_ac en ${F2(dl, 1)} m aumentando diámetros en el Perfil.`,
      `Verifique en el Perfil que la clase de las tuberías de las columnas admita la parada (${PU(poffMca)}); si el límite es la tubería, use una clase superior.`,
    );
    inf(
      `Para cumplir la P máx. del sistema (${PU(ep.pmax)}) en los pisos bajos: la parada (${PU(poffMca)}) supera en ${PU(dl)} la máxima admisible del Perfil (${PU(ep.poffmax)}).`,
      h,
    );
  } else if (ep.poffmax == null && ep.pmax > 0) {
    const zl = ep.zbomba + poffMca - ep.pmax;
    if (zl > ep.zbomba + 0.05)
      inf(
        `Los aparatos por debajo de la cota ${F2(zl, 1)} m quedarían con más de ${PU(ep.pmax)} estáticos con el equipo en parada.`,
        [
          `Si hay aparatos por debajo de esa cota: VRP en sus derivaciones, calibradas para no superar ${PU(ep.pmax)}.`,
          'Importe el Perfil de presiones para verificarlo con la red real.',
        ],
      );
  }
  if (qd > 0 && npshd < 3) {
    const fx = 3 - npshd;
    er(
      `NPSH disponible ${F2(npshd, 1)} m: alto riesgo de cavitación (falta ${F2(fx, 1)} m para llegar a 3 m).`,
      red
        ? [
            `Verifique una Pred mínima mayor (al menos ${PU(ep.pred + fx)}) o reduzca las pérdidas de succión del cuarto (diámetro mayor, menos accesorios).`,
            'Compare con el NPSH requerido de la bomba elegida (curva del fabricante) más 0,5 m.',
          ]
        : [
            `Suba el nivel mínimo de la cisterna o baje el eje de la bomba al menos ${F2(fx, 1)} m (succión positiva).`,
            `Reduzca Hf_suc (${F2(ep.hfcis)} m): diámetro de succión mayor, menos accesorios, válvula de pie de baja pérdida.`,
            'Compare con el NPSH requerido de la bomba elegida más 0,5 m.',
          ],
      red ? 'pred' : 'zcis',
    );
  }
  const paL = [dnSuc, dnImp, dnB, dnBs].map((d) => d.pa).filter((x): x is number => x != null);
  const paMin = paL.length ? Math.min(...paL) : null;
  const psv = Math.max(poffMca * 1.1, poffMca + 3);
  const matsQue = (p: number): string[] => {
    const ok: string[] = [];
    Object.keys(EP_MATS).forEach((k) => {
      if (k === mat.clave) return;
      const m2 = EP_MATS[k];
      const pa = [
        selectDn(m2, qd, ep.vsuc),
        selectDn(m2, qd, ep.vimp),
        selectDn(m2, qb, ep.vimp),
        selectDn(m2, qb, ep.vsuc),
      ]
        .map((d) => d.pa)
        .filter((x): x is number => x != null);
      if (pa.length && Math.min(...pa) >= p) ok.push(m2.corto);
    });
    return ok;
  };
  if (paMin != null && poffMca <= paMin && psv > paMin) {
    const m = matsQue(psv);
    er(
      `No hay margen para tarar la PSV: se requiere ≈ ${PU(psv)} y la tubería ${mat.corto} admite ${PU(paMin)}.`,
      [
        m.length
          ? `Cambie la tubería del cuarto a: ${m.join(', ')}.`
          : 'Use una tubería de clase superior (ninguna de la lista cubre esta presión).',
        `O baje la parada en ${PU(psv - paMin)} (banda o margen menores) si el diseño lo permite.`,
      ],
      'mat',
    );
  }
  if (paMin != null && poffMca > paMin) {
    const m = matsQue(psv);
    er(
      `La presión de parada (${PU(poffMca)}) supera la admisible de la tubería ${mat.corto} (${PU(paMin)}).`,
      [
        m.length
          ? `Cambie la tubería del cuarto a: ${m.join(', ')}.`
          : 'Ningún material de la lista cubre esta presión: use clase o material de mayor presión nominal.',
        'La PSV se tara por encima de la parada: la tubería debe admitir ambas.',
      ],
      'mat',
    );
  }
  if (dnSuc.fuera || dnImp.fuera || dnB.fuera || dnBs.fuera)
    er(
      `El caudal supera la tabla de diámetros del material (máx. DN ${mat.d[mat.d.length - 1][0]}) a la velocidad de diseño.`,
      [
        'Divida en dos colectores o aumente la velocidad de diseño dentro de lo admisible (succión ≤ 1,5 m/s; impulsión ≤ 2,5 m/s).',
        'O use un material con diámetros mayores en la lista.',
      ],
      dnSuc.fuera || dnBs.fuera ? 'vsuc' : 'vimp',
    );
  if (!red) {
    if (ep.cisHu < 0.3)
      wa(
        'Altura útil de la cisterna menor que 0,3 m: se calcula con 0,3 m.',
        ['Típico 1,5–3,0 m de altura útil entre NAM y NAV.'],
        'cis-hu',
      );
    if (ep.vincendio < 0)
      er(
        'La reserva contra incendio no puede ser negativa.',
        ['Escriba 0 si la cisterna no guarda reserva contra incendio.'],
        'vincendio',
        setP('vincendio', 0, 'Usar 0'),
      );
    if (cis && ep.cisQa != null && cis.repOk === false)
      wa(
        `La acometida (${F2(ep.cisQa)} L/s) no repone el consumo diario en ${F2(cis.hsum, 0)} h: requiere ${F2(cis.qrep)} L/s.`,
        [
          `Amplíe la acometida a ≥ ${F2(cis.qrep)} L/s (medidor y diámetro).`,
          'O aumente las horas de suministro, o los días de autonomía para cubrir el déficit.',
        ],
        'cis-qa',
      );
  }

  // Potencia comercial en el resultado (para memoria/entrega).
  return {
    qac: ep.qac,
    hfac: ep.hfac,
    hfotros,
    pred: ep.pred,
    pmin: ep.pmin,
    pmax: ep.pmax,
    zbomba: ep.zbomba,
    ztop: ep.ztop,
    zcis: ep.zcis,
    hfcis: ep.hfcis,
    poffmax: ep.poffmax,
    altitud: ep.altitud,
    temp: ep.temp,
    margen: ep.margen,
    dif: ep.dif,
    qminp: ep.qminp,
    ciclos,
    etab: ep.etab,
    etam: ep.etam,
    fs: ep.fs,
    nt,
    nr,
    ntot,
    vsuc: ep.vsuc,
    vimp: ep.vimp,
    apcrit: ep.apcrit,
    apIdx: ep.apsel,
    mat: mat.clave,
    hfauto: ep.hfauto,
    cdia,
    usos: ep.usos.map((u) => ({ ...u })),
    vcisCons,
    vcisTot,
    vincendio: ep.vincendio,
    diasauto: ep.diasauto,
    qd,
    qb,
    hg,
    pdesc,
    hsuc,
    hmt,
    hcero,
    hmtDesc,
    phid,
    pb,
    pbhp,
    pins,
    pinkw,
    pset,
    ponMca,
    poffMca,
    ponBar,
    poffBar,
    pn2Mca,
    pn2Bar,
    vu,
    vtk,
    alfa,
    qmin,
    tc,
    patm,
    pvMca,
    dnSuc,
    dnImp,
    dnB,
    dnBs,
    npshd,
    hfsc,
    HC,
    paMin,
    psv,
    matNombre: mat.corto,
    potComHp,
    potComKw,
    cis,
    alertas: A,
    incompleto: FAL.length ? FAL : null,
  };
}
