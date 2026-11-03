/**
 * Bomba principal (NFPA 20), perfil de presiones por piso, siamesa (conexión de bomberos,
 * NFPA 14) y tanque (NFPA 22). La curva de la bomba es la parábola por los tres puntos de
 * NFPA 20: churn (caudal cero), nominal y 65 % al 150 %. Ej: el ejemplo cierra con 500 gpm a
 * 141 psi, churn 169.2 psi y tanque de 56.78 m³.
 */
import { GPM_M3S, LEQ, MOT, P20, PSI_M, PIPES, PV, cfOf, type HzEntry } from './tables';
import { cOf, isSi, num, pfUnit, route } from './hydraulics';
import type {
  BombaResult,
  CalcCtx,
  Demanda,
  Edificio,
  PisoOut,
  RouteResult,
  RciResult,
  RciState,
  SiaResult,
  TanqueResult,
  TuberiaRow,
} from './types';

/** Interpola la curva de vapor/agua (PV) a la temperatura T (°C): presión de vapor pv (psi) y
 *  densidad rho (kg/m³). Ej: interpPV(23.5).pv = 0.3065 psi para el NPSH del ejemplo. */
export function interpPV(T: number): { pv: number; rho: number } {
  let i = 0;
  while (i < PV.length - 2 && T >= PV[i + 1][0]) i++;
  const [t0, p0, d0] = PV[i],
    [t1, p1, d1] = PV[i + 1];
  const f = (T - t0) / (t1 - t0);
  return { pv: p0 + f * (p1 - p0), rho: d0 + f * (d1 - d0) };
}

/** ¿La salida del piso lleva manguera de 1½"? (NFPA 14: gatillo de la válvula reguladora). */
const salidaConManguera15 = (salida: string): boolean => salida.includes('1½');

/** Siamesa (conexión de bomberos, NFPA 14): el carro alimenta el montante sin la bomba del
 *  edificio; la presión requerida en las entradas sube por la tubería de la siamesa con sus
 *  accesorios y el desnivel. Ej: el ejemplo da 125.1 psi en las entradas con 500 gpm. */
export function siamesaCalc(st: RciState, R: RciResult, ctx: CalcCtx): SiaResult {
  const S: RciState['sia'] = Object.assign(
    {
      n: 1,
      entradas: 2,
      rosca: '',
      npt: 0,
      h: 0.75,
      mat: 'Acero SCH 10',
      dn: '4"',
      L: 6,
      c90: 2,
      tee: 1,
      chq: 1,
      cierre: 'No',
      drenaje: 'Sí',
      hidrante: '',
    },
    st.sia || {},
  );
  const E = R.edif,
    nOut = E.outs.length,
    up = E.gabRows.slice(0, nOut);
  const extra = E.gabRows.slice(nOut).reduce((a, r) => a + (r.qExtra || 0), 0);
  const zS = (num(S.npt) ?? 0) - E.zB + (num(S.h) ?? 0.75);
  const row: TuberiaRow = {
    ni: 'Base',
    nf: 'Siamesa',
    salida: false,
    qFijo: '',
    qExtra: extra,
    mat: S.mat,
    dn: S.dn,
    L: num(S.L) ?? 0,
    c90: num(S.c90) || 0,
    tee: num(S.tee) || 0,
    ret: num(S.chq) || 0,
    esp: '',
    zi: E.zBase,
    zf: zS,
  };
  const res = up.length ? route(up.concat([row]), ctx.PreqSP, 0, ctx, 'gab') : null;
  const zTop = E.outs.length ? Math.max(...E.outs.map((o) => o.zS as number)) : null;
  return {
    S,
    z: zS,
    res,
    rows: up.concat([row]),
    P: res && res.valid ? res.Pend : null,
    Q: res && res.valid ? res.Qend : null,
    alto: zTop !== null && zTop - zS > 22.86,
    combinado: isSi(st.local.exigeRoc),
  };
}

/**
 * Selección de la bomba (NFPA 20) y perfil de presiones por piso, en el MISMO orden que el
 * HTML: gobierna el piso que exige más presión neta; D1 rociadores, D2 montantes; la parábola
 * de la curva; el perfil (holgura, estáticas, VRP (Válvula Reductora de Presión) y válvulas
 * reguladoras por piso) y la potencia/NPSH (Net Positive Suction Head).
 *
 * Mutates E (R.edif): pf[].Pst/holg/vrp/reg…, E.gov, E.PstMax/hmin/Pc. Devuelve alim/effAlim
 * (demanda que gobierna) y el resultado de bomba. hz = R.roc.hz (respaldo de mangueras).
 */
