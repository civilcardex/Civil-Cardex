/**
 * Hidráulica base del motor RCI (Red Contra Incendio): Hazen-Williams, velocidades, longitudes
 * equivalentes y el ruteo fila a fila. Ej: pipeRow de una tee de 4" con 500 gpm suma 6.10 m
 * equivalentes (LEQ) corregidos por el diámetro interno real del material.
 */
import { CDEF, GPM_M3S, LEQ, FIT, NOM, PIPES, PSI_M, cfOf, type EspAcc } from './tables';
import type { CalcCtx, FilaRoute, PipeRowRes, RouteResult, TuberiaRow } from './types';

/** Convierte un campo de entrada ("", null, número) en número; null si no es usable.
 *  Ej: num("4.72") = 4.72, num("") = null. */
export function num(v: unknown): number | null {
  return v === '' || v === null || v === undefined || isNaN(+v) ? null : +v;
}

/** ¿El valor de entrada es "Sí"? Los selectores del HTML guardan "Sí"/"No". */
export const isSi = (v: unknown): boolean => v === 'Sí';

/** Techo entero tolerante: ceilE(3.0000000001) = 3, ceilE(3.1) = 4. Evita falsos +1 por
 *  redondeo binario al dividir el área de diseño entre el área por rociador. */
export const ceilE = (x: number): number => Math.ceil(x - 1e-9);

/**
 * Pérdida por fricción de Hazen-Williams (forma NFPA) en psi por METRO.
 *
 * @param Q - caudal en gpm (galones por minuto).
 * @param C - coeficiente de rugosidad (120 acero húmedo, 100 seco, 150 plástico).
 * @param idmm - diámetro INTERIOR real en mm. Ej: 1¼" SCH 40 = 35.08 mm.
 * @returns psi/m. Ej: 50.75 gpm con C=120 en 35.08 mm da 0.627 psi/m.
 */
export function pfUnit(Q: number, C: number, idmm: number): number {
  if (!(Q > 0)) return 0;
  return ((4.52 * Math.pow(Q, 1.85)) / (Math.pow(C, 1.85) * Math.pow(idmm / 25.4, 4.87))) * 3.28084;
}

/** Nóminales de 1" o más disponibles en un material (para el diámetro automático). */
const nomSizes = (mat: string | undefined): string[] =>
  NOM.filter((n) => PIPES[mat!] && PIPES[mat!][n] && PIPES[mat!][n].inch >= 1);

/**
 * Diámetro automático: el menor de 1" o más cuya velocidad no supere Vmax.
 *
 * @param Q - caudal en gpm. @param mat - material (llave de PIPES). @param Vmax - límite en m/s.
 * @returns el nominal comercial. Ej: 53.92 gpm con Vmax 6 en acero SCH 40 da '1 1/4"'.
 */
export function suggestDn(Q: number, mat: string | undefined, Vmax: number): string {
  const sizes = nomSizes(mat);
  for (const n of sizes) {
    const V = (Q * GPM_M3S) / ((Math.PI * Math.pow(PIPES[mat!][n].id / 1000, 2)) / 4);
    if (V <= Vmax + 1e-9) return n;
  }
  return sizes[sizes.length - 1];
}

/* Accesorios especiales: "VA+DF", "2VG", "VA, 2 DF" → [{cod, n}] */

/**
 * Parsea el texto de accesorios especiales de una fila. Ej: "2VG, DF" →
 * [{n:2, cod:"VG"}, {n:1, cod:"DF"}]; un token ilegible sale con bad: true.
 *
 * @param str - texto libre de la columna "Especiales".
 */
