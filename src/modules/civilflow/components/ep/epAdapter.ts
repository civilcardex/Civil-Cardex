/** Adaptador EPData → motor EPC (ped. 2026-11-19, F1.3): convierte los strings del formulario
 *  (con coma decimal) a EpcIn (numbers en m.c.a. SIEMPRE — la unidad del proyecto convierte en
 *  la UI), corre calcularEpc y expone el resultado con los nombres que los paneles de
 *  verificación ya consumen (alias compatibles: Pon/Poff/PN2/Vu/Vt/autoNema/…). Los campos
 *  legacy qasc/hfacs (diseño ACS aparte) NO alimentan el motor EPC: el equipo abastece la red
 *  de agua fría + calentadores con UN caudal (doctrina del HTML de referencia). */
import { dec } from '../../utils/parseDecimal.ts';
import { calcularEpc, EP_USO_CAT, type EpcDn, type EpcIn, type EpcR } from './epEngine.ts';
import { apMatch } from './epAparatos.ts';
import type { EPData } from './EPShared.ts';

const n = (v: string): number => (v.trim() === '' ? 0 : dec(v));
const nO = (v: string): number | null => (v.trim() === '' ? null : dec(v));

/** EPData → EpcIn en m.c.a. Ej: epEngineIn(ep).qac = 12.8 con ep.qac '12,80'. */
export function epEngineIn(ep: EPData): EpcIn {
  const apsel = ep.apsel.trim() === '' ? apMatch(ep.apcrit) : parseInt(ep.apsel, 10) || -1;
  return {
    modo: ep.modo === 'cisterna' ? 'cis' : 'red',
    qac: n(ep.qac),
    hfac: n(ep.hfac),
    pred: n(ep.pred),
    pmin: n(ep.pmin),
    apcrit: ep.apcrit,
    apsel,
    pmax: n(ep.pmax),
    zbomba: n(ep.zbomba),
    ztop: n(ep.ztop),
    poffmax: nO(ep.poffmax),
    altitud: n(ep.altitud),
    temp: n(ep.temp) || 20,
    margen: n(ep.margen),
    dif: n(ep.dif),
    qminp: n(ep.qminp) || 10,
    ciclos: n(ep.ciclos) || 20,
    etab: n(ep.etab) || 0.72,
    etam: n(ep.etam) || 0.9,
    fs: n(ep.fs) || 1.25,
    vsuc: n(ep.vsuc) || 1.2,
    vimp: n(ep.vimp) || 2,
    nt: n(ep.nt) || 1,
    nr: n(ep.nr),
    mat: ep.mat || 'pvc40',
    hfauto: ep.hfauto !== 'false',
    hfotros: n(ep.hfotros),
    zcis: n(ep.zcis),
    hfcis: n(ep.hfcis),
    diasauto: n(ep.diasAut) || 1,
    vincendio: n(ep.bciL),
    /* Cisterna: usos (JSON) y geometría desde el formulario. */
    usos: parseUsos(ep.usos),
    cisHu: n(ep.cisHu) || 2,
    cisHs: n(ep.cisHs),
    cisBl: n(ep.cisBl),
    cisQa: ep.cisQa.trim() === '' ? null : n(ep.cisQa),
    cisHsum: n(ep.cisHsum) || 24,
    cisDc: ep.cisDc === 'true',
    potSel: n(ep.potSel),
  };
}

/** Tabla de usos desde el JSON del formulario (tolerante: fila inválida se salta). */
function parseUsos(json: string): EpcIn['usos'] {
  try {
    const arr = JSON.parse(json || '[]') as Array<{ k: number; c: number; d: number }>;
    return Array.isArray(arr)
      ? arr
          .filter((u) => u && EP_USO_CAT[u.k] && Number(u.c) >= 0 && Number(u.d) >= 0)
          .map((u) => ({ k: u.k, c: Number(u.c) || 0, d: Number(u.d) || 0 }))
      : [];
  } catch {
    return [];
  }
}

/** Ramal con su Ø teórico, DN comercial y velocidad real (forma del viejo EpRamalCol). */
export interface EpRamalCol {
  diamCalcMm: number;
  dn: number;
  vReal: number;
}