export function bombaPerfilCalc(
  st: RciState,
  E: Edificio,
  gab: RouteResult | null,
  spActivo: boolean,
  ctx: CalcCtx,
  hz: HzEntry,
): { alim: RouteResult; effAlim: TuberiaRow[]; bomba: BombaResult } {
  const b = st.bomba;
  const pipeS = PIPES[b.matSuc] && PIPES[b.matSuc][b.dnSuc];
  const IDs = pipeS ? pipeS.id : NaN;
  const Cs = cOf(b.matSuc, 'Húmedo', st.cmat);
  const leqS = pipeS
    ? ((num(b.c90) || 0) * LEQ[b.dnSuc][1] +
        (num(b.tee) || 0) * LEQ[b.dnSuc][3] +
        (num(b.comp) || 0) * LEQ[b.dnSuc][5] +
        (num(b.chq) || 0) * LEQ[b.dnSuc][6]) *
      cfOf(Cs) *
      Math.pow(IDs / PIPES['Acero SCH 40'][b.dnSuc].id, 4.87)
    : 0;
  const LtS = (num(b.lSuc) || 0) + leqS;
  const Hmin = num(b.hmin) || 0,
    Hmax = num(b.hmax) || 0;
  const psuc = (q: number): number => PSI_M * Hmin - pfUnit(q, Cs, IDs) * LtS;
  /* Mangueras: las de la tipología de cada piso (cada riesgo tiene su caudal de mangueras) */
  const hoseOf = (o: { t?: { roc?: { hz: HzEntry } | null } | null } | null | undefined): number =>
    !isSi(st.mang.mangBomba) ? 0 : o && o.t && o.t.roc ? o.t.roc.hz.hose : hz.hose;
  /* Gobierna el piso que exige más presión neta en la bomba */
  const cand = E.pf.filter((o) => o.res && o.res.valid);
  const net = (o: PisoOut): number => o.res!.Pend - psuc(o.Q! + hoseOf(o));
  const gov = cand.reduce<Edificio['gov']>((a, o) => (!a || net(o) > net(a) ? o : a), null);
  E.gov = gov;
  const alim: RouteResult = gov
    ? gov.res!
    : { rows: [], Pend: 0, Qend: 0, qFix: 0, nIndiv: 0, nSpr: 0, valid: false };
  const effAlim: TuberiaRow[] = gov ? gov.rows! : [];
  const D1Q = alim.Qend + (E.gov ? hoseOf(E.gov) : 0);
  const D1: Demanda = { Q: D1Q, Pdes: alim.Pend, Psuc: psuc(D1Q), P: 0 };
  D1.P = D1.Pdes - D1.Psuc;
  let D2: Demanda | null = null;
  if (spActivo && gab && gab.valid) {
    D2 = { Q: gab.Qend, Pdes: gab.Pend, Psuc: psuc(gab.Qend), P: 0 };
    D2.P = D2.Pdes - D2.Psuc;
  }
  const Qdem = Math.max(
    D1.Q,
    D2 ? D2.Q : 0,
    Math.max(0, ...E.pf.filter((o) => o.res && o.res.valid).map((o) => o.Q! + hoseOf(o))),
  );
  const qrM = num(b.qrManual);
  const Qnom = qrM || (P20.find((r) => r[0] >= Qdem - 1e-9) || P20[P20.length - 1])[0];
  const Pnom = Math.ceil(Math.max(D1.P, D2 ? D2.P : 0) * (1 + (num(b.margen) || 0)) - 1e-9);
  const f = num(b.fchurn) || 1.2;
  const Pchurn = f * Pnom,
    P150 = 0.65 * Pnom;
  const ca = (((0.5 * f - 0.85) / 0.75) * Pnom) / (Qnom * Qnom);
  const cb = ((1 - f) * Pnom - ca * Qnom * Qnom) / Qnom;
  const curve = (q: number): number => (q > 1.5 * Qnom + 1e-9 ? 0 : ca * q * q + cb * q + Pchurn);
  D1.disp = curve(D1.Q);
  if (D2) D2.disp = curve(D2.Q);
  const Pmaxsis = Pchurn + PSI_M * Math.max(Hmax, 0);
  {
    /* ---------- Perfil de presiones ---------- */
    const Pc = ctx.Pcomp,
      hmin = num(E.M.holgura) || 0;
    const avail = (q: number): number => psuc(q) + curve(q);
    E.pf.forEach((o) => {
      if (o.zT === null) return;
      o.Pst = Pmaxsis - PSI_M * o.zT;
      o.PstS = Pmaxsis - PSI_M * (o.zS as number);
      if (o.res && o.res.valid) {
        o.Qp = o.Q! + hoseOf(o);
        o.avail = avail(o.Qp);
        o.holg = o.avail - o.res.Pend;
        o.disp = o.Preq! + o.holg;
        o.okH = o.holg >= hmin - 1e-6;
      }
      /* VRP en la derivación: se requiere si la estática supera la presión de los componentes. Decisión del piso: Auto / Sí / No */
      o.vrpReq = o.Pst > Pc;
      o.vrpSet = o.Preq !== undefined ? Math.ceil(o.Preq + Math.max(hmin, 5)) : null;
      o.vrp = o.f.vrp === 'Sí' || (o.f.vrp !== 'No' && o.vrpReq);
      o.vrpFalta = o.vrpReq && o.f.vrp === 'No';
      if (o.f.salida && o.f.salida !== 'Ninguna') {
        /* NFPA 14: válvula reguladora si la residual de 1½" supera 100 psi o si la estática de cualquier salida supera 175 psi */
        const has15 = salidaConManguera15(o.f.salida);
        if (has15) {
          const rr = route(
            [
              {
                ni: 'S',
                nf: 'Base',
                mat: E.M.mat,
                dn: E.dnM,
                L: Math.abs((o.zS as number) - E.zBase),
                zi: o.zS as number,
                zf: E.zBase,
              },
              ...E.cuarto,
            ],
            0,
            100,
            ctx,
            'alim',
          );
          o.res15 = rr.valid ? avail(100) - rr.Pend : null;
        }
        o.regRes = has15 && (o.res15 as number) > 100;
        o.regEst = (o.PstS as number) > 175;
        o.regReq = o.regRes || o.regEst;
        o.reg = o.f.vreg === 'Sí' || (o.f.vreg !== 'No' && o.regReq);
        o.regFalta = o.regReq && o.f.vreg === 'No';
      }
    });
    const zs = E.pf
      .flatMap((o) => (o.zT === null ? [] : [o.zT, o.zS as number]))
      .concat([E.zBase, 0]);
    E.PstMax = Pmaxsis - PSI_M * Math.min(...zs);
    E.hmin = hmin;
    E.Pc = Pc;
  }
  const HPr = (Pnom * 6894.76 * Qnom * GPM_M3S) / (745.7 * (num(b.etaN) || 0.65));
  const HP150 = (P150 * 6894.76 * 1.5 * Qnom * GPM_M3S) / (745.7 * (num(b.eta150) || 0.6));
  const HPreq = Math.max(HPr, HP150) / (num(b.fs) || 1);
  const HPmot = MOT.find((m) => m >= HPreq - 1e-9) || MOT[MOT.length - 1];
  const Patm =
    num(b.patmManual) !== null
      ? (num(b.patmManual) as number)
      : 10.33 - (num(b.altitud) || 0) / 900;
  const { pv } = interpPV(num(b.tagua) || 20);
  const HfS = (pfUnit(1.5 * Qnom, Cs, IDs) * LtS) / 1.4206;
  const NPSHd = Patm + Hmin - HfS - pv;
  const Vsuc = (1.5 * Qnom * GPM_M3S) / ((Math.PI * Math.pow(IDs / 1000, 2)) / 4);
  const p20row = P20.find((r) => r[0] >= Qnom - 1e-9) || P20[P20.length - 1];
  const PsMin = PSI_M * Hmin;
  const JkStop = Pchurn + PsMin;
  const bomba: BombaResult = {
    IDs,
    Cs,
    leqS,
    LtS,
    D1,
    D2,
    Qdem,
    Qnom,
    Pnom,
    Pchurn,
    P150,
    ca,
    cb,
    curve,
    Pmaxsis,
    HPr,
    HP150,
    HPmot,
    Patm,
    pv,
    HfS,
    NPSHd,
    Vsuc,
    DsucMin: p20row[1],
    DdesMin: p20row[2],
    Ncab: p20row[6],
    DsucAd: pipeS ? pipeS.inch : NaN,
    PsMin,
    JkStop,
    JkStart: JkStop - 10,
    PpStart: JkStop - 15,
    Qjockey: num(b.qjockey) || 0,
    DintReq: Math.sqrt((4 * 1.5 * Qnom * GPM_M3S) / (Math.PI * 4.57)) * 1000,
  };
  return { alim, effAlim, bomba };
}

