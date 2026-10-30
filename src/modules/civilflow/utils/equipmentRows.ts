// Memoria de equipos para la exportación (split bomba/ep): Bomba AR vive en bombaMemoria.ts,
// Equipo de Presión aquí. Re-exports intactos — los consumidores no cambiaron.
import type { MemoriaTable } from './exportReportFinal.ts';
import { loadFromStorage } from '../services/storageService.ts';
import { dec } from './parseDecimal.ts';
import type { EPData } from '../components/ep/EPShared';
import { PVC_SCH40, NEMA_HP, selectDN } from '../components/ep/calcs.ts';
import { AGUA_DENSIDAD, GRAVEDAD } from './calcSanitaryCore.ts';
import { entradaPor } from './diamLookup';
import { perfilDe } from '../constants/countryStandards';

export { computeBombaTables, bombaAlertas } from './pumpReport.ts';

const or = (v: string | number | undefined | null): string =>
  v === '' || v == null ? '—' : String(v);
const f2 = (n: number): string => (Number.isFinite(n) ? n.toFixed(2) : '—');

// Equipo de presión (PressureEquipmentDesign.tsx → EPInputPage.tsx + EPVerificationPage.tsx, 3
// páginas de pantalla) — misma idea que Bomba AR arriba: cada card/tabla de cada página,
// replicada desde los mismos campos `ep` crudos y las mismas fórmulas que calculan las pantallas
// en vivo, en vez de un resumen aplanado.
/** Física ep (Equipo de Presion) compartida (computeEpTables y resumen leen lo mismo, sin drift). */
function epBase(ep: EPData) {
  const qac = dec(ep.qac),
    qasc = dec(ep.qasc);
  const hfac = dec(ep.hfac),
    hfacs = dec(ep.hfacs),
    hfotros = dec(ep.hfotros);
  const pred = dec(ep.pred),
    pmin = dec(ep.pmin),
    pmax = dec(ep.pmax);
  const zbomba = dec(ep.zbomba),
    ztop = dec(ep.ztop),
    zcis = dec(ep.zcis),
    hfcis = dec(ep.hfcis);
  const nt = dec(ep.nt) || 1,
    nr = dec(ep.nr);
  const etab = dec(ep.etab) || 0.65,
    etam = dec(ep.etam) || 0.85;
  const fs = dec(ep.fs) || 1.15,
    ciclos = dec(ep.ciclos) || 6;
  const alfa = dec(ep.alfa) || 0.3;
  const vsuc = dec(ep.vsuc) || 1.5,
    vimp = dec(ep.vimp) || 2.0;
  const isRed = ep.modo === 'red';
  const ntot = nt + nr;

  const Qd = Math.max(qac, qasc);
  const Qm3h = Qd * 3.6;
  const Qgpm = Qd * 15.85;
  const Qb = nt > 0 ? Qd / nt : Qd;

  const Hg = isRed ? ztop - zbomba : ztop - zcis;
  const HfCrit = Math.max(hfac, hfacs);
  const Hf = isRed ? HfCrit + hfotros : HfCrit + hfotros + hfcis;
  const HMT = isRed ? Hg + Hf + pmin - pred : Hg + Hf + pmin;

  const Phid = AGUA_DENSIDAD * GRAVEDAD * (Qd / 1000) * (HMT > 0 ? HMT : 0);
  const Pfreno_w = etab * etam > 0 ? Phid / (etab * etam) : 0;
  const Pfreno_hp = Pfreno_w / 745.7;
  const Pins_hp = Pfreno_hp * fs;
  const Pins_kw = (Pfreno_hp * 745.7 * fs) / 1000;

  let autoNema = NEMA_HP[NEMA_HP.length - 1];
  for (const h of NEMA_HP) {
    if (h >= Pins_hp) {
      autoNema = h;
      break;
    }
  }
  const customHp = dec(ep.pcomercial);
  const nemaSel = customHp > 0 ? customHp : autoNema;
  const margenPct = Pins_hp > 0 ? ((nemaSel - Pins_hp) / Pins_hp) * 100 : 0;
  const pComercialOk = nemaSel >= Pins_hp;

  const Pon = HMT;
  const Poff = Pon * 1.1;
  const PN2 = Pon * 0.9;
  const Pon_bar = Pon / 10.2;
  const Poff_bar = Poff / 10.2;
  const PN2_bar = PN2 / 10.2;
  const Vu = ciclos > 0 ? (Qd * 60) / (4 * ciclos) : 0;
  const Vt = alfa > 0 ? Vu / alfa : 0;

  const hmtOk = HMT > 0 && HMT < pmax;
  const alertaPmax = HMT > pmax && pmax > 0;
  const hgOk = Hg > 0;
  // Hf >= 0 era siempre true (dec() devuelve 0 ante vacío → check muerto): "con dato" =
  // al menos UNA pérdida crítica del fabricante > 0 (hfac o hfacs).
  const hfOk = Math.max(dec(ep.hfac), dec(ep.hfacs)) > 0;
  const pminOk = pmin > 0;
  const predOk = pred > 0;

  return {
    qac,
    qasc,
    hfac,
    hfacs,
    hfotros,
    pred,
    pmin,
    pmax,
    zbomba,
    ztop,
    zcis,
    hfcis,
    nt,
    nr,
    etab,
    etam,
    fs,
    ciclos,
    alfa,
    vsuc,
    vimp,
    isRed,
    ntot,
    Qd,
    Qm3h,
    Qgpm,
    Qb,
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
  };
}