/** Resultado del motor EPC + los alias que los paneles de verificación ya consumen (forma
 *  compatible con el EpVerifCalc viejo). Ej: calc.Pon = 56 (prueba de aceptación HU). */
export interface EpCalc extends EpcR {
  Qd: number;
  Qm3h: number;
  Qgpm: number;
  Qb: number;
  isRed: boolean;
  Hg: number;
  Hf: number;
  HMT: number;
  HfCrit: number;
  Phid: number;
  Pfreno_w: number;
  Pfreno_hp: number;
  Pins_hp: number;
  Pins_kw: number;
  Pon: number;
  Poff: number;
  PN2: number;
  Pon_bar: number;
  Poff_bar: number;
  PN2_bar: number;
  vsuc: number;
  vimp: number;
  Vu: number;
  Vt: number;
  autoNema: number;
  nemaSel: number;
  margenPct: number;
  pComercialOk: boolean;
  alertaPmax: boolean;
  hgOk: boolean;
  hfOk: boolean;
  pminOk: boolean;
  predOk: boolean;
  hmtOk: boolean;
  rSucColector: EpRamalCol;
  rImpColector: EpRamalCol;
  rSucBomba: EpRamalCol;
  rImpBomba: EpRamalCol;
  sucDiam: { dn: number; Vreal: number };
  impDiam: { dn: number; Vreal: number };
}

/** Cadena completa desde EPData. Ej: calcEpc(ep).pdesc = 53.23 (prueba de aceptación HU). */
export function calcEpc(ep: EPData): EpCalc {
  const r = calcularEpc(epEngineIn(ep));
  const Qd = r.qd;
  const ramalCol = (q: number, v: number, d: EpcDn): EpRamalCol => ({
    diamCalcMm: q > 0 ? Math.sqrt((4 * (q / 1000)) / (Math.PI * v)) * 1000 : 0,
    dn: d.dn,
    vReal: d.vreal,
  });
  const isRed = ep.modo === 'red';
  return {
    ...r,
    Qd,
    Qm3h: Qd * 3.6,
    Qgpm: Qd * 15.8503,
    Qb: r.qb,
    isRed,
    Hg: r.hg,
    Hf: isRed ? r.hfac + r.hfotros : r.hfac + r.hfotros + r.hfcis,
    HMT: r.hmt,
    HfCrit: ep.hfacs !== '' ? Math.max(r.hfac, n(ep.hfacs)) : r.hfac,
    Phid: 1000 * 9.81 * (r.qb / 1000) * Math.max(r.hmt, 0),
    Pfreno_w: r.pb,
    Pfreno_hp: r.pbhp,
    Pins_hp: r.pins,
    Pins_kw: r.pinkw,
    Pon: r.ponMca,
    Poff: r.poffMca,
    PN2: r.pn2Mca,
    Pon_bar: r.ponBar,
    Poff_bar: r.poffBar,
    PN2_bar: r.pn2Bar,
    vsuc: r.vsuc,
    vimp: r.vimp,
    Vu: r.vu,
    Vt: isFinite(r.vtk) ? r.vtk : 0,
    autoNema: r.potComHp,
    nemaSel: r.potComHp,
    margenPct: r.pins > 0 ? ((r.potComHp - r.pins) / r.pins) * 100 : 0,
    pComercialOk: r.potComHp >= r.pins,
    alertaPmax: r.pmax > 0 && r.poffMca > r.pmax,
    hgOk: r.hg > 0,
    hfOk: r.hfotros >= 0 && r.hfac >= 0,
    pminOk: r.pmin > 0,
    predOk: isRed ? r.pred > 0 : r.zcis !== 0 || r.hfcis > 0,
    hmtOk: r.hmt > 0,
    rSucColector: ramalCol(r.qd, r.vsuc, r.dnSuc),
    rImpColector: ramalCol(r.qd, r.vimp, r.dnImp),
    rSucBomba: ramalCol(r.qb, r.vsuc, r.dnBs),
    rImpBomba: ramalCol(r.qb, r.vimp, r.dnB),
    sucDiam: { dn: r.dnSuc.dn, Vreal: r.dnSuc.vreal },
    impDiam: { dn: r.dnImp.dn, Vreal: r.dnImp.vreal },
  };
}