/** Tanque de almacenamiento (NFPA 22): gobierna la tipología con mayor (caudal + mangueras) ×
 *  duración; la duración mínima es la de su riesgo. Ej: 500 gpm × 30 min de montantes →
 *  56.78 m³ útiles en el ejemplo. */
export function tanqueCalc(st: RciState, R: RciResult, hz: HzEntry): TanqueResult {
  const durA = num(st.mang.duracion),
    hoseT = (t: { roc?: { hz: HzEntry } | null } | null | undefined): number =>
      isSi(st.mang.mangTanque) ? (t && t.roc ? t.roc.hz.hose : hz.hose) : 0;
  const vT = Object.values(R.edif.typ)
    .filter((t) => t.ok)
    .map((t) => ({ t, d: durA || t.roc.hz.dmin, q: t.Q! + hoseT(t) }));
  const vG = vT.reduce<{ t: (typeof vT)[number]['t']; d: number; q: number } | null>(
    (a, x) => (!a || x.q * x.d > a.q * a.d ? x : a),
    null,
  );
  const dur = vG ? vG.d : durA || hz.dmin;
  const Vroc = vG
    ? Math.max(vG.q * vG.d, (R.alim.Qend + hoseT(R.edif.gov && R.edif.gov.t)) * dur) *
      0.003785411784
    : (R.alim.Qend + (isSi(st.mang.mangTanque) ? hz.hose : 0)) * dur * 0.003785411784;
  const Vsp = R.bomba.D2 ? R.bomba.D2.Q * 30 * 0.003785411784 : 0;
  return {
    tip: vG ? vG.t.g.id : null,
    dur,
    Vroc,
    Vsp,
    V: Math.max(Vroc, Vsp) + (num(st.tanque.vextra) || 0),
  };
}
