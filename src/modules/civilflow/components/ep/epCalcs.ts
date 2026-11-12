import { AGUA_DENSIDAD, GRAVEDAD } from '../../utils/calcSanitaryCore.ts';
import { entradaPor } from '../../utils/diamLookup';
import { dec } from '../../utils/parseDecimal.ts';
import { NEMA_HP, PVC_SCH40, selectDN } from './calcs.ts';

// Cálculos de la página Cisterna (Excel hoja CISTERNA) — ÚNICA fuente para página, página de
// verificación y tests. Antes: HMT/NPSH triplicados (EPCisternaPage / EPVerificationPage /
// test) con deriva silenciosa garantizada. Celdas citadas: C8/C9/C10 (desniveles), C27 (HMT
// cisterna — SIN descuento de Pred, a diferencia del modo RED), NPSHd (patm − pv − |z_cis| −
// hf_cis) vs NPSHr + 0.5 m de margen normativo (RAS 2000).

/** Forma mínima de EPData que los cálculos cisterna leen (todo string, convención EP (Equipo de Presion)). */
export interface EpCisternaIn {
  modo: 'red' | 'cisterna';
  ztop: string;
  zcis: string;
  hfac: string;
  hfacs: string;
  hfotros: string;
  hfcis: string;
  pmin: string;
  patm: string;
  pv: string;
  npshr: string;
  dotL: string;
  nUsuarios: string;
  diasAut: string;
  bciL: string;
}

/** Resultado de la cadena cisterna: alturas (Hg/Hf/HMT), NPSH disponible y veredicto de
 *  cavitación, más volúmenes de consumo/total. Ej: npshOk false -> ampliar la succión. */
export interface EpCisternaCalc {
  /** Modo RED: los números de cisterna no aplican (la página solo muestra aviso). */
  aplica: boolean;
  HgTotal: number;
  HfTotal: number;
  HMT: number;
  npshd: number;
  npshOk: boolean;
  volConsumo: number;
  volTotal: number;
  /** Los 3 inputs de NPSH (patm/pv/npshr) están poblados — sin ellos el veredicto es
   *  "—" y NO la falsa alarma de cavitación que daban los defaults vacíos. */
  npshEvaluable: boolean;
}

/** Encadenado cisterna completo desde EPData (strings con coma decimal). */
export function calcularCisterna(ep: EpCisternaIn): EpCisternaCalc {
  const zcis = dec(ep.zcis);
  const hfsuc = dec(ep.hfcis);
  const hAcrit = Math.max(dec(ep.hfac), dec(ep.hfacs));
  const HgTotal = dec(ep.ztop) - zcis;
  const HfTotal = hAcrit + dec(ep.hfotros) + hfsuc;
  const HMT = HgTotal + HfTotal + dec(ep.pmin);
  const patm = dec(ep.patm);
  const pv = dec(ep.pv);
  const npshr = dec(ep.npshr);
  const npshEvaluable = ep.patm.trim() !== '' && ep.pv.trim() !== '' && ep.npshr.trim() !== '';
  const npshd = patm - pv - Math.abs(zcis) - hfsuc;
  const npshOk = npshEvaluable && npshd >= npshr + 0.5;
  const volConsumo = dec(ep.dotL) * dec(ep.nUsuarios) * dec(ep.diasAut);
  return {
    aplica: ep.modo !== 'red',
    HgTotal,
    HfTotal,
    HMT,
    npshd,
    npshOk,
    volConsumo,
    volTotal: volConsumo + dec(ep.bciL),
    npshEvaluable,
  };
}

// ---------- Verificación (páginas "Cálculo hidráulico y potencia" y "Diámetros y especificación") ----------
// Extracción verbatim del bloque de cálculo que vivía inline en EPVerificationPage.tsx
// (Excel hoja CÁLCULO EPC): caudales, HMT/Hg/Hf según modo RED vs CISTERNA, potencias,
// setpoints del tanque hidroneumático y diámetros de ramales.

/** Forma mínima de EPData que los cálculos de verificación leen: extiende la cisterna porque
 *  en modo cisterna la HMT (altura manométrica total) sale de calcularCisterna. */
export interface EpVerifIn extends EpCisternaIn {
  qac: string;
  qasc: string;
  pred: string;
  pmax: string;
  zbomba: string;
  nt: string;
  etab: string;
  etam: string;
  fs: string;
  ciclos: string;
  alfa: string;
  vsuc: string;
  vimp: string;
  pcomercial: string;
  dnsuc: string;
  dnimp: string;
  nr: string;
}

/** Diámetro y velocidad de un ramal del equipo: el teórico (D calc) y el comercial elegido. */
export interface EpRamalCol {
  diamCalcMm: number;
  dn: number;
  vReal: number;
}

/** Diámetro con velocidad real, ya sea el recomendado por catálogo o el DN que digitó el usuario. */
export interface EpDiamSel {
  dn: number;
  Vreal: number;
}

/** Todo lo que las tablas de verificación del ep (Equipo de Presión) muestran. Ej: si HMT <= 0
 *  el equipo no puede vencer la altura — hmtOk false y la tabla marca ✗ en m.c.a. */