export function parseEsp(str: unknown): { n: number; cod: string; bad?: boolean }[] {
  return String(str || '')
    .toUpperCase()
    .split(/[+,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .reduce((a: { n: number; cod: string; bad?: boolean }[], t) => {
      const m = t.match(/^(?:(\d+(?:\.\d+)?)\s*[X×]?\s*)?([A-Z][A-Z0-9]*)$/);
      if (m) a.push({ n: m[1] ? +m[1] : 1, cod: m[2] });
      else a.push({ n: 1, cod: t, bad: true });
      return a;
    }, []);
}

/** Pérdida total de los accesorios especiales de una fila: metros equivalentes (LD/Leq) más
 *  pérdidas directas (dp, escaladas con (Q/qref)^1.85) y los códigos sin catálogo. */
export function espLoss(
  str: unknown,
  cat: EspAcc[] | undefined,
  idmm: number,
  Q: number,
): { leq: number; dp: number; unk: string[]; det: string[] } {
  let leq = 0,
    dp = 0;
  const unk: string[] = [],
    det: string[] = [];
  /* Índice del catálogo por código en MAYÚSCULAS: mismo primer-match que el .find del HTML. */
  const catIdx = new Map<string, EspAcc>();
  (cat || []).forEach((x) => {
    const k = String(x.cod).toUpperCase();
    if (!catIdx.has(k)) catIdx.set(k, x);
  });
  parseEsp(str).forEach(({ n, cod }) => {
    const it = catIdx.get(cod);
    if (!it) {
      unk.push(cod);
      return;
    }
    const v = num(it.valor) || 0;
    if (it.modo === 'dp') {
      const qr = num(it.qref);
      const d = qr && qr > 0 ? v * Math.pow(Q / qr, 1.85) : v;
      dp += n * d;
      det.push(`${n}×${cod}: ${d.toFixed(2)} psi`);
    } else {
      const l = it.modo === 'Leq' ? v : (v * idmm) / 1000;
      leq += n * l;
      det.push(`${n}×${cod}: ${l.toFixed(2)} m`);
    }
  });
  return { leq, dp, unk, det };
}

/** C de Hazen-Williams efectivo de una tubería: el adoptado en st.cmat o el de NFPA 13. */
export const cOf = (mat: string | undefined, sistema: string, cmat: CalcCtx['cmat']): number => {
  const o = cmat && mat ? cmat[mat] : undefined,
    v = o ? num(sistema === 'Seco' ? o.s : o.h) : null;
  return v !== null && v > 0 ? v : CDEF(mat, sistema);
};

/** Calcula una tubería individual: fricción (con longitudes equivalentes corregidas por el
 *  diámetro interno real y el C del material), desnivel Pe y velocidad V. Ej: la fila de T2
 *  (B→C) del ejemplo da Lt = 15.01 m y Pf = 6.00 psi. */
export function pipeRow(row: TuberiaRow, P: number, Q: number, ctx: CalcCtx): PipeRowRes {
  const sistema = ctx.sistema;
  const pipe = PIPES[row.mat!] && PIPES[row.mat!][row.dn!];
  if (!pipe) return { ok: false, err: 'Diámetro no disponible para el material' };
  const L = num(row.L);
  if (L === null || L < 0) return { ok: false, err: 'Falta la longitud' };
  const id = pipe.id;
  const C = cOf(row.mat, sistema, ctx.cmat);
  const ref40 = PIPES['Acero SCH 40'][row.dn!].id;
  const leqBase = FIT.reduce((s, f, i) => s + (num(row[f]) || 0) * LEQ[row.dn!][i], 0);
  const es = espLoss(row.esp, ctx.esp, id, Q);
  const leqFit = leqBase * cfOf(C) * Math.pow(id / ref40, 4.87);
  const leq = leqFit + (num(row.leqOtros) || 0) + es.leq;
  const Lt = L + leq;
  const pfu = pfUnit(Q, C, id);
  const Pf = pfu * Lt + es.dp;
  const Pe = PSI_M * ((num(row.zi) || 0) - (num(row.zf) || 0));
  const Pfin = P + Pf + Pe;
  const V = (Q * GPM_M3S) / ((Math.PI * Math.pow(id / 1000, 2)) / 4);
  return {
    ok: true,
    id,
    C,
    leq,
    leqFit,
    Lt,
    pfu,
    Pf,
    PfL: pfu * L,
    PfAcc: pfu * leq + es.dp,
    Pe,
    Pfin,
    V,
    leqEsp: es.leq,
    dpEsp: es.dp,
    espUnk: es.unk,
    espDet: es.det,
  };
}

/** Rutea una secuencia de filas acumulando caudal y presión. kind = "ramal" suma rociadores
 *  (q = K·√P), "alim" suma ramales equilibrados por su Keq y caudales fijos, "gab" suma las
 *  salidas de gabinete. Ej: la ruta de gabinetes del ejemplo arranca en PreqSP = 100 psi. */
export function route(
  rows: TuberiaRow[],
  P0: number,
  Q0: number,
  ctx: CalcCtx,
  kind: 'ramal' | 'alim' | 'gab',
): RouteResult {
  let P = P0,
    Q = Q0,
    valid = true;
  const out: FilaRoute[] = [];
  let nSpr = 0,
    nIndiv = 0,
    qFix = 0;
  for (const r of rows) {
    if (!valid) {
      out.push({ ok: false, err: 'Tramo anterior incompleto' });
      continue;
    }
    let q = 0;
    if (kind === 'ramal' && r.roc) {
      q += (num(r.k) || ctx.K) * Math.sqrt(Math.max(P, 0));
      nSpr++;
    }
    if (kind === 'alim') {
      const br = r.ramal ? ctx.branches[r.ramal] : undefined;
      const n = num(r.nRamal) || 0;
      if (br && n > 0 && br.Keq && br.Keq > 0) q += n * br.Keq * Math.sqrt(Math.max(P, 0));
      if (r._extra) {
        const bx = ctx.branches[r._extra.ramal];
        if (bx && bx.Keq && bx.Keq > 0) q += r._extra.n * bx.Keq * Math.sqrt(Math.max(P, 0));
      }
      if (r.indiv) {
        q += ctx.K * Math.sqrt(Math.max(P, 0));
        nIndiv++;
      }
      q += num(r.qFijo) || 0;
      qFix += num(r.qFijo) || 0;
    }
    if (kind === 'gab' && r.salida) {
      q += num(r.qFijo) || 0;
      qFix += num(r.qFijo) || 0;
    }
    if (kind === 'gab' && r.qExtra) {
      q += r.qExtra;
      qFix += r.qExtra;
    }
    Q += q;
    const dn = r.dn === 'auto' ? suggestDn(Q, r.mat, ctx.Vmax) : (r.dn as string);
    const pr = pipeRow(Object.assign({}, r, { dn }), P, Q, ctx);
    if (!pr.ok) {
      valid = false;
      out.push({ ok: false, err: pr.err, Pini: P, q, Q, dnUsed: dn });
      continue;
    }
    const res = Object.assign({ Pini: P, q, Q, dnUsed: dn, chkV: '', chkP: 'OK' }, pr);
    res.chkV = pr.V > ctx.Vmax ? 'V ALTA' : 'OK';
    let chkP = 'OK';
    if (P > ctx.Pcomp || pr.Pfin > ctx.Pcomp) chkP = 'P ALTA';
    else if (kind === 'ramal' && r.roc && P < ctx.Pmin - 0.005) chkP = 'P BAJA';
    else if (kind === 'alim' && r.indiv && P < ctx.Pmin - 0.005) chkP = 'P BAJA';
    else if (kind === 'gab' && r.salida && P < ctx.PreqSP - 0.005) chkP = 'P BAJA';
    else if (kind === 'gab' && r.salida && ctx.claseSP !== 'Clase I' && P > 100) chkP = 'REGULAR';
    res.chkP = chkP;
    out.push(res);
    P = pr.Pfin;
  }
  return { rows: out, Pend: P, Qend: Q, valid: valid && rows.length > 0, nSpr, nIndiv, qFix };
}