/** Tablas de la memoria del ep (Equipo de Presion): lee la bomba guardada ('ep') y arma parámetros, presiones, Hg/Hf y alertas contra el perfil del país. */
export function computeEpTables(pais?: string): MemoriaTable[] {
  const ep = loadFromStorage<EPData | null>('ep', null);
  if (!ep) return [];
  const perfil = perfilDe(pais);

  const {
    pred,
    pmin,
    pmax,
    zbomba,
    ztop,
    nt,
    nr,
    ciclos,
    vsuc,
    vimp,
    isRed,
    ntot,
    Qd,
    Qm3h,
    Qgpm,
    Qb,
    Hg,
    HfCrit,
    Hf,
    HMT,
    Phid,
    Pfreno_w,
    Pfreno_hp,
    Pins_hp,
    Pins_kw,
    nemaSel,
    margenPct,
    pComercialOk,
    Pon,
    Poff,
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
  } = epBase(ep);
  const ramalCol = (qLps: number, vDiseno: number) => {
    const Qm3s = qLps / 1000;
    const diamCalcM = Math.sqrt((4 * Qm3s) / (Math.PI * vDiseno));
    const diamCalcMm = diamCalcM * 1000;
    const entry = selectDN(qLps, vDiseno);
    return { diamCalcMm, dn: entry.dn, vReal: entry.Vreal };
  };
  const rSucColector = ramalCol(Qd, vsuc);
  const rImpColector = ramalCol(Qd, vimp);
  const rSucBomba = ramalCol(Qb, vsuc);
  const rImpBomba = ramalCol(Qb, vimp);

  const fmtMm = (v: number) => (v > 0 ? v.toFixed(1) : '—');
  const fmtMs = (v: number) => (v > 0 ? v.toFixed(2) : '—');
  const fmtHp = (v: number) => (v > 0 ? v.toFixed(3) : '—');
  const fmtBar = (v: number) => (v !== 0 ? v.toFixed(2) : '—');
  const fmtLps = (v: number) => (v > 0 ? v.toFixed(3) : '—');
  const fmtM3h = (v: number) => (v > 0 ? v.toFixed(2) : '—');
  const fmtGpm = (v: number) => (v > 0 ? v.toFixed(1) : '—');
  const fmtMca = (v: number) => (v !== 0 ? v.toFixed(2) : '—');
  const fmtL = (v: number) => (v > 0 ? v.toFixed(1) : '—');
  const fmtW = (v: number) => (v > 0 ? v.toFixed(0) : '—');

  const resolveDiam = (userDN: number, v: number) => {
    if (userDN > 0) {
      const entry = entradaPor(PVC_SCH40, 'dn', userDN);
      if (entry) {
        const A = (Math.PI * Math.pow(entry.dInt / 1000, 2)) / 4;
        return { dn: entry.dn, Vreal: Qd > 0 ? Qd / 1000 / A : 0 };
      }
    }
    return selectDN(Qd, v);
  };
  const sucDiam = resolveDiam(dec(ep.dnsuc), vsuc);
  const impDiam = resolveDiam(dec(ep.dnimp), vimp);

  const caudalesDiseno: MemoriaTable = {
    title: 'Equipo presión — caudales de diseño',
    headers: ['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia'],
    rows: [
      [
        'Caudal diseño AF (red agua fría)',
        or(ep.qac),
        'L/s',
        'Hunter / RAS 2000 — Caudal probable de la red de agua fría',
      ],
      [
        'Caudal diseño ACS (red agua caliente)',
        or(ep.qasc),
        'L/s',
        'Hunter / RAS 2000 — Típico 60–70% del Qac',
      ],
    ],
  };

  const presionesCotas: MemoriaTable = {
    title: 'Equipo presión — presiones y cotas',
    headers: ['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia'],
    rows: [
      ...(isRed
        ? [['Presión acometida (red pública en entrega)', or(ep.pred), 'm.c.a.', 'Medida en campo']]
        : []),
      ['Presión mínima punto crítico', or(ep.pmin), 'm.c.a.', perfil.refPmin],
      ['Presión máxima sistema', or(ep.pmax), 'm.c.a.', perfil.refPmax],
      ['Cota bomba', or(ep.zbomba), 'm', 'Nivel de instalación del equipo'],
      ['Cota punto más desfavorable', or(ep.ztop), 'm', 'Levantamiento topográfico o planos'],
    ],
  };

  const perdidasCarga: MemoriaTable = {
    title: 'Equipo presión — pérdidas de carga',
    headers: ['Parámetro', 'Valor', 'Ud.', 'Comentario / Referencia'],
    rows: [
      ['Pérdidas red AF', or(ep.hfac), 'm.c.a.', 'Darcy-Weisbach'],
      [
        'Pérdidas red ACS',
        or(ep.hfacs),
        'm.c.a.',
        'Darcy-Weisbach — MAX(Hf_ac, Hf_acs) como pérdida crítica',
      ],
      [
        'Pérdidas adicionales',
        or(ep.hfotros),
        'm.c.a.',
        'Opcional — calentador, filtros, válvulas de zona',
      ],
    ],
  };

  const configBombas: MemoriaTable = {
    title: 'Equipo presión — configuración de bombas',
    headers: ['Parámetro', 'Valor'],
    rows: [
      ['Bombas en trabajo', or(ep.nt)],
      ['Bombas en reserva', or(ep.nr)],
      ['Total bombas', String(ntot)],
      ['Caudal por bomba Qb', fmtLps(Qb)],
    ],
  };

  const paramsEquipo: MemoriaTable = {
    title: 'Equipo presión — parámetros del equipo (datos del fabricante)',
    headers: ['Parámetro', 'Valor', 'Unidad'],
    rows: [
      ['Eficiencia bomba (η_b)', or(ep.etab), 'dec'],
      ['Eficiencia motor (η_m)', or(ep.etam), 'dec'],
      ['Factor de seguridad potencia', or(ep.fs), 'dec'],
      ['Ciclos/hora (n)', `${or(ep.ciclos)} (${ciclos > 10 ? 'No O.K.' : 'OK'})`, 'arr/h'],
      ['Fracción útil tanque (α)', or(ep.alfa), 'dec'],
      ['Velocidad succión (V_suc)', or(ep.vsuc), 'm/s'],
      ['Velocidad impulsión (V_imp)', or(ep.vimp), 'm/s'],
    ],
  };

  const alturaManometrica: MemoriaTable = {
    title: `Equipo presión — altura manométrica total (${isRed ? 'succión directa' : 'succión desde cisterna'})`,
    headers: ['Parámetro', 'Valor', 'Unidad'],
    rows: [
      ['Desnivel geométrico', `${hgOk ? '✓' : '✗'} ${f2(ztop - zbomba)}`, 'm.c.a.'],
      ...(!isRed ? [['Desnivel total', fmtMca(Hg), 'm.c.a.']] : []),
      ['Pérdidas de carga críticas', `${hfOk ? '✓' : '✗'} ${f2(HfCrit)}`, 'm.c.a.'],
      ...(!isRed ? [['Pérdidas de carga totales', `${hfOk ? '✓' : '✗'} ${f2(Hf)}`, 'm.c.a.']] : []),
      ['Presión mínima punto crítico', `${pminOk ? '✓' : '✗'} ${f2(pmin)}`, 'm.c.a.'],
      ...(isRed
        ? [['Presión disponible acometida', `${predOk ? '✓' : '✗'} ${f2(pred)}`, 'm.c.a.']]
        : []),
      ['Altura manométrica total HMT', `${hmtOk ? '✓' : '✗'} ${f2(HMT)}`, 'm.c.a.'],
      [
        'Verificación presión máxima del sistema',
        alertaPmax ? `⚠ ${f2(HMT)} > ${f2(pmax)}` : '✓ HMT dentro del límite',
        'm.c.a.',
      ],
    ],
  };

  const potenciaBomba: MemoriaTable = {
    title: 'Equipo presión — potencia de la bomba',
    headers: ['Parámetro', 'Valor', 'Ud.'],
    rows: [
      ['Potencia hidráulica', fmtW(Phid), 'W'],
      ['Potencia al freno', fmtW(Pfreno_w), 'W'],
      ['Potencia al freno', fmtHp(Pfreno_hp), 'HP'],
      [
        'Potencia calculada con factor de seguridad',
        Pins_hp > 0 ? `${f2(Pins_hp)} HP / ${Pins_kw > 0 ? f2(Pins_kw) : '—'} kW` : '—',
        '',
      ],
      ['Potencia comercial seleccionada', String(nemaSel), 'HP'],
      [
        'Margen potencia comercial vs calculada',
        `${pComercialOk ? '+' : ''}${margenPct.toFixed(1)}%`,
        '%',
      ],
      ['Verificación potencia comercial', pComercialOk ? '✓ Adecuada' : '⚠ Insuficiente', ''],
    ],
  };

  const caudales: MemoriaTable = {
    title: 'Equipo presión — caudales',
    headers: ['Parámetro', 'Valor', 'Ud.'],
    rows: [
      ['Qd = MAX(Qac, Qasc)', fmtLps(Qd), 'L/s'],
      ['Qd en m³/h', fmtM3h(Qm3h), 'm³/h'],
      ['Qd en GPM', fmtGpm(Qgpm), 'GPM'],
      ['Qb = Qd / Nt', fmtLps(Qb), 'L/s'],
    ],
  };

  const setpointTanque: MemoriaTable = {
    title: 'Equipo presión — setpoint y tanque hidroneumático',
    headers: ['Parámetro', 'Valor', 'Unidad', 'Fórmula'],
    rows: [
      ['Presión de arranque', fmtMca(Pon), 'm.c.a.', 'P_arranque = HMT'],
      ['Presión de paro', fmtMca(Poff), 'm.c.a.', 'P_paro = P_arranque × 1.10'],
      ['Presión de arranque en bar', fmtBar(Pon_bar), 'bar', 'P_arranque = HMT / 10.2'],
      ['Presión de paro en bar', fmtBar(Poff_bar), 'bar', 'P_paro = P_arranque × 1.10'],
      ['Precarga de nitrógeno N₂', fmtBar(PN2_bar), 'bar', 'P_precarga = 0.90 × P_arranque'],
      ['Volumen útil Vu', fmtL(Vu), 'L', 'Vu = Qd × 60 / (4 × n)'],
      ['Volumen total tanque Vt', fmtL(Vt), 'L', 'Vt = Vu / α'],
      ['Volumen total tanque Vt', Vt > 0 ? (Vt / 1000).toFixed(3) : '—', 'm³', 'Vt / 1000'],
    ],
  };

  const diametrosUsuario: MemoriaTable = {
    title: 'Equipo presión — diámetros seleccionados por el usuario',
    headers: ['Parámetro', 'Valor', 'Unidad'],
    rows: [
      ['Tubería de succión', or(ep.dnsuc), 'mm DN'],
      ['Velocidad real en succión', fmtMs(sucDiam.Vreal), 'm/s'],
      ['Tubería de impulsión', or(ep.dnimp), 'mm DN'],
      ['Velocidad real en impulsión', fmtMs(impDiam.Vreal), 'm/s'],
    ],
  };

  const diametrosNominales: MemoriaTable = {
    title: 'Equipo presión — diámetros nominales de tuberías del equipo',
    headers: ['Ramal', 'Q (L/s)', 'V diseño (m/s)', 'D calc (mm)', 'DN (mm)', 'V real (m/s)'],
    rows: [
      [
        'Succión colector (Qd)',
        fmtLps(Qd),
        String(vsuc),
        fmtMm(rSucColector.diamCalcMm),
        String(rSucColector.dn),
        fmtMs(rSucColector.vReal),
      ],
      [
        'Impulsión colector (Qd)',
        fmtLps(Qd),
        String(vimp),
        fmtMm(rImpColector.diamCalcMm),
        String(rImpColector.dn),
        fmtMs(rImpColector.vReal),
      ],
      [
        'Succión por bomba (Qb)',
        fmtLps(Qb),
        String(vsuc),
        fmtMm(rSucBomba.diamCalcMm),
        String(rSucBomba.dn),
        fmtMs(rSucBomba.vReal),
      ],
      [
        'Impulsión por bomba (Qb)',
        fmtLps(Qb),
        String(vimp),
        fmtMm(rImpBomba.diamCalcMm),
        String(rImpBomba.dn),
        fmtMs(rImpBomba.vReal),
      ],
    ],
  };

  const especTecnica: MemoriaTable = {
    title: 'Equipo presión — especificación técnica del equipo',
    headers: ['Parámetro', 'Valor'],
    rows: [
      ['Caudal nominal', `${fmtLps(Qd)} L/s = ${fmtM3h(Qm3h)} m³/h = ${fmtGpm(Qgpm)} GPM`],
      ['Altura manométrica total', `${fmtMca(HMT)} m.c.a. = ${fmtBar(HMT / 10.2)} bar`],
      [
        'Configuración de bombas',
        `${ntot} uds: ${nt} trabajo + ${nr} reserva · Qb = ${fmtLps(Qb)} L/s c/u`,
      ],
      [
        'Potencia comercial',
        `${nemaSel} HP = ${(nemaSel * 0.7457).toFixed(0)} kW (calc: ${Pins_hp > 0 ? f2(Pins_hp) : '—'} HP)`,
      ],
      ['Setpoint P_arranque / P_paro', `${fmtBar(Pon_bar)} / ${fmtBar(Poff_bar)} bar`],
      ['Tanque acumulador', `${fmtL(Vt)} L · Precarga N₂ = ${fmtBar(PN2_bar)} bar`],
      ['DN succión / impulsión', `DN ${rSucColector.dn} / DN ${rImpColector.dn} mm (PVC Sch 40)`],
      ['Control', `VFD × ${ntot} · Transductor 4–20 mA · PLC/SCADA`],
      ['Normas', 'NTC 1500:2018 · RAS 2000 Tít. B · NSR-10 Tít. H · NFPA 20'],
    ],
  };

  return [
    caudalesDiseno,
    presionesCotas,
    perdidasCarga,
    configBombas,
    paramsEquipo,
    alturaManometrica,
    potenciaBomba,
    caudales,
    setpointTanque,
    diametrosUsuario,
    diametrosNominales,
    especTecnica,
  ];
}

/** Alertas ep (Equipo de Presion) del resumen (misma física que computeEpTables). */
export function epAlertas(): string[] | null {
  const ep = loadFromStorage<EPData | null>('ep', null);
  if (!ep) return null;
  const c = epBase(ep);
  const fallos: string[] = [];
  if (!c.hmtOk) fallos.push(c.HMT <= 0 ? 'HMT sin datos' : 'HMT > Pmax del sistema');
  if (!c.pComercialOk) fallos.push('Potencia comercial < potencia requerida');
  // Mismos marcadores ✗ de la tabla "altura manométrica total" (validación completa
  // pedida por el usuario: el gate juzga TODO lo que la tabla marca, no solo 2 filas).
  if (!c.hgOk) fallos.push('Desnivel geométrico sin dato');
  if (!c.hfOk) fallos.push('Pérdidas de carga críticas sin dato');
  if (!c.pminOk) fallos.push('Presión del punto crítico sin dato');
  if (c.isRed && !c.predOk) fallos.push('Presión disponible de acometida sin dato');
  return fallos;
}