export interface EpVerifCalc {
  /** Caudal de diseño Qd = MAX(Qac, Qasc) y conversiones (Excel C65-C67); Qb = caudal por bomba. */
  Qd: number;
  Qm3h: number;
  Qgpm: number;
  Qb: number;
  /** Modo de succión: RED (acometida directa) o CISTERNA (delega Hg/Hf/HMT en calcularCisterna). */
  isRed: boolean;
  /** Alturas en m.c.a. (metros de columna de agua): desnivel, pérdidas críticas y HMT. */
  Hg: number;
  HfCrit: number;
  Hf: number;
  HMT: number;
  /** Potencias: hidráulica (W), al freno (W y HP), instalada con factor de seguridad (HP y kW). */
  Phid: number;
  Pfreno_w: number;
  Pfreno_hp: number;
  Pins_hp: number;
  Pins_kw: number;
  /** Potencia comercial: la NEMA (National Electrical Manufacturers Association) que cubre la
   *  calculada (autoNema) y la finalmente seleccionada (el usuario puede sobreescribirla con pcomercial). */
  autoNema: number;
  nemaSel: number;
  /** Margen % de la comercial sobre la calculada y si es suficiente (nemaSel >= Pins_hp). */
  margenPct: number;
  pComercialOk: boolean;
  /** Presiones de arranque/paro del presostato y precarga N₂ (m.c.a. y bar, Excel C92-C96). */
  Pon: number;
  Poff: number;
  PN2: number;
  Pon_bar: number;
  Poff_bar: number;
  PN2_bar: number;
  /** Volúmenes del tanque hidroneumático en L: útil (Vu) y total (Vt = Vu / α). */
  Vu: number;
  Vt: number;
  /** Veredictos de cada fila de la tabla (true -> ✓ verde). Ej: alertaPmax true -> HMT supera pmax. */
  hmtOk: boolean;
  alertaPmax: boolean;
  hgOk: boolean;
  hfOk: boolean;
  pminOk: boolean;
  predOk: boolean;
  /** Los 4 ramales del equipo: succión/impulsión × colector (Qd)/por bomba (Qb). */
  rSucColector: EpRamalCol;
  rImpColector: EpRamalCol;
  rSucBomba: EpRamalCol;
  rImpBomba: EpRamalCol;
  /** Diámetros de succión/impulsión respetando el DN del usuario (dnsuc/dnimp) si es válido. */
  sucDiam: EpDiamSel;
  impDiam: EpDiamSel;
  /** Inputs decodificados con su valor por defecto, tal como los muestran las tablas. */
  nt: number;
  ciclos: number;
  vsuc: number;
  vimp: number;
  pmin: number;
  pmax: number;
  pred: number;
  hfotros: number;
}

// Excel CÁLCULO EPC: resultados a 3 decimales (usuario: unificar TODO resultado a 3 dec).
export const fmtMm = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtMs = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtHp = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtBar = (v: number) => (v !== 0 ? v.toFixed(2) : '—');
export const fmtLps = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtM3h = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtGpm = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtMca = (v: number) => (v !== 0 ? v.toFixed(2) : '—');
export const fmtL = (v: number) => (v > 0 ? v.toFixed(2) : '—');
export const fmtW = (v: number) => (v > 0 ? v.toFixed(2) : '—');

/** Calcula el diámetro y velocidad reales de un ramal dado un caudal y velocidad de diseño. */
export const ramalCol = (qLps: number, vDiseno: number): EpRamalCol => {
  const Qm3s = qLps / 1000;
  const diamCalcM = Math.sqrt((4 * Qm3s) / (Math.PI * vDiseno));
  const diamCalcMm = diamCalcM * 1000;
  const entry = selectDN(qLps, vDiseno);
  return { diamCalcMm, dn: entry.dn, vReal: entry.Vreal };
};

/** Primera potencia NEMA (National Electrical Manufacturers Association) que cubre la calculada;
 *  si ninguna alcanza, la mayor del catálogo. Ej: 6.4 HP -> 7.5 HP. */
function autoNemaHp(pinsHp: number): number {
  for (const h of NEMA_HP) {
    if (h >= pinsHp) return h;
  }
  return NEMA_HP[NEMA_HP.length - 1];
}

/** Diámetro del ramal del equipo: si el usuario eligió un DN (diámetro nominal) PVC (Policloruro
 *  de Vinilo) Sch 40 válido usa ese y calcula su velocidad real; si no, recomienda selectDN.
 *  Ej: dnsuc "40" con Qd 5 L/s -> DN 40 y su Vreal. */
export function resolverDiametroEp(dnUsuario: number, Qlps: number, vDiseno: number): EpDiamSel {
  if (dnUsuario > 0) {
    const entry = entradaPor(PVC_SCH40, 'dn', dnUsuario);
    if (entry) {
      const A = (Math.PI * Math.pow(entry.dInt / 1000, 2)) / 4;
      return { dn: entry.dn, Vreal: Qlps > 0 ? Qlps / 1000 / A : 0 };
    }
  }
  return selectDN(Qlps, vDiseno);
}

