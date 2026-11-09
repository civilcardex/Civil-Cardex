/**
 * Orquestador del motor RCI (Red Contra Incendio): compute(st, tips) corre los mismos pasos en
 * el mismo orden que el HTML de referencia — criterios, red por tipología, gabinetes, siamesa,
 * bomba+perfil, tanque y las 44 verificaciones — y es una función PURA (estado → resultados,
 * sin DOM, ni React, ni storage). Ej: compute(ejemploVerificacion(), tips).bomba.Pnom = 141.
 */
import { ESP_DEF } from './tables';
import { isSi, num, route } from './hydraulics';
import { criterios } from './criteria';
import { edificio, numMontantesDibujados } from './building';
import { siamesaCalc, bombaPerfilCalc, tanqueCalc } from './pump';
import { checks, type DibujoPiso } from './checks';
import type { CalcCtx, RciResult, RciState, Tips } from './types';

export { clasificar, edificio } from './building';
export { criterios, zonaSis } from './criteria';
export { calcRamal, computeRed } from './network';
export {
  num,
  isSi,
  ceilE,
  pfUnit,
  suggestDn,
  parseEsp,
  espLoss,
  pipeRow,
  route,
  cOf,
} from './hydraulics';
export { interpPV, siamesaCalc, bombaPerfilCalc, tanqueCalc } from './pump';
export { checks, type DibujoPiso } from './checks';
export { ejemploVerificacion } from './example';
export {
  type RciState,
  type RciResult,
  type Tips,
  type Tipologia,
  type TipCalc,
  type Criterios,
  type Edificio,
  type PisoOut,
  type RedResult,
  type RamalCalc,
  type TramoCalc,
  type NudoCalc,
  type RouteResult,
  type FilaRoute,
  type PipeCalc,
  type CalcCtx,
  type TuberiaRow,
  type NumIn,
  type BombaResult,
  type Demanda,
  type SiaResult,
  type SpResult,
  type TanqueResult,
  type Verificacion,
  type MontCfg,
  type MontanteCfg,
  type Red,
  type PisoRow,
  type RciPisos,
  type EspAcc,
  type HzEntry,
  type PipeSpec,
} from './types';

/** Motor de cálculo completo. tips = agrupación de pisos (clasificar(st)); si falta, edificio()
 *  usa la red de Entradas como única tipología implícita. `dibujo` = geometría del piso activo
 *  del visor (muros/ramales en m) para las verificaciones de dibujo. Igual que RCI.compute del HTML. */
export function compute(st: RciState, tips?: Tips, dibujo?: DibujoPiso): RciResult {
  const R = {} as RciResult;
  const c = st.clas,
    ro = st.roc;
  R.roc = criterios(c, ro);

  /* ---------- Hidráulica ---------- */
  const ctx: CalcCtx = {
    cmat: st.cmat,
    K: R.roc.K,
    Pmin: R.roc.Pmin,
    sistema: c.sistema,
    Vmax: num(st.tub.Vmax) || 6,
    Pcomp: num(st.tub.Pcomp) || 175,
    PreqSP: st.sp.clase === 'Clase II' ? 65 : 100,
    claseSP: st.sp.clase,
    branches: {},
  };
  R.branches = {};
  ctx.esp = st.esp || ESP_DEF();
  /* Montantes EFECTIVOS (ped. usuario): lo manda el dibujo (códigos GAB/MAC extraídos);
     sin dibujo cae al amarillo sp.num. */
  const numSP = numMontantesDibujados(st);
  const QreqSP =
    st.sp.clase === 'Clase II'
      ? 100
      : Math.min(500 + 250 * (numSP - 1), isSi(st.sp.rociado) ? 1000 : 1250);
  /* La red siempre llega por ramales y tramos (desde PLANO): una red por tipología, calculada en edificio() */
  R.gen = null;
  R.red = null;
  const E = edificio(st, R.roc, ctx, tips, QreqSP);
  R.edif = E;
  const rd = E.active && E.active.rd ? E.active.rd : null;
  R.red = rd;
  R.effRamales = rd
    ? rd.rams.filter((x) => x.res).map((x) => ({ id: x.id, nombre: x.nombre, rows: x.rows! }))
    : [];
  if (rd)
    rd.rams.forEach((x) => {
      if (x.res) {
        R.branches[x.id] = x.res;
        ctx.branches[x.id] = x.res;
      }
    });
  R.Nop = rd ? rd.Nop : 0;
  R.Qroc = R.red && R.red.rt && R.red.rt.solved ? R.red.rt.Q! : 0;

  /* ---------- Montantes (NFPA 14) ---------- */
  const gabRowsUse = R.edif.gabRows;
  const spActivo = isSi(st.local.exigeSP) && gabRowsUse.length > 0;
  R.gab = spActivo ? route(gabRowsUse, ctx.PreqSP, 0, ctx, 'gab') : null;
  R.sp = { activo: spActivo, Preq: ctx.PreqSP, Qreq: QreqSP, dur: 30, rows: gabRowsUse };
  if (spActivo) {
    const zs = R.edif.outs.map((o) => o.zS as number);
    R.sp.zAuto = zs.length ? Math.min(...zs) : 0;
    R.sp.zMin = num(st.sp.zMinSalida) !== null ? (num(st.sp.zMinSalida) as number) : R.sp.zAuto;
  }
  /* ---------- Siamesa (conexión de bomberos, NFPA 14) ---------- */
  R.sia = null;
  if (spActivo) R.sia = siamesaCalc(st, R, ctx);

  /* ---------- Bomba (NFPA 20) + perfil de presiones ---------- */
  const { alim, effAlim, bomba } = bombaPerfilCalc(st, E, R.gab, spActivo, ctx, R.roc.hz);
  R.alim = alim;
  R.effAlim = effAlim;
  R.bomba = bomba;

  /* ---------- Tanque ---------- */
  R.tanque = tanqueCalc(st, R, R.roc.hz);

  /* ---------- Verificaciones ---------- */
  R.checks = checks(st, R, dibujo);
  R.count = R.checks.reduce(
    (a, k) => ((a[k.st] = (a[k.st] || 0) + 1), a),
    {} as Record<string, number>,
  );
  return R;
}