/** Cadena de verificación completa del ep (Equipo de Presión) desde EPData (strings con coma
 *  decimal): ÚNICA fuente para las páginas params y results — antes este bloque vivía inline
 *  en EPVerificationPage y alimentaba ambas ramas con memo suelto. */
export function calcularEp(ep: EpVerifIn): EpVerifCalc {
  const qac = dec(ep.qac),
    qasc = dec(ep.qasc);
  const hfac = dec(ep.hfac),
    hfacs = dec(ep.hfacs),
    hfotros = dec(ep.hfotros);
  const pred = dec(ep.pred),
    pmin = dec(ep.pmin),
    pmax = dec(ep.pmax);
  const zbomba = dec(ep.zbomba),
    ztop = dec(ep.ztop);
  const nt = dec(ep.nt) || 1;
  const etab = dec(ep.etab) || 0.65,
    etam = dec(ep.etam) || 0.85;
  const fs = dec(ep.fs) || 1.15,
    ciclos = dec(ep.ciclos) || 6;
  const alfa = dec(ep.alfa) || 0.3;
  const vsuc = dec(ep.vsuc) || 1.5,
    vimp = dec(ep.vimp) || 2.0;
  const isRed = ep.modo === 'red';

  const Qd = Math.max(qac, qasc);
  const Qm3h = Qd * 3.6;
  // Factor Excel C67 (15.8503 L/s→GPM).
  const Qgpm = Qd * 15.8503;
  const Qb = nt > 0 ? Qd / nt : Qd;

  // Rama RED propia (descuenta Pred); rama CISTERNA delega en calcularCisterna (única fuente —
  // antes HMT/NPSH vivían triplicados y derivaban en silencio).
  const cis = calcularCisterna(ep);
  const Hg = isRed ? ztop - zbomba : cis.HgTotal;
  const HfCrit = Math.max(hfac, hfacs);
  const Hf = isRed ? HfCrit + hfotros : cis.HfTotal;
  const HMT = isRed ? Hg + Hf + pmin - pred : cis.HMT;

  const Phid = AGUA_DENSIDAD * GRAVEDAD * (Qd / 1000) * (HMT > 0 ? HMT : 0);
  const Pfreno_w = etab * etam > 0 ? Phid / (etab * etam) : 0;
  const Pfreno_hp = Pfreno_w / 745.7;
  const Pins_hp = Pfreno_hp * fs;
  const Pins_kw = (Pfreno_hp * 745.7 * fs) / 1000;

  const rSucColector = ramalCol(Qd, vsuc);
  const rImpColector = ramalCol(Qd, vimp);
  const rSucBomba = ramalCol(Qb, vsuc);
  const rImpBomba = ramalCol(Qb, vimp);

  const autoNema = autoNemaHp(Pins_hp);
  const custom = dec(ep.pcomercial);
  const nemaSel = custom > 0 ? custom : autoNema;

  const margenPct = Pins_hp > 0 ? ((nemaSel - Pins_hp) / Pins_hp) * 100 : 0;
  const pComercialOk = nemaSel >= Pins_hp;

  const Pon = HMT;
  const Poff = Pon * 1.1;
  const PN2 = Pon * 0.9;
  // Excel C94-C96: bar = m.c.a. × 9.81/100 (no ÷10.2 — difiere en el 3er decimal).
  const Pon_bar = (Pon * 9.81) / 100;
  const Poff_bar = (Poff * 9.81) / 100;
  const PN2_bar = (PN2 * 9.81) / 100;
  const Vu = ciclos > 0 ? (Qd * 60) / (4 * ciclos) : 0;
  const Vt = alfa > 0 ? Vu / alfa : 0;

  const hmtOk = HMT > 0 && HMT < pmax;
  const alertaPmax = HMT > pmax && pmax > 0;

  const hgOk = Hg > 0;
  const hfOk = Hf >= 0;
  const pminOk = pmin > 0;
  const predOk = pred > 0;

  const sucDiam = resolverDiametroEp(dec(ep.dnsuc), Qd, vsuc);
  const impDiam = resolverDiametroEp(dec(ep.dnimp), Qd, vimp);

  return {
    Qd,
    Qm3h,
    Qgpm,
    Qb,
    isRed,
    Hg,
    HfCrit,
    Hf,
    HMT,
    Phid,
    Pfreno_w,
    Pfreno_hp,
    Pins_hp,
    Pins_kw,
    autoNema,
    nemaSel,
    margenPct,
    pComercialOk,
    Pon,
    Poff,
    PN2,
    Pon_bar,
    Poff_bar,
    PN2_bar,
    Vu,
    Vt,
    hmtOk,
    alertaPmax,
    hgOk,
    hfOk,
    pminOk,
    predOk,
    rSucColector,
    rImpColector,
    rSucBomba,
    rImpBomba,
    sucDiam,
    impDiam,
    nt,
    ciclos,
    vsuc,
    vimp,
    pmin,
    pmax,
    pred,
    hfotros,
  };
}
